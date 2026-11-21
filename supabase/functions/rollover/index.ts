import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://tapt.org',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // Add WebContainer domains
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

interface RolloverRequest {
  type: string;
  settings: Record<string, any>;
}

// The date fields each form needs (the settings pages already require them). Most forms have a start and end date;
// the regional luncheon has only a registration deadline.
const ROLLOVER_TYPES: Record<string, { deadlineField: string | null; hasStartEnd: boolean }> = {
  'conference': { deadlineField: 'registration_end_date', hasStartEnd: true },
  'tech-conference': { deadlineField: 'registration_end_date', hasStartEnd: true },
  'exhibitor': { deadlineField: 'registration_end_date', hasStartEnd: true },
  'hall-of-fame': { deadlineField: null, hasStartEnd: true },
  'student-scholarship': { deadlineField: 'application_deadline', hasStartEnd: true },
  'president-nomination': { deadlineField: null, hasStartEnd: true },
  'regional-director-nomination': { deadlineField: null, hasStartEnd: true },
  'regional-luncheon': { deadlineField: 'registration_deadline', hasStartEnd: false }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Errors raised on purpose by the database function rollover_cycle. Their text is safe to show an admin.
// Anything else is logged but not shown.
const KNOWN_DB_ERRORS: Record<string, number> = {
  stale_settings: 409,
  archive_columns_missing: 409,
  missing_table: 500,
  not_empty: 500,
  invalid_type: 400,
  invalid_settings: 400
};

const GENERIC_FAILURE = 'Rollover failed. Nothing was changed.';

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));

// Returns an error message when the request is not acceptable, otherwise null
const validateRollover = (type: unknown, settings: unknown): string | null => {
  if (typeof type !== 'string' || !ROLLOVER_TYPES[type]) return 'Invalid rollover type';
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return 'Missing required fields: type and settings are required';
  }
  const s = settings as Record<string, unknown>;

  const rules = ROLLOVER_TYPES[type];
  const required = [...(rules.hasStartEnd ? ['start_date', 'end_date'] : []), rules.deadlineField];
  const missing: string[] = [];
  for (const field of required) {
    if (field && !isValidDate(s[field])) missing.push(field);
  }
  if (missing.length > 0) {
    return `Missing or invalid settings fields: ${missing.join(', ')}`;
  }
  if (rules.hasStartEnd && Date.parse(s.end_date as string) <= Date.parse(s.start_date as string)) {
    return 'End date must be after start date';
  }
  return null;
};

// Maps a database error to what the admin should see. Unknown errors become a generic message.
const describeDbError = (error: { message?: string; code?: string } | null | undefined): { message: string; status: number; known: boolean } => {
  const text = typeof error?.message === 'string' ? error.message : '';
  const match = text.match(/^\[([a-z_]+)\]\s*(.*)$/s);
  if (match && KNOWN_DB_ERRORS[match[1]] !== undefined) {
    return { message: match[2] || GENERIC_FAILURE, status: KNOWN_DB_ERRORS[match[1]], known: true };
  }
  // not_null_violation: the new settings row lacks a required value. Happens when there is no active settings row
  // to copy from and the page did not send every required field.
  if (error?.code === '23502') {
    return { message: 'A required setting is missing. Save the settings first, then try the rollover again. Nothing was changed.', status: 400, known: true };
  }
  return { message: GENERIC_FAILURE, status: 500, known: false };
};

// Helper to log rollover actions
type RolloverLogEntry = {
  user_id: string | null;
  outcome: 'success' | 'failure';
  error?: string;
  type: string | null;
  details?: Record<string, unknown>;
};

async function logRolloverAction(supabaseAdmin: any, entry: RolloverLogEntry) {
  try {
    // The action name `rollover_<type>` is read by the admin dashboard's activity feed
    await supabaseAdmin.from('admin_logs').insert([
      {
        action: `rollover_${entry.type || 'unknown'}`,
        user_id: entry.user_id,
        outcome: entry.outcome,
        error: entry.error || null,
        details: entry.details ?? null,
        timestamp: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.error('Failed to log rollover action:', e);
  }
}

// Only these fields are written to the log, never payment instructions or long descriptions
const summarizeSettings = (settings: Record<string, any> | null | undefined) => ({
  name: settings?.name ?? null,
  start_date: settings?.start_date ?? null,
  end_date: settings?.end_date ?? null,
  registration_end_date: settings?.registration_end_date ?? null,
  registration_deadline: settings?.registration_deadline ?? null,
  application_deadline: settings?.application_deadline ?? null
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  // Check if origin matches any allowed pattern (including wildcards)
  const allowOrigin = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Known as soon as the request has been read, so a failure can be logged with who and what
  let supabaseAdmin: any = null;
  let userId: string | null = null;
  let type: string | null = null;
  let settingsSummary: Record<string, unknown> | null = null;

  try {
    // Verify request method
    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
    }

    // Create authenticated Supabase client using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'No authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // Verify user is admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return jsonResponse({ success: false, error: 'Unauthorized - Admin access required' }, 403);
    }
    userId = user.id;

    // Read the body once
    let requestBody: Partial<RolloverRequest> = {};
    try {
      requestBody = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Invalid request body' }, 400);
    }
    const { settings } = requestBody;
    type = typeof requestBody.type === 'string' ? requestBody.type : null;
    settingsSummary = summarizeSettings(settings);

    const validationError = validateRollover(type, settings);
    if (validationError) {
      return jsonResponse({ success: false, error: validationError }, 400);
    }

    // The settings row the admin was looking at; the database refuses the rollover if it is no longer the
    // active one (page out of date, or the button was pressed twice)
    const expectedSettingsId =
      typeof settings!.id === 'string' && UUID_PATTERN.test(settings!.id) ? settings!.id : null;

    // Archives the rows, clears the live tables, and starts the new cycle in ONE transaction:
    // it either all happens or nothing does.
    const { data, error: rpcError } = await supabaseAdmin.rpc('rollover_cycle', {
      p_type: type,
      p_expected_settings_id: expectedSettingsId,
      p_settings: settings
    });

    if (rpcError) {
      const described = describeDbError(rpcError);
      await logRolloverAction(supabaseAdmin, {
        user_id: userId,
        outcome: 'failure',
        error: rpcError.message || 'Unknown database error',
        type,
        details: { settingsSummary }
      });
      return jsonResponse({ success: false, error: described.message }, described.status);
    }

    const result = (data ?? {}) as Record<string, any>;

    await logRolloverAction(supabaseAdmin, {
      user_id: userId,
      outcome: 'success',
      type,
      details: {
        archiveId: result.archive_id ?? null,
        archivedRows: result.archived_rows ?? 0,
        archivedRelatedRows: result.archived_related_rows ?? 0,
        previousSettingsId: result.previous_settings_id ?? null,
        settingsId: result.settings_id ?? null,
        settingsSummary
      }
    });

    return jsonResponse({
      success: true,
      archiveId: result.archive_id ?? null,
      settingsId: result.settings_id ?? null,
      archivedRows: result.archived_rows ?? 0,
      archivedRelatedRows: result.archived_related_rows ?? 0
    });

  } catch (error) {
    console.error('Rollover error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (supabaseAdmin) {
      await logRolloverAction(supabaseAdmin, {
        user_id: userId,
        outcome: 'failure',
        error: errorMessage,
        type,
        details: { settingsSummary }
      });
    }

    return jsonResponse({ success: false, error: GENERIC_FAILURE }, 500);
  }
});
