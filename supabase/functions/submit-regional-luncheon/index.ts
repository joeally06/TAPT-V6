import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sanitizeObject, type SanitizationRule } from '../_shared/sanitize.ts';
import { sendEmail } from '../_shared/email.ts';
import { generateRegionalLuncheonConfirmationEmail, type RegionalLuncheonRegistrationData } from '../_shared/emailTemplates.ts';

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
    console.log('📝 Received regional luncheon registration data:', {
      ...body,
      turnstileToken: body.turnstileToken ? `Token present (${body.turnstileToken.length} chars)` : 'MISSING'
    });
    
    // Verify Turnstile token
    if (!body.turnstileToken) {
      console.error('❌ Missing Turnstile token');
      return new Response(
        JSON.stringify({ error: 'Security verification required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      console.error('❌ Turnstile secret key not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify Turnstile token with Cloudflare
    const turnstileResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: body.turnstileToken,
          remoteip: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')
        })
      }
    );

    const turnstileResult = await turnstileResponse.json();
    console.log('🔒 Turnstile verification result:', turnstileResult);

    if (!turnstileResult.success) {
      console.error('❌ Turnstile verification failed:', turnstileResult);
      return new Response(
        JSON.stringify({ 
          error: 'Security verification failed. Please try again.',
          details: turnstileResult['error-codes']
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Turnstile verification successful');
    
    // Define sanitization schema
    const registrationSchema: Record<string, SanitizationRule> = {
      name: { type: 'string', required: true, maxLength: 200 },
      email: { type: 'email', required: true, maxLength: 255 },
      districtOrganization: { type: 'string', required: true, maxLength: 200 },
      numberOfAttendees: { type: 'number', required: true, min: 1, max: 3 },
      preferredRegion: { 
        type: 'string', 
        required: true, 
        allowedValues: ['West Region', 'Middle Region', 'Cookeville Region', 'Greeneville Region', 'East Region'] 
      },
      eventId: { type: 'string', required: false, maxLength: 100 }
    };

    console.log('🧹 Sanitizing registration data...');
    const sanitizedData = sanitizeObject(body, registrationSchema);
    console.log('✅ Data sanitized:', { ...sanitizedData, email: sanitizedData.email ? '[REDACTED]' : undefined });

    // Insert registration into database
    const { data: registration, error: insertError } = await supabaseAdmin
      .from('regional_luncheon_registrations')
      .insert([{
        name: sanitizedData.name,
        email: sanitizedData.email,
        district_organization: sanitizedData.districtOrganization,
        number_of_attendees: sanitizedData.numberOfAttendees,
        preferred_region: sanitizedData.preferredRegion,
        event_id: sanitizedData.eventId || null
      }])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save registration. Please try again.',
          details: insertError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Registration saved successfully:', registration.id);

    // Fetch event settings to get event details and regional dates
    let eventSettings = null;
    if (sanitizedData.eventId) {
      const { data, error } = await supabaseAdmin
        .from('regional_luncheon_settings')
        .select('*')
        .eq('id', sanitizedData.eventId)
        .eq('is_active', true)
        .single();
      
      if (!error && data) {
        eventSettings = data;
        console.log('📅 Event settings retrieved:', { id: data.id, event_name: data.event_name });
      } else {
        console.warn('⚠️ Could not retrieve event settings:', error?.message);
      }
    }

    // Send confirmation email
    try {
      console.log('📧 Preparing confirmation email...');
      
      // Find the matching regional date info
      let regionalDate = '';
      let regionalTime = '';
      let regionalVenue = '';
      
      if (eventSettings?.regional_dates) {
        const regionalDates = Array.isArray(eventSettings.regional_dates) 
          ? eventSettings.regional_dates 
          : [];
        
        const matchingRegion = regionalDates.find(
          (r: any) => r.region === sanitizedData.preferredRegion
        );
        
        if (matchingRegion) {
          regionalDate = matchingRegion.date || '';
          regionalTime = matchingRegion.time || '';
          regionalVenue = matchingRegion.venue || '';
          console.log('📍 Found regional info:', { region: sanitizedData.preferredRegion, date: regionalDate });
        }
      }

      const emailData: RegionalLuncheonRegistrationData = {
        name: sanitizedData.name,
        email: sanitizedData.email,
        districtOrganization: sanitizedData.districtOrganization,
        numberOfAttendees: sanitizedData.numberOfAttendees,
        preferredRegion: sanitizedData.preferredRegion,
        eventName: eventSettings?.event_name || 'TAPT Regional Luncheon',
        registrationDeadline: eventSettings?.registration_deadline || 'TBD',
        regionalDate,
        regionalTime,
        regionalVenue
      };

      const emailHtml = generateRegionalLuncheonConfirmationEmail(emailData);
      
      await sendEmail({
        to: sanitizedData.email,
        subject: `Registration Confirmed - ${emailData.eventName}`,
        html: emailHtml
      });

      console.log('✅ Confirmation email sent successfully');
    } catch (emailError) {
      // Log email error but don't fail the registration
      console.error('❌ Failed to send confirmation email:', emailError);
      console.log('⚠️ Registration was saved but email failed - user may need manual notification');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Registration submitted successfully!',
        id: registration.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error processing regional luncheon registration:', error);
    
    // Sanitize error message
    const errorMessage = error instanceof Error 
      ? error.message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      : 'An unexpected error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process registration',
        message: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
