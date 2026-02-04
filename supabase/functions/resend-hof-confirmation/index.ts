import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';

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

// Email template for Hall of Fame nomination confirmation
function generateHofConfirmationEmail(data: {
  supervisorName: string;
  nomineeName: string;
  nomineeCity: string;
  district: string;
  region: string;
  yearsOfService: number;
  isTaptMember: boolean;
  submittedAt: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hall of Fame Nomination Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏆 TAPT Hall of Fame</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Confirmation</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.supervisorName}</strong>,</p>
        
        <p>Thank you for submitting a Hall of Fame nomination. Your nomination has been successfully received and will be reviewed by our committee.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #7c3aed; margin-top: 0;">Nomination Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Nominee:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.nomineeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">City:</td>
              <td style="padding: 8px 0;">${data.nomineeCity}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">District:</td>
              <td style="padding: 8px 0;">${data.district}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.region} Tennessee</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Years of Service:</td>
              <td style="padding: 8px 0;">${data.yearsOfService} years</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">TAPT Member:</td>
              <td style="padding: 8px 0;">${data.isTaptMember ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Submitted:</td>
              <td style="padding: 8px 0;">${data.submittedAt}</td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #7c3aed;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">Our Hall of Fame committee will review all nominations.</li>
          <li style="margin-bottom: 10px;">Selected nominees may be contacted for additional information.</li>
          <li style="margin-bottom: 10px;">Inductees will be announced and honored at the annual conference.</li>
        </ol>
        
        <p>If you have any questions about the nomination process, please contact us.</p>
        
        <p style="margin-top: 30px;">Thank you for recognizing excellence in pupil transportation!</p>
        
        <p style="color: #666;">
          Best regards,<br>
          <strong>Tennessee Association of Pupil Transportation</strong>
        </p>
      </div>
      
      <div style="background: #7c3aed; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #e0e0e0; margin: 0; font-size: 12px;">
          © ${new Date().getFullYear()} Tennessee Association of Pupil Transportation (TAPT)
        </p>
        <p style="color: #e0e0e0; margin: 5px 0 0 0; font-size: 12px;">
          <a href="https://tapt.org" style="color: #fbbf24;">www.tapt.org</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

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
    const { nominationId } = body;

    if (!nominationId) {
      return new Response(
        JSON.stringify({ error: 'Nomination ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 Resending Hall of Fame nomination confirmation for:', nominationId);

    // Fetch the nomination
    const { data: nomination, error: nomError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*')
      .eq('id', nominationId)
      .single();

    if (nomError || !nomination) {
      console.error('Nomination not found:', nomError);
      return new Response(
        JSON.stringify({ error: 'Nomination not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email data
    const emailData = {
      supervisorName: `${nomination.supervisor_first_name} ${nomination.supervisor_last_name}`,
      nomineeName: `${nomination.nominee_first_name} ${nomination.nominee_last_name}`,
      nomineeCity: nomination.nominee_city || '',
      district: nomination.district || '',
      region: nomination.region || '',
      yearsOfService: nomination.years_of_service || 0,
      isTaptMember: nomination.is_tapt_member || false,
      submittedAt: new Date(nomination.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Generate email HTML
    const emailHtml = generateHofConfirmationEmail(emailData);

    // Send the email to supervisor
    const emailResult = await sendEmail({
      to: nomination.supervisor_email,
      subject: `Hall of Fame Nomination Confirmation - ${emailData.nomineeName}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Hall of Fame nomination confirmation resent to:', nomination.supervisor_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Confirmation email sent to ${nomination.supervisor_email}` 
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
