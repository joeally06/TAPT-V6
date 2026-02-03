import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generateConferenceConfirmationEmail, generateConferenceAdminNotification } from '../_shared/emailTemplates.ts';
import type { ConferenceRegistrationData } from '../_shared/emailTemplates.ts';
import { sanitizeObject, sanitizeArray, type SanitizationRule } from '../_shared/sanitize.ts';
import { fetchSettings, formatRemittanceAddressPlain } from '../_shared/settings.ts';

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
    console.log('📝 Received registration data:', {
      ...body,
      turnstileToken: body.turnstileToken ? `Token present (${body.turnstileToken.length} chars)` : 'MISSING'
    });
    
    // Define sanitization schema
    const mainRegistrationSchema: Record<string, SanitizationRule> = {
      // Billing contact fields
      billingFirstName: { type: 'string', required: true, maxLength: 100 },
      billingLastName: { type: 'string', required: true, maxLength: 100 },
      billingEmail: { type: 'email', required: true },
      billingPhone: { type: 'phone', required: true },
      registrantIsAttendee: { type: 'boolean', required: true },
      // Legacy fields (mapped from billing for backwards compatibility)
      firstName: { type: 'string', required: false, maxLength: 100 },
      lastName: { type: 'string', required: false, maxLength: 100 },
      email: { type: 'email', required: false },
      phone: { type: 'phone', required: false },
      // Primary attendee fields (when registrant is NOT attending)
      primaryAttendeeFirstName: { type: 'string', required: false, maxLength: 100 },
      primaryAttendeeLastName: { type: 'string', required: false, maxLength: 100 },
      primaryAttendeeEmail: { type: 'email', required: false },
      primaryAttendeeSchoolDistrict: { type: 'string', required: false, maxLength: 100 },
      // Other fields
      schoolDistrict: { type: 'string', required: false, maxLength: 100 },
      streetAddress: { type: 'string', required: true, maxLength: 200 },
      city: { type: 'string', required: true, maxLength: 100 },
      state: { type: 'state', required: true },
      zipCode: { type: 'zip', required: true },
      totalAttendees: { type: 'number', required: true, min: 1, max: 20 },
      totalAmount: { type: 'number', required: true, min: 0 },
      conferenceId: { type: 'uuid', required: true },
      paymentMethod: { type: 'string', required: true },
      paymentStatus: { type: 'string', required: false, maxLength: 50 },
      poNumber: { type: 'string', required: false, maxLength: 100 },
      paypalTransactionId: { type: 'string', required: false, maxLength: 100 },
      paypalPayerEmail: { type: 'email', required: false },
      turnstileToken: { type: 'token', required: true, maxLength: 2000 }
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
        response: sanitizedData.turnstileToken || '',
        remoteip: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || ''
      })
    });

    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      console.error('Turnstile verification failed:', turnstileResult);
      throw new Error('Security verification failed. Please try again.');
    }

    // Rate limiting: max 3 submissions per hour per email
    const rateLimitKey = `conference_registration_${sanitizedData.billingEmail}`;
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
    // Determine the effective school district (from registrant if attending, or from primary attendee)
    const effectiveSchoolDistrict = sanitizedData.registrantIsAttendee 
      ? sanitizedData.schoolDistrict 
      : sanitizedData.primaryAttendeeSchoolDistrict;
    
    // For backwards compatibility, use billing info as the primary contact
    const effectiveFirstName = sanitizedData.registrantIsAttendee 
      ? sanitizedData.billingFirstName 
      : sanitizedData.primaryAttendeeFirstName;
    const effectiveLastName = sanitizedData.registrantIsAttendee 
      ? sanitizedData.billingLastName 
      : sanitizedData.primaryAttendeeLastName;
    const effectiveEmail = sanitizedData.registrantIsAttendee 
      ? sanitizedData.billingEmail 
      : sanitizedData.primaryAttendeeEmail;
    
    const { data: registration, error: regError } = await supabaseAdmin
      .from('conference_registrations')
      .insert([{
        school_district: effectiveSchoolDistrict,
        first_name: effectiveFirstName,
        last_name: effectiveLastName,
        street_address: sanitizedData.streetAddress,
        city: sanitizedData.city,
        state: sanitizedData.state,
        zip_code: sanitizedData.zipCode,
        email: effectiveEmail,
        phone: sanitizedData.billingPhone,
        total_attendees: sanitizedData.totalAttendees,
        total_amount: sanitizedData.totalAmount,
        conference_id: sanitizedData.conferenceId,
        // Billing contact fields
        billing_first_name: sanitizedData.billingFirstName,
        billing_last_name: sanitizedData.billingLastName,
        billing_email: sanitizedData.billingEmail,
        billing_phone: sanitizedData.billingPhone,
        registrant_is_attendee: sanitizedData.registrantIsAttendee,
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
      const { error: attendeesError } = await supabaseAdmin
        .from('conference_attendees')
        .insert(
          sanitizedAttendees.map((attendee: any) => ({
            registration_id: registration.id,
            first_name: attendee.firstName,
            last_name: attendee.lastName,
            email: attendee.email
          }))
        );
      if (attendeesError) throw attendeesError;
    }

    // Get conference details for email
    const { data: conferenceDetails } = await supabaseAdmin
      .from('conference_settings')
      .select('name, start_date, end_date, location, venue, payment_instructions')
      .eq('id', sanitizedData.conferenceId)
      .single();

    // Fetch site settings for remittance address
    console.log('⚙️ Fetching site settings...');
    const settings = await fetchSettings(supabaseAdmin);

    // Prepare email data with sanitized values
    const emailData: ConferenceRegistrationData = {
      firstName: effectiveFirstName || '',
      lastName: effectiveLastName || '',
      email: effectiveEmail || '',
      schoolDistrict: effectiveSchoolDistrict || '',
      phone: sanitizedData.billingPhone || '',
      streetAddress: sanitizedData.streetAddress || '',
      city: sanitizedData.city || '',
      state: sanitizedData.state || '',
      zipCode: sanitizedData.zipCode || '',
      totalAttendees: sanitizedData.totalAttendees || 0,
      totalAmount: sanitizedData.totalAmount || 0,
      conferenceName: conferenceDetails?.name || 'TAPT Annual Conference',
      conferenceDate: conferenceDetails 
        ? `${new Date(conferenceDetails.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(conferenceDetails.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` 
        : 'TBD',
      paymentMethod: sanitizedData.paymentMethod || '',
      paymentStatus: sanitizedData.paymentStatus || 'pending',
      poNumber: sanitizedData.poNumber,
      paypalTransactionId: sanitizedData.paypalTransactionId,
      conferenceLocation: conferenceDetails 
        ? `${conferenceDetails.venue}, ${conferenceDetails.location}` 
        : 'TBD',
      paymentInstructions: conferenceDetails?.payment_instructions || 'Payment instructions will be sent separately.',
      additionalAttendees: sanitizedAttendees || [],
      remittanceAddress: formatRemittanceAddressPlain(settings),
      contactEmail: settings.payment_contact_email,
      contactPhone: settings.payment_contact_phone,
      // Billing contact info for email template
      billingFirstName: sanitizedData.billingFirstName || '',
      billingLastName: sanitizedData.billingLastName || '',
      billingEmail: sanitizedData.billingEmail || '',
      registrantIsAttendee: sanitizedData.registrantIsAttendee
    };

    // Send confirmation/invoice email to billing contact
    console.log('📧 Sending invoice email to billing contact:', sanitizedData.billingEmail);
    const billingEmailResult = await sendEmail({
      to: sanitizedData.billingEmail || '',
      subject: `Registration Invoice - ${emailData.conferenceName}`,
      html: generateConferenceConfirmationEmail(emailData)
    });

    if (!billingEmailResult.success) {
      console.error('⚠️ Failed to send billing confirmation email:', billingEmailResult.error);
    }

    // Build list of all attendees who need event details emails
    const allAttendeeEmails: { email: string; firstName: string; lastName: string }[] = [];
    
    // If registrant is attending, they're the primary attendee (already got billing email)
    // If registrant is NOT attending, add the primary attendee
    if (!sanitizedData.registrantIsAttendee && sanitizedData.primaryAttendeeEmail) {
      allAttendeeEmails.push({
        email: sanitizedData.primaryAttendeeEmail,
        firstName: sanitizedData.primaryAttendeeFirstName || '',
        lastName: sanitizedData.primaryAttendeeLastName || ''
      });
    }
    
    // Add all additional attendees
    for (const attendee of sanitizedAttendees) {
      // Skip if this email is the same as the billing email (they already got the invoice)
      if (attendee.email && attendee.email.toLowerCase() !== sanitizedData.billingEmail?.toLowerCase()) {
        allAttendeeEmails.push({
          email: attendee.email,
          firstName: attendee.firstName || '',
          lastName: attendee.lastName || ''
        });
      }
    }
    
    // Send event details emails to all attendees who aren't the billing contact
    for (const attendee of allAttendeeEmails) {
      console.log(`📧 Sending event details email to attendee: ${attendee.email}`);
      const attendeeEmailResult = await sendEmail({
        to: attendee.email,
        subject: `You're Registered! - ${emailData.conferenceName}`,
        html: generateConferenceConfirmationEmail({
          ...emailData,
          firstName: attendee.firstName,
          lastName: attendee.lastName,
          email: attendee.email
        })
      });
      
      if (!attendeeEmailResult.success) {
        console.error(`⚠️ Failed to send attendee email to ${attendee.email}:`, attendeeEmailResult.error);
      }
    }

    // Send notification to admin(s) - use admin_notification_email from site settings
    const adminEmail = settings.admin_notification_email || 'info@tapt.org';
    console.log(`📧 Sending admin notification email to: ${adminEmail}...`);
    const adminEmailResult = await sendEmail({
      to: adminEmail,
      subject: `New Registration: ${effectiveSchoolDistrict} - ${emailData.conferenceName}`,
      html: generateConferenceAdminNotification(emailData)
    });

    if (!adminEmailResult.success) {
      console.error('⚠️ Failed to send admin notification email:', adminEmailResult.error);
    }

    console.log('✅ Registration complete with email notifications sent');

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