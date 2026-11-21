import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendEmail } from '../_shared/email.ts';
import { generatePaymentReceiptEmail, type PaymentReceiptData } from '../_shared/emailTemplates.ts';
import { sanitizeString, sanitizeUuid } from '../_shared/sanitize.ts';
import { fetchSettings, formatRemittanceAddressPlain } from '../_shared/settings.ts';

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://localhost:5173'
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

console.log('🚀 Send Payment Receipt function initialized');

// The event name comes from the settings table and is placed inside the email HTML
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "October 1, 2026 - October 3, 2026" (or one date when the event is a single day)
const formatEventDates = (start?: string | null, end?: string | null): string => {
  if (!start) return '';
  const format = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return end && end !== start ? `${format(start)} - ${format(end)}` : format(start);
};

Deno.serve(async (req) => {
  // Handle CORS preflight immediately
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const origin = req.headers.get('origin') || req.headers.get('Origin') || '';
  
  console.log('📨 Incoming request from origin:', origin);
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes(origin);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('📧 Processing payment receipt email request...');

    // Get request body
    const body = await req.json();
    console.log('📥 Received request:', { 
      registrationId: body.registrationId,
      registrationType: body.registrationType 
    });

    // Validate required fields
    if (!body.registrationId || !body.registrationType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: registrationId and registrationType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const registrationId = sanitizeUuid(body.registrationId);
    const registrationType = sanitizeString(body.registrationType, 50);

    // Validate registration type
    if (!['conference', 'tech_conference', 'exhibitor'].includes(registrationType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid registration type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase Admin Client (to bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Determine table name
    const tableName = registrationType === 'conference'
      ? 'conference_registrations'
      : registrationType === 'tech_conference'
      ? 'tech_conference_registrations'
      : 'exhibitor_registrations';

    console.log(`🔍 Fetching registration from ${tableName}...`);

    // Fetch registration data
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      console.error('❌ Registration not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment is completed
    if (registration.payment_status !== 'completed') {
      console.error('❌ Payment not completed:', registration.payment_status);
      return new Response(
        JSON.stringify({ error: 'Payment must be completed before sending receipt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify it was a PO payment
    if (registration.payment_method !== 'po') {
      console.error('❌ Not a PO payment:', registration.payment_method);
      return new Response(
        JSON.stringify({ error: 'Receipts are only sent for purchase order payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Registration found and verified');

    // Fetch dynamic settings from database
    console.log('⚙️ Fetching site settings...');
    const settings = await fetchSettings(supabaseAdmin);
    console.log('✅ Settings loaded:', Object.keys(settings).length, 'settings found');

    // Event details for the receipt (optional: a failed lookup never blocks the email).
    // A conference registration records which settings row it belongs to. Tech conference and exhibitor
    // registrations do not, so they use the settings that are active now (the current cycle).
    let conferenceName = '';
    let conferenceDate = '';

    const eventTable =
      registrationType === 'conference'
        ? 'conference_settings'
        : registrationType === 'tech_conference'
        ? 'tech_conference_settings'
        : 'exhibitor_settings';

    let eventQuery = supabaseAdmin.from(eventTable).select('name, start_date, end_date');
    eventQuery = registrationType === 'conference' && registration.conference_id
      ? eventQuery.eq('id', registration.conference_id)
      : eventQuery.eq('is_active', true);
    const { data: eventSettings, error: eventError } = await eventQuery.maybeSingle();

    if (eventError) {
      console.warn('⚠️ Could not load event details for the receipt:', eventError.message);
    } else if (eventSettings) {
      conferenceName = escapeHtml(eventSettings.name || '');
      conferenceDate = formatEventDates(eventSettings.start_date, eventSettings.end_date);
    }

    // Prepare email data with dynamic settings
    const emailData: PaymentReceiptData = {
      registrationType: registrationType as 'conference' | 'tech_conference' | 'exhibitor',
      firstName: registration.first_name,
      lastName: registration.last_name,
      email: registration.email,
      schoolDistrict: registration.school_district,
      businessName: registration.business_name,
      poNumber: registration.po_number || '',
      totalAmount: registration.total_amount || 0,
      paymentCompletedAt: registration.payment_completed_at || new Date().toISOString(),
      conferenceName,
      conferenceDate,
      // Include dynamic settings
      remittanceAddress: formatRemittanceAddressPlain(settings),
      contactEmail: settings.payment_contact_email,
      contactPhone: settings.payment_contact_phone,
      organizationName: settings.site_organization_name,
      footerMessage: settings.payment_receipt_footer
    };

    console.log('📧 Generating email template...');

    // Generate email HTML
    const emailHtml = generatePaymentReceiptEmail(emailData);

    // Send email
    console.log(`📧 Sending payment receipt to ${emailData.email}...`);
    
    const emailResult = await sendEmail({
      to: emailData.email,
      subject: `Payment Receipt - ${emailData.firstName} ${emailData.lastName} (PO: ${emailData.poNumber})`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('❌ Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send payment receipt email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Payment receipt email sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment receipt email sent successfully',
        recipient: emailData.email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
