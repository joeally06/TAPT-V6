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

// Utility to sanitize error messages
const sanitizeError = (error: any): string => {
  const errorMap: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Invalid login credentials.',
    '23505': 'A record with this information already exists.',
    '22P02': 'Invalid input format.',
    '23503': 'Related record not found.',
    '23514': 'Input does not meet requirements.',
  };
  
  if (error && typeof error === 'object') {
    if (error.code && errorMap[error.code]) return errorMap[error.code];
    if (error.message && errorMap[error.message]) return errorMap[error.message];
  }
  
  return 'An unexpected error occurred. Please try again.';
};

// Helper to log rollover actions
type RolloverLogEntry = {
  action: string;
  user_id: string | null;
  outcome: 'success' | 'failure';
  error?: string;
  type?: string | null;
  archiveId?: string | null;
  details?: any;
};

async function logRolloverAction(supabaseAdmin: any, entry: RolloverLogEntry) {
  try {
    await supabaseAdmin.from('admin_logs').insert([
      {
        action: `rollover_${entry.type || 'unknown'}`,
        user_id: entry.user_id,
        outcome: entry.outcome,
        error: entry.error || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        timestamp: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.error('Failed to log rollover action:', e);
  }
}

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

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create authenticated Supabase client using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseAdmin = createClient(
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
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const requestBody = await req.json();
    const { type, settings }: RolloverRequest = requestBody;

    if (!type || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate settings
    if (!settings.id || !settings.start_date || !settings.end_date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required settings fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract year from settings
    const settingsYear = new Date(settings.start_date).getFullYear();
    
    // Check for existing archive based on type
    let existingArchiveQuery;
    switch (type) {
      case 'conference':
        existingArchiveQuery = await supabaseAdmin
          .from('conference_registrations_archive')
          .select('archived_at')
          .gte('archived_at', `${settingsYear}-01-01`)
          .lte('archived_at', `${settingsYear}-12-31`)
          .limit(1);
        break;
      case 'tech-conference':
        existingArchiveQuery = await supabaseAdmin
          .from('tech_conference_registrations_archive')
          .select('archived_at')
          .gte('archived_at', `${settingsYear}-01-01`)
          .lte('archived_at', `${settingsYear}-12-31`)
          .limit(1);
        break;
      case 'exhibitor':
        existingArchiveQuery = await supabaseAdmin
          .from('exhibitor_registrations_archive')
          .select('archived_at')
          .gte('archived_at', `${settingsYear}-01-01`)
          .lte('archived_at', `${settingsYear}-12-31`)
          .limit(1);
        break;
      case 'hall-of-fame':
        existingArchiveQuery = await supabaseAdmin
          .from('hall_of_fame_nominations_archive')
          .select('archived_at')
          .gte('archived_at', `${settingsYear}-01-01`)
          .lte('archived_at', `${settingsYear}-12-31`)
          .limit(1);
        break;
      case 'student-scholarship':
        existingArchiveQuery = await supabaseAdmin
          .from('student_scholarship_applications_archive')
          .select('archived_at')
          .gte('archived_at', `${settingsYear}-01-01`)
          .lte('archived_at', `${settingsYear}-12-31`)
          .limit(1);
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid rollover type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (existingArchiveQuery.error) {
      throw existingArchiveQuery.error;
    }

    if (existingArchiveQuery.data && existingArchiveQuery.data.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `A rollover for year ${settingsYear} has already been performed` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let archiveId: string | null = null;

    // Archive current data based on type
    switch (type) {
      case 'conference': {
        // Get current registrations
        const { data: registrations, error: regError } = await supabaseAdmin
          .from('conference_registrations')
          .select('*');

        if (regError) throw regError;

        if (registrations && registrations.length > 0) {
          // Generate new archive ID
          archiveId = crypto.randomUUID();

          // Insert into archive with new IDs
          const archiveData = registrations.map(reg => ({
            ...reg,
            id: crypto.randomUUID(),
            original_id: reg.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));

          const { error: archiveError } = await supabaseAdmin
            .from('conference_registrations_archive')
            .insert(archiveData);

          if (archiveError) throw archiveError;

          // Get attendees
          const { data: attendees, error: attError } = await supabaseAdmin
            .from('conference_attendees')
            .select('*');

          if (attError) throw attError;

          if (attendees && attendees.length > 0) {
            // Archive attendees with new IDs
            const attendeeArchiveData = attendees.map(att => ({
              ...att,
              id: crypto.randomUUID(),
              original_id: att.id,
              archived_at: new Date().toISOString(),
              archive_id: archiveId
            }));

            const { error: attendeesArchiveError } = await supabaseAdmin
              .from('conference_attendees_archive')
              .insert(attendeeArchiveData);

            if (attendeesArchiveError) throw attendeesArchiveError;
          }

          // Delete all records from the original tables
          const { error: deleteAttendeesError } = await supabaseAdmin
            .from('conference_attendees')
            .delete()
            .not('id', 'is', null);

          if (deleteAttendeesError) throw deleteAttendeesError;

          const { error: deleteRegistrationsError } = await supabaseAdmin
            .from('conference_registrations')
            .delete()
            .not('id', 'is', null);

          if (deleteRegistrationsError) throw deleteRegistrationsError;
        }

        // Update settings
        const { error: updateError } = await supabaseAdmin
          .from('conference_settings')
          .update({ is_active: false })
          .neq('id', settings.id);

        if (updateError) throw updateError;

        const { error: insertError } = await supabaseAdmin
          .from('conference_settings')
          .upsert({ ...settings, is_active: true });

        if (insertError) throw insertError;

        break;
      }

      case 'tech-conference': {
        // Get current registrations
        const { data: registrations, error: regError } = await supabaseAdmin
          .from('tech_conference_registrations')
          .select('*');

        if (regError) throw regError;

        if (registrations && registrations.length > 0) {
          // Generate new archive ID
          archiveId = crypto.randomUUID();

          // Insert into archive with new IDs
          const archiveData = registrations.map(reg => ({
            ...reg,
            id: crypto.randomUUID(),
            original_id: reg.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));

          const { error: archiveError } = await supabaseAdmin
            .from('tech_conference_registrations_archive')
            .insert(archiveData);

          if (archiveError) throw archiveError;

          // Get attendees
          const { data: attendees, error: attError } = await supabaseAdmin
            .from('tech_conference_attendees')
            .select('*');

          if (attError) throw attError;

          if (attendees && attendees.length > 0) {
            // Archive attendees with new IDs
            const attendeeArchiveData = attendees.map(att => ({
              ...att,
              id: crypto.randomUUID(),
              original_id: att.id,
              archived_at: new Date().toISOString(),
              archive_id: archiveId
            }));

            const { error: attendeesArchiveError } = await supabaseAdmin
              .from('tech_conference_attendees_archive')
              .insert(attendeeArchiveData);

            if (attendeesArchiveError) throw attendeesArchiveError;
          }

          // Delete all records from the original tables
          const { error: deleteAttendeesError } = await supabaseAdmin
            .from('tech_conference_attendees')
            .delete()
            .not('id', 'is', null);

          if (deleteAttendeesError) throw deleteAttendeesError;

          const { error: deleteRegistrationsError } = await supabaseAdmin
            .from('tech_conference_registrations')
            .delete()
            .not('id', 'is', null);

          if (deleteRegistrationsError) throw deleteRegistrationsError;
        }

        // Update settings
        const { error: updateError } = await supabaseAdmin
          .from('tech_conference_settings')
          .update({ is_active: false })
          .neq('id', settings.id);

        if (updateError) throw updateError;

        const { error: insertError } = await supabaseAdmin
          .from('tech_conference_settings')
          .upsert({ ...settings, is_active: true });

        if (insertError) throw insertError;

        break;
      }

      case 'exhibitor': {
        // Get current registrations
        const { data: registrations, error: regError } = await supabaseAdmin
          .from('exhibitor_registrations')
          .select('*');

        if (regError) throw regError;

        if (registrations && registrations.length > 0) {
          // Generate new archive ID
          archiveId = crypto.randomUUID();

          // Insert into archive with new IDs
          const archiveData = registrations.map(reg => ({
            ...reg,
            id: crypto.randomUUID(),
            original_id: reg.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));

          const { error: archiveError } = await supabaseAdmin
            .from('exhibitor_registrations_archive')
            .insert(archiveData);

          if (archiveError) throw archiveError;

          // Delete all records from the original table
          const { error: deleteRegistrationsError } = await supabaseAdmin
            .from('exhibitor_registrations')
            .delete()
            .not('id', 'is', null);

          if (deleteRegistrationsError) throw deleteRegistrationsError;
        }

        // Update settings
        const { error: updateError } = await supabaseAdmin
          .from('exhibitor_settings')
          .update({ is_active: false })
          .neq('id', settings.id);

        if (updateError) throw updateError;

        const { error: insertError } = await supabaseAdmin
          .from('exhibitor_settings')
          .upsert({ ...settings, is_active: true });

        if (insertError) throw insertError;

        break;
      }

      case 'hall-of-fame': {
        // Get current nominations
        const { data: nominations, error: nomError } = await supabaseAdmin
          .from('hall_of_fame_nominations')
          .select('*');

        if (nomError) throw nomError;

        if (nominations && nominations.length > 0) {
          // Generate new archive ID
          archiveId = crypto.randomUUID();

          // Insert into archive with new IDs
          const archiveData = nominations.map(nom => ({
            ...nom,
            id: crypto.randomUUID(),
            original_id: nom.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));

          const { error: archiveError } = await supabaseAdmin
            .from('hall_of_fame_nominations_archive')
            .insert(archiveData);

          if (archiveError) throw archiveError;

          // Delete all records from the original table
          const { error: deleteNominationsError } = await supabaseAdmin
            .from('hall_of_fame_nominations')
            .delete()
            .not('id', 'is', null);

          if (deleteNominationsError) throw deleteNominationsError;
        }

        // Update settings
        const { error: updateError } = await supabaseAdmin
          .from('hall_of_fame_settings')
          .update({ is_active: false })
          .neq('id', settings.id);

        if (updateError) throw updateError;

        const { error: insertError } = await supabaseAdmin
          .from('hall_of_fame_settings')
          .upsert({ ...settings, is_active: true });

        if (insertError) throw insertError;

        break;
      }

      case 'student-scholarship': {
        // Get current applications
        const { data: applications, error: appError } = await supabaseAdmin
          .from('student_scholarship_applications')
          .select('*');

        if (appError) throw appError;

        if (applications && applications.length > 0) {
          // Generate new archive ID
          archiveId = crypto.randomUUID();

          // Insert into archive with new IDs
          const archiveData = applications.map(app => ({
            ...app,
            id: crypto.randomUUID(),
            original_id: app.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));

          const { error: archiveError } = await supabaseAdmin
            .from('student_scholarship_applications_archive')
            .insert(archiveData);

          if (archiveError) throw archiveError;

          // Delete all records from the original table
          const { error: deleteApplicationsError } = await supabaseAdmin
            .from('student_scholarship_applications')
            .delete()
            .not('id', 'is', null);

          if (deleteApplicationsError) throw deleteApplicationsError;
        }

        // Update settings
        const { error: updateError } = await supabaseAdmin
          .from('student_scholarship_settings')
          .update({ is_active: false })
          .neq('id', settings.id);

        if (updateError) throw updateError;

        const { error: insertError } = await supabaseAdmin
          .from('student_scholarship_settings')
          .upsert({ ...settings, is_active: true });

        if (insertError) throw insertError;

        break;
      }
    }

    await logRolloverAction(supabaseAdmin, {
      action: 'rollover',
      user_id: user.id,
      outcome: 'success',
      type,
      archiveId,
      details: { settingsSummary: { ...settings, id: undefined, description: undefined, payment_instructions: undefined } }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        archiveId
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    
    // Create a sanitized error message
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    try {
      // Try to log the failed rollover attempt
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
      
      let type = null, settings = null;
      try {
        const body = await req.json();
        type = body.type || null;
        settings = body.settings || null;
      } catch {}
      
      await logRolloverAction(supabaseAdmin, {
        action: 'rollover',
        user_id: null,
        outcome: 'failure',
        error: errorMessage,
        type,
        details: { settingsSummary: settings }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeError(error),
      }),
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});