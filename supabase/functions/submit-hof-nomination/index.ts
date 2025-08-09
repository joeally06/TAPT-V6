import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
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

interface NominationPayload {
  nominee_first_name: string;
  nominee_last_name: string;
  district: string;
  years_of_service: number;
  is_tapt_member: boolean;
  nomination_reason: string;
  supervisor_first_name: string;
  supervisor_last_name: string;
  supervisor_email: string;
  nominee_city: string;
  region: string;
  turnstileToken: string;
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role key
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

    // Get request body
    const payload: NominationPayload = await req.json();

    // Verify Turnstile token
    if (!payload.turnstileToken) {
      throw new Error('Security verification required');
    }

    try {
      const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
          response: payload.turnstileToken,
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      
      if (!turnstileResult.success) {
        throw new Error('Security verification failed');
      }
    } catch (error) {
      console.error('Turnstile verification error:', error);
      throw new Error('Security verification failed');
    }

    // Validate required fields
    const requiredFields = [
      'nominee_first_name',
      'nominee_last_name',
      'district',
      'years_of_service',
      'nomination_reason',
      'supervisor_first_name',
      'supervisor_last_name',
      'supervisor_email',
      'nominee_city',
      'region',
      'turnstileToken'
    ];

    for (const field of requiredFields) {
      if (!payload[field as keyof NominationPayload]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.supervisor_email)) {
      throw new Error('Invalid email format');
    }

    // Validate years of service
    if (payload.years_of_service < 0 || payload.years_of_service > 100) {
      throw new Error('Invalid years of service');
    }

    // Validate nomination reason length
    if (payload.nomination_reason.length > 500) {
      throw new Error('Nomination reason exceeds maximum length of 500 characters');
    }

    // Check for rate limiting
    const rateLimitKey = `nomination_${payload.supervisor_email}`;
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('count, last_attempt')
      .eq('key', rateLimitKey)
      .single();

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      if (new Date(rateLimit.last_attempt) > hourAgo && rateLimit.count >= 3) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }

      // Update rate limit
      await supabaseAdmin
        .from('rate_limits')
        .upsert({
          key: rateLimitKey,
          count: new Date(rateLimit.last_attempt) > hourAgo ? rateLimit.count + 1 : 1,
          last_attempt: now.toISOString()
        });
    } else {
      // Create new rate limit entry
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          key: rateLimitKey,
          count: 1,
          last_attempt: now.toISOString()
        });
    }

    // Check if nomination period is open
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('hall_of_fame_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError) {
      throw new Error('Failed to check nomination period');
    }

    if (!settings) {
      throw new Error('Nominations are not currently open');
    }

    const startDate = new Date(settings.start_date);
    const endDate = new Date(settings.end_date);

    if (now < startDate) {
      throw new Error(`Nominations open on ${startDate.toLocaleDateString()}`);
    }

    if (now > endDate) {
      throw new Error(`Nominations closed on ${endDate.toLocaleDateString()}`);
    }

    // Check for duplicate nominations
    const { count: existingCount, error: duplicateError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*', { count: 'exact', head: true })
      .eq('nominee_first_name', payload.nominee_first_name)
      .eq('nominee_last_name', payload.nominee_last_name)
      .eq('district', payload.district);

    if (duplicateError) {
      throw new Error('Failed to check for duplicate nominations');
    }

    if (existingCount && existingCount > 0) {
      throw new Error('A nomination for this person already exists');
    }

    // Insert nomination
    const { data, error } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .insert([{
        ...payload,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true,
        data
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
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