import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generateExhibitorConfirmationEmail, generateExhibitorAdminNotification } from '../_shared/emailTemplates.ts';
import type { ExhibitorRegistrationData } from '../_shared/emailTemplates.ts';
import { sanitizeObject, type SanitizationRule } from '../_shared/sanitize.ts';

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
  
  return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
};

interface ExhibitorRegistration {
  businessName: string;
  firstName: string;
  lastName: string;
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  state: string;
  zipCode: string;
  email: string;
  phone: string;
  mobilePhone?: string;
  boothRequirements?: string;
  productsDescription?: string;
  additionalComments?: string;
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
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    console.log("Processing exhibitor registration submission");
    
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      throw new Error('Server configuration error: Missing required environment variables');
    }

    // Create Supabase client with service role key
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

    // Parse request body
    let payload: any;
    try {
      payload = await req.json();
      console.log("Received payload:", JSON.stringify({
        businessName: payload.businessName,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        // Omit other fields for privacy in logs
      }));
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format: Unable to parse JSON');
    }

    // Define sanitization schema
    const exhibitorSchema: Record<string, SanitizationRule> = {
      businessName: { type: 'string', required: true, maxLength: 200 },
      firstName: { type: 'string', required: true, maxLength: 100 },
      lastName: { type: 'string', required: true, maxLength: 100 },
      streetAddress: { type: 'string', required: true, maxLength: 200 },
      streetAddress2: { type: 'string', required: false, maxLength: 200 },
      city: { type: 'string', required: true, maxLength: 100 },
      state: { type: 'state', required: true },
      zipCode: { type: 'zip', required: true },
      email: { type: 'email', required: true },
      phone: { type: 'phone', required: true },
      mobilePhone: { type: 'phone', required: false },
      boothRequirements: { type: 'string', required: false, maxLength: 1000 },
      productsDescription: { type: 'string', required: false, maxLength: 2000 },
      additionalComments: { type: 'string', required: false, maxLength: 2000 },
      website: { type: 'url', required: false },
      exhibitorFee: { type: 'number', required: true, min: 0 },
      paymentMethod: { type: 'string', required: true },
      paymentStatus: { type: 'string', required: false, maxLength: 50 },
      poNumber: { type: 'string', required: false, maxLength: 100 },
      paypalTransactionId: { type: 'string', required: false, maxLength: 100 },
      paypalPayerEmail: { type: 'email', required: false },
      turnstileToken: { type: 'string', required: true }
    };

    // Sanitize payload
    let sanitizedData;
    try {
      sanitizedData = sanitizeObject(payload, exhibitorSchema);
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

    // Verify Turnstile token
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      throw new Error('Server configuration error: Missing Turnstile configuration');
    }

    console.log('🔒 Verifying Turnstile token:', {
      tokenLength: sanitizedData.turnstileToken?.length,
      tokenPreview: sanitizedData.turnstileToken?.substring(0, 20) + '...',
      origin: origin
    });

    // Build Turnstile verification params
    // Note: We intentionally do NOT include remoteip as it can cause false negatives
    // when the IP seen by Turnstile widget differs from the IP seen by Supabase edge function
    const turnstileParams = new URLSearchParams({
      secret: turnstileSecret,
      response: sanitizedData.turnstileToken || '',
    });

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: turnstileParams
    });

    const turnstileResult = await turnstileResponse.json();
    console.log('🔒 Turnstile verification result:', JSON.stringify(turnstileResult));
    
    if (!turnstileResult.success) {
      // Log detailed error info for debugging
      const errorCodes = turnstileResult['error-codes'] || [];
      console.error('❌ Turnstile verification failed:', {
        errorCodes,
        success: turnstileResult.success,
        challengeTs: turnstileResult.challenge_ts,
        hostname: turnstileResult.hostname
      });
      
      // Provide more specific error messages based on error codes
      let errorMessage = 'Security verification failed. Please try again.';
      if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'Security token expired or already used. Please refresh the page and try again.';
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'Invalid security token. Please complete the security check again.';
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'Security verification request failed. Please try again.';
      }
      
      throw new Error(errorMessage);
    }
    
    console.log('✅ Turnstile verification successful')

    // Check for rate limiting
    const rateLimitKey = `exhibitor_registration_${sanitizedData.email}`;
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

    // Check if registration period is open
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('exhibitor_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError) {
      throw new Error('Failed to check registration period');
    }

    if (!settings) {
      throw new Error('Exhibitor registration is not currently open');
    }

    // Check if registration deadline has passed
    const registrationEndDate = new Date(settings.registration_end_date);

    if (now > registrationEndDate) {
      throw new Error(`Registration closed on ${registrationEndDate.toLocaleDateString()}`);
    }

    // Insert registration with sanitized data
    const { data, error } = await supabaseAdmin
      .from('exhibitor_registrations')
      .insert([{
        business_name: sanitizedData.businessName,
        first_name: sanitizedData.firstName,
        last_name: sanitizedData.lastName,
        street_address: sanitizedData.streetAddress,
        street_address2: sanitizedData.streetAddress2 || null,
        city: sanitizedData.city,
        state: sanitizedData.state,
        zip_code: sanitizedData.zipCode,
        email: sanitizedData.email,
        phone: sanitizedData.phone,
        mobile_phone: sanitizedData.mobilePhone || null,
        booth_requirements: sanitizedData.boothRequirements || null,
        products_description: sanitizedData.productsDescription || null,
        additional_comments: sanitizedData.additionalComments || null,
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

    if (error) throw error;

    // Prepare email data with sanitized values
    const emailData: ExhibitorRegistrationData = {
      companyName: sanitizedData.businessName || '',
      contactFirstName: sanitizedData.firstName || '',
      contactLastName: sanitizedData.lastName || '',
      email: sanitizedData.email || '',
      phone: sanitizedData.phone || '',
      streetAddress: sanitizedData.streetAddress + (sanitizedData.streetAddress2 ? `, ${sanitizedData.streetAddress2}` : ''),
      city: sanitizedData.city || '',
      state: sanitizedData.state || '',
      zipCode: sanitizedData.zipCode || '',
      boothSize: sanitizedData.boothRequirements || 'Standard',
      totalAmount: sanitizedData.exhibitorFee || 0,
      conferenceName: settings?.name || 'TAPT Conference',
      conferenceDate: settings?.registration_start_date && settings?.registration_end_date
        ? `${new Date(settings.registration_start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(settings.registration_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : 'TBD',
      conferenceLocation: settings?.location || 'TBD',
      paymentInstructions: settings?.payment_instructions || 'Payment instructions will be sent separately.',
      exhibitorOptions: sanitizedData.productsDescription ? [sanitizedData.productsDescription] : [],
      // Payment fields
      paymentMethod: sanitizedData.paymentMethod || '',
      paymentStatus: sanitizedData.paymentStatus || 'pending',
      poNumber: sanitizedData.poNumber,
      paypalTransactionId: sanitizedData.paypalTransactionId,
    };

    // Send confirmation email to exhibitor
    console.log('📧 Sending confirmation email to exhibitor...');
    const userEmailResult = await sendEmail({
      to: sanitizedData.email || '',
      subject: `Exhibitor Registration Confirmation - ${emailData.conferenceName}`,
      html: generateExhibitorConfirmationEmail(emailData)
    });

    if (!userEmailResult.success) {
      console.error('⚠️ Failed to send exhibitor confirmation email:', userEmailResult.error);
      // Don't fail the registration if email fails, just log it
    }

    // Send notification to admin(s)
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'info@tapt.org';
    console.log('📧 Sending admin notification email...');
    const adminEmailResult = await sendEmail({
      to: adminEmail,
      subject: `New Exhibitor Registration: ${sanitizedData.businessName} - ${emailData.conferenceName}`,
      html: generateExhibitorAdminNotification(emailData)
    });

    if (!adminEmailResult.success) {
      console.error('⚠️ Failed to send admin notification email:', adminEmailResult.error);
    }

    console.log('✅ Exhibitor registration complete with email notifications sent');

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: null, // No user for public submissions
        action: 'submit_exhibitor_registration',
        outcome: 'success',
        details: { registration_id: data.id }
      }]);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("Error logging action:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          id: data.id,
          created_at: data.created_at
        }
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error("Error in submit-exhibitor-registration function:", error);
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