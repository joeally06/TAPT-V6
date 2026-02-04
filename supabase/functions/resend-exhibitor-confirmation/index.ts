import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generateExhibitorConfirmationEmail } from '../_shared/emailTemplates.ts';
import type { ExhibitorRegistrationData } from '../_shared/emailTemplates.ts';
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

    console.log('📧 Resending exhibitor confirmation email for registration:', registrationId);

    // Fetch the registration with participants
    const { data: registration, error: regError } = await supabaseAdmin
      .from('exhibitor_registrations')
      .select('*, participants:exhibitor_participants(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch conference settings
    let conferenceSettings = null;
    const { data: settings } = await supabaseAdmin
      .from('conference_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    conferenceSettings = settings;

    // Fetch site settings for remittance address
    const siteSettings = await fetchSettings(supabaseAdmin);

    // Build email data
    const emailData: ExhibitorRegistrationData = {
      companyName: registration.business_name || '',
      contactFirstName: registration.first_name || '',
      contactLastName: registration.last_name || '',
      email: registration.email || '',
      phone: registration.phone || '',
      streetAddress: registration.street_address + (registration.street_address2 ? `, ${registration.street_address2}` : ''),
      city: registration.city || '',
      state: registration.state || '',
      zipCode: registration.zip_code || '',
      boothSize: registration.booth_requirements || 'Standard',
      totalAmount: registration.exhibitor_fee || 0,
      conferenceName: conferenceSettings?.name || 'TAPT Conference',
      conferenceDate: conferenceSettings?.start_date && conferenceSettings?.end_date
        ? `${new Date(conferenceSettings.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(conferenceSettings.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        : 'TBD',
      conferenceLocation: conferenceSettings?.venue && conferenceSettings?.location 
        ? `${conferenceSettings.venue}, ${conferenceSettings.location}` 
        : (conferenceSettings?.location || 'TBD'),
      paymentInstructions: conferenceSettings?.payment_instructions || 'Payment instructions will be sent separately.',
      exhibitorOptions: registration.products_description ? [registration.products_description] : [],
      paymentMethod: registration.payment_method || '',
      paymentStatus: registration.payment_status || 'pending',
      poNumber: registration.po_number,
      paypalTransactionId: registration.paypal_transaction_id,
      remittanceAddress: formatRemittanceAddressPlain(siteSettings),
      contactEmail: siteSettings?.payment_contact_email || 'info@tapt.org',
      contactPhone: siteSettings?.payment_contact_phone || '',
      participants: registration.participants?.map((p: any) => ({
        firstName: p.first_name,
        lastName: p.last_name,
        role: p.role || null
      })) || []
    };

    // Generate email HTML
    const emailHtml = generateExhibitorConfirmationEmail(emailData);

    // Send the email
    const emailResult = await sendEmail({
      to: registration.email,
      subject: `Exhibitor Registration Confirmation - ${emailData.conferenceName}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Exhibitor confirmation email resent successfully to:', registration.email);

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
