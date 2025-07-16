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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

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

    const body = await req.json();
    // Enhanced validation for conference registration
    const errors: string[] = [];
    if (!body.firstName || typeof body.firstName !== 'string' || body.firstName.length > 100) {
      errors.push('First name is required and must be less than 100 characters.');
    }
    if (!body.lastName || typeof body.lastName !== 'string' || body.lastName.length > 100) {
      errors.push('Last name is required and must be less than 100 characters.');
    }
    if (!body.email || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push('A valid email is required.');
    }
    if (!body.phone || typeof body.phone !== 'string' || !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(body.phone.replace(/\s/g, ''))) {
      errors.push('A valid phone number is required.');
    }
    if (!body.schoolDistrict || typeof body.schoolDistrict !== 'string' || body.schoolDistrict.length > 100) {
      errors.push('School district/organization is required and must be less than 100 characters.');
    }
    if (!body.streetAddress || typeof body.streetAddress !== 'string' || body.streetAddress.length > 200) {
      errors.push('Street address is required and must be less than 200 characters.');
    }
    if (!body.city || typeof body.city !== 'string' || body.city.length > 100) {
      errors.push('City is required and must be less than 100 characters.');
    }
    if (!body.state || typeof body.state !== 'string' || body.state.length !== 2) {
      errors.push('State is required and must be a 2-letter code.');
    }
    if (!body.zipCode || typeof body.zipCode !== 'string' || !/^\d{5}(-\d{4})?$/.test(body.zipCode)) {
      errors.push('A valid ZIP code is required.');
    }
    if (!body.totalAttendees || typeof body.totalAttendees !== 'number' || body.totalAttendees < 1 || body.totalAttendees > 20) {
      errors.push('Total attendees must be between 1 and 20.');
    }
    if (!body.turnstileToken || typeof body.turnstileToken !== 'string') {
      errors.push('Security verification is required.');
    }
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: errors.join(' ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Turnstile token
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      throw new Error('Server configuration error: Missing Turnstile configuration');
    }

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: body.turnstileToken,
        remoteip: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || ''
      })
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      console.error('Turnstile verification failed:', turnstileResult);
      throw new Error('Security verification failed. Please try again.');
    }

    // Rate limiting: max 3 submissions per hour per email
    const rateLimitKey = `conference_registration_${body.email}`;
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('count, last_attempt')
      .eq('key', rateLimitKey)
      .single();

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      if (new Date(rateLimit.last_attempt) > hourAgo && rateLimit.count >= 3) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await supabaseAdmin
        .from('rate_limits')
        .upsert({
          key: rateLimitKey,
          count: new Date(rateLimit.last_attempt) > hourAgo ? rateLimit.count + 1 : 1,
          last_attempt: now.toISOString()
        });
    } else {
      await supabaseAdmin
        .from('rate_limits')
        .insert({
          key: rateLimitKey,
          count: 1,
          last_attempt: now.toISOString()
        });
    }

    // Insert main registration
    const { data: registration, error: regError } = await supabaseAdmin
      .from('conference_registrations')
      .insert([{
        school_district: body.schoolDistrict,
        first_name: body.firstName,
        last_name: body.lastName,
        street_address: body.streetAddress,
        city: body.city,
        state: body.state,
        zip_code: body.zipCode,
        email: body.email,
        phone: body.phone,
        total_attendees: body.totalAttendees,
        total_amount: body.totalAmount,
        conference_id: body.conferenceId
      }])
      .select()
      .single();

    if (regError) throw regError;

    // Insert additional attendees if any
    if (body.additionalAttendees && body.additionalAttendees.length > 0) {
      const { error: attendeesError } = await supabaseAdmin
        .from('conference_attendees')
        .insert(
          body.additionalAttendees.map((attendee: any) => ({
            registration_id: registration.id,
            first_name: attendee.firstName,
            last_name: attendee.lastName,
            email: attendee.email
          }))
        );
      if (attendeesError) throw attendeesError;
    }

    return new Response(
      JSON.stringify({ success: true, registrationId: registration.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Sanitize error before returning to client
    const errorMap: Record<string, string> = {
      '23505': 'A record with this information already exists.',
      '22P02': 'Invalid input format.',
      '23503': 'Related record not found.',
      '23514': 'Input does not meet requirements.'
    };
    let message = 'An unexpected error occurred. Please try again.';
    if (error && typeof error === 'object') {
      if (error.code && errorMap[error.code]) message = errorMap[error.code];
      else if (error.message && errorMap[error.message]) message = errorMap[error.message];
    }
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});