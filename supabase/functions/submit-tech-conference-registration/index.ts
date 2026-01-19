import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generateConferenceConfirmationEmail, generateConferenceAdminNotification } from '../_shared/emailTemplates.ts';
import type { ConferenceRegistrationData } from '../_shared/emailTemplates.ts';
import { sanitizeObject, sanitizeArray, type SanitizationRule } from '../_shared/sanitize.ts';

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

    // Define sanitization schema
    const mainRegistrationSchema: Record<string, SanitizationRule> = {
      firstName: { type: 'string', required: true, maxLength: 100 },
      lastName: { type: 'string', required: true, maxLength: 100 },
      email: { type: 'email', required: true },
      phone: { type: 'phone', required: true },
      schoolDistrict: { type: 'string', required: true, maxLength: 100 },
      streetAddress: { type: 'string', required: true, maxLength: 200 },
      city: { type: 'string', required: true, maxLength: 100 },
      state: { type: 'state', required: true },
      zipCode: { type: 'zip', required: true },
      totalAttendees: { type: 'number', required: true, min: 1, max: 20 },
      totalAmount: { type: 'number', required: true, min: 0 },
      conferenceId: { type: 'number', required: true },
      paymentMethod: { type: 'string', required: true },
      paymentStatus: { type: 'string', required: false, maxLength: 50 },
      poNumber: { type: 'string', required: false, maxLength: 100 },
      paypalTransactionId: { type: 'string', required: false, maxLength: 100 },
      paypalPayerEmail: { type: 'email', required: false },
      turnstileToken: { type: 'string', required: true }
    };

    // Sanitize main registration data
    let sanitizedData;
    try {
      sanitizedData = sanitizeObject(body, mainRegistrationSchema);
    } catch (error) {
      console.error('❌ Validation error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Validation failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Additional validation for payment method
    if (!['po', 'paypal'].includes(sanitizedData.paymentMethod || '')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payment method. Must be "po" or "paypal".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PO number if payment method is PO
    if (sanitizedData.paymentMethod === 'po' && (!sanitizedData.poNumber || !sanitizedData.poNumber.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: 'Purchase order number is required for PO payments.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize additional attendees
    const attendeeSchema: Record<string, SanitizationRule> = {
      firstName: { type: 'string', required: true, maxLength: 100 },
      lastName: { type: 'string', required: true, maxLength: 100 },
      email: { type: 'email', required: true }
    };

    let sanitizedAttendees: any[] = [];
    if (body.additionalAttendees && Array.isArray(body.additionalAttendees)) {
      try {
        sanitizeArray(body.additionalAttendees, 20);
        sanitizedAttendees = body.additionalAttendees.map((attendee: any) => 
          sanitizeObject(attendee, attendeeSchema)
        );
      } catch (error) {
        console.error('❌ Attendee validation error:', error);
        return new Response(
          JSON.stringify({ success: false, error: `Invalid attendee data: ${error instanceof Error ? error.message : 'validation failed'}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Turnstile verification
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: Missing Turnstile configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: sanitizedData.turnstileToken || '',
        remoteip: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || ''
      })
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      console.error('Turnstile verification failed:', turnstileResult);
      return new Response(
        JSON.stringify({ success: false, error: 'Security verification failed. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Rate limiting: max 3 submissions per hour per email
    const rateLimitKey = `tech_conference_registration_${sanitizedData.email}`;
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

    // Insert main registration with sanitized data
    const { data: registration, error: regError } = await supabaseAdmin
      .from('tech_conference_registrations')
      .insert([{
        school_district: sanitizedData.schoolDistrict,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        street_address: sanitizedData.streetAddress,
        city: sanitizedData.city,
        state: sanitizedData.state,
        zip_code: sanitizedData.zipCode,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        total_attendees: sanitizedData.totalAttendees,
        total_amount: sanitizedData.totalAmount,
        // Payment fields
        payment_method: sanitizedData.paymentMethod,
        payment_status: sanitizedData.paymentStatus || 'pending',
        po_number: sanitizedData.poNumber || null,
        paypal_transaction_id: sanitizedData.paypalTransactionId || null,
        paypal_payer_email: sanitizedData.paypalPayerEmail || null,
        payment_completed_at: sanitizedData.paymentStatus === 'completed' ? new Date().toISOString() : null
      }])
      .select()
      .single();

    if (regError) throw regError;

    // Insert additional attendees if any
    if (sanitizedAttendees.length > 0) {
      const attendeesToInsert = sanitizedAttendees.map((attendee: any) => ({
        registration_id: registration.id,
        first_name: attendee.firstName,
        last_name: attendee.lastName,
        email: attendee.email
      }));

      const { error: attendeesError } = await supabaseAdmin
        .from('tech_conference_attendees')
        .insert(attendeesToInsert);

      if (attendeesError) throw attendeesError;
    }

    // Get tech conference details for email
    const { data: conferenceDetails } = await supabaseAdmin
      .from('tech_conference_settings')
      .select('name, start_date, end_date, location, venue, payment_instructions')
      .limit(1)
      .single();

    // Prepare email data with sanitized values
    const emailData: ConferenceRegistrationData = {
      firstName: sanitizedData.firstName || '',
      lastName: sanitizedData.lastName || '',
      email: sanitizedData.email || '',
      schoolDistrict: sanitizedData.schoolDistrict || '',
      phone: sanitizedData.phone || '',
      streetAddress: sanitizedData.streetAddress || '',
      city: sanitizedData.city || '',
      state: sanitizedData.state || '',
      zipCode: sanitizedData.zipCode || '',
      totalAttendees: sanitizedData.totalAttendees || 0,
      totalAmount: sanitizedData.totalAmount || 0,
      conferenceName: conferenceDetails?.name || 'TAPT Tech Conference',
      conferenceDate: conferenceDetails 
        ? `${new Date(conferenceDetails.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(conferenceDetails.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` 
        : 'TBD',
      conferenceLocation: conferenceDetails 
        ? `${conferenceDetails.venue}, ${conferenceDetails.location}` 
        : 'TBD',
      paymentInstructions: conferenceDetails?.payment_instructions || 'Payment instructions will be sent separately.',
      additionalAttendees: sanitizedAttendees || [],
      // Payment fields
      paymentMethod: sanitizedData.paymentMethod || '',
      paymentStatus: sanitizedData.paymentStatus || 'pending',
      poNumber: sanitizedData.poNumber,
      paypalTransactionId: sanitizedData.paypalTransactionId,
    };

    // Send confirmation email to user
    console.log('📧 Sending confirmation email to user...');
    const userEmailResult = await sendEmail({
      to: sanitizedData.email || '',
      subject: `Registration Confirmation - ${emailData.conferenceName}`,
      html: generateConferenceConfirmationEmail(emailData)
    });

    if (!userEmailResult.success) {
      console.error('⚠️ Failed to send user confirmation email:', userEmailResult.error);
      // Don't fail the registration if email fails, just log it
    }

    // Send notification to admin(s)
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'info@tapt.org';
    console.log('📧 Sending admin notification email...');
    const adminEmailResult = await sendEmail({
      to: adminEmail,
      subject: `New Tech Conference Registration: ${sanitizedData.schoolDistrict} - ${emailData.conferenceName}`,
      html: generateConferenceAdminNotification(emailData)
    });

    if (!adminEmailResult.success) {
      console.error('⚠️ Failed to send admin notification email:', adminEmailResult.error);
    }

    console.log('✅ Tech conference registration complete with email notifications sent');

    return new Response(
      JSON.stringify({ success: true, registrationId: registration.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing registration:', error);
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});