import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generateConferenceConfirmationEmail } from '../_shared/emailTemplates.ts';
import type { ConferenceRegistrationData } from '../_shared/emailTemplates.ts';
import { fetchSettings, formatRemittanceAddressPlain } from '../_shared/settings.ts';

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
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

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userData || userData.role !== 'admin') {
      console.error('User is not admin:', { userData, roleError });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { registrationId } = body;

    if (!registrationId) {
      return new Response(
        JSON.stringify({ error: 'Registration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 Resending tech conference confirmation email for registration:', registrationId);

    // Fetch the registration with attendees
    const { data: registration, error: regError } = await supabaseAdmin
      .from('tech_conference_registrations')
      .select('*, attendees:tech_conference_attendees(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch tech conference settings
    let conferenceSettings = null;
    if (registration.tech_conference_id) {
      const { data } = await supabaseAdmin
        .from('tech_conference_settings')
        .select('*')
        .eq('id', registration.tech_conference_id)
        .single();
      conferenceSettings = data;
    }

    // If no specific conference settings, get the first active one
    if (!conferenceSettings) {
      const { data } = await supabaseAdmin
        .from('tech_conference_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      conferenceSettings = data;
    }

    // Fetch site settings for remittance address
    const siteSettings = await fetchSettings(supabaseAdmin);

    // Build email data
    const emailData: ConferenceRegistrationData = {
      firstName: registration.first_name,
      lastName: registration.last_name,
      email: registration.email,
      schoolDistrict: registration.school_district || '',
      phone: registration.phone || '',
      streetAddress: registration.street_address || '',
      city: registration.city || '',
      state: registration.state || '',
      zipCode: registration.zip_code || '',
      totalAttendees: registration.total_attendees || 1,
      totalAmount: registration.total_amount || 0,
      conferenceName: conferenceSettings?.name || conferenceSettings?.conference_name || 'TAPT Technology Conference',
      conferenceDate: conferenceSettings?.conference_date || conferenceSettings?.date || 'TBD',
      conferenceLocation: conferenceSettings?.location || 'TBD',
      paymentInstructions: conferenceSettings?.payment_instructions || 'Please submit payment as instructed.',
      paymentMethod: registration.payment_method,
      paymentStatus: registration.payment_status,
      poNumber: registration.po_number,
      paypalTransactionId: registration.paypal_transaction_id,
      remittanceAddress: formatRemittanceAddressPlain(siteSettings),
      contactEmail: siteSettings?.contact_email || 'info@tapt.org',
      contactPhone: siteSettings?.contact_phone || '',
      additionalAttendees: registration.attendees?.map((a: any) => ({
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email
      })) || [],
      billingFirstName: registration.billing_first_name || registration.first_name,
      billingLastName: registration.billing_last_name || registration.last_name,
      billingEmail: registration.billing_email || registration.email,
      registrantIsAttendee: registration.registrant_is_attendee ?? true
    };

    // Generate email HTML
    const emailHtml = generateConferenceConfirmationEmail(emailData);

    // Send the email
    const emailResult = await sendEmail({
      to: registration.email,
      subject: `Registration Confirmed - ${emailData.conferenceName}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Tech conference confirmation email resent successfully to:', registration.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Confirmation email sent to ${registration.email}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error resending confirmation email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend confirmation email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
