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

// Email template for nominator confirmation
function generateNominatorConfirmationEmail(data: {
  nominatorName: string;
  nominatorTitle: string;
  nominatorDistrict: string;
  studentName: string;
  studentHighSchool: string;
  region: string;
  submittedAt: string;
  scholarshipName: string;
  deadline: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scholarship Nomination Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">TAPT Student Scholarship</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Confirmation</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for submitting a scholarship nomination on behalf of your student. Your nomination has been successfully received and recorded.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #1e3a5f; margin-top: 0;">Nomination Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Scholarship:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.scholarshipName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Student Name:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">High School:</td>
              <td style="padding: 8px 0;">${data.studentHighSchool}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.region} Tennessee</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Submitted:</td>
              <td style="padding: 8px 0;">${data.submittedAt}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1e3a5f;">
          <h3 style="color: #1e3a5f; margin-top: 0;">Nominator Information</h3>
          <p style="margin: 5px 0;"><strong>${data.nominatorName}</strong></p>
          <p style="margin: 5px 0; color: #666;">${data.nominatorTitle}</p>
          <p style="margin: 5px 0; color: #666;">${data.nominatorDistrict}</p>
        </div>
        
        <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>📅 Nomination Deadline:</strong> ${data.deadline}
          </p>
        </div>
        
        <h3 style="color: #1e3a5f;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">Our scholarship committee will review all nominations after the deadline.</li>
          <li style="margin-bottom: 10px;">Selected nominees may be contacted for additional information.</li>
          <li style="margin-bottom: 10px;">Winners will be announced and notified directly.</li>
        </ol>
        
        <p>If you have any questions about the scholarship process, please contact us.</p>
        
        <p style="margin-top: 30px;">Thank you for supporting student education in Tennessee!</p>
        
        <p style="color: #666;">
          Best regards,<br>
          <strong>Tennessee Association of Pupil Transportation</strong>
        </p>
      </div>
      
      <div style="background: #1e3a5f; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
        <p style="color: #e0e0e0; margin: 0; font-size: 12px;">
          © ${new Date().getFullYear()} Tennessee Association of Pupil Transportation (TAPT)
        </p>
        <p style="color: #e0e0e0; margin: 5px 0 0 0; font-size: 12px;">
          <a href="https://tapt.org" style="color: #f59e0b;">www.tapt.org</a>
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
    const { applicationId } = body;

    if (!applicationId) {
      return new Response(
        JSON.stringify({ error: 'Application ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 Resending scholarship nomination confirmation for:', applicationId);

    // Fetch the application
    const { data: application, error: appError } = await supabaseAdmin
      .from('student_scholarship_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error('Application not found:', appError);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch scholarship settings
    const { data: settings } = await supabaseAdmin
      .from('student_scholarship_settings')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Build email data
    const studentName = application.full_name 
      ? `${application.full_name.first || ''} ${application.full_name.last || ''}`.trim()
      : 'Student';

    const emailData = {
      nominatorName: `${application.nominator_first_name} ${application.nominator_last_name}`,
      nominatorTitle: application.nominator_title || '',
      nominatorDistrict: application.nominator_district || '',
      studentName,
      studentHighSchool: application.high_school || '',
      region: application.region || '',
      submittedAt: new Date(application.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      scholarshipName: settings?.name || settings?.scholarship_name || 'TAPT Student Scholarship',
      deadline: settings?.deadline 
        ? new Date(settings.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'TBD'
    };

    // Generate email HTML
    const emailHtml = generateNominatorConfirmationEmail(emailData);

    // Send the email to nominator
    const emailResult = await sendEmail({
      to: application.nominator_email,
      subject: `Scholarship Nomination Confirmation - ${emailData.scholarshipName}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Scholarship nomination confirmation resent to:', application.nominator_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Confirmation email sent to ${application.nominator_email}` 
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
