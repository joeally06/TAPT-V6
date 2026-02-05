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

// Email template for approved nominations
function generateApprovalEmail(data: {
  nominatorName: string;
  nomineeName: string;
  district: string;
  grandDivision: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hall of Fame Nomination Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏆 Congratulations!</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Hall of Fame Nomination Approved</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>We are pleased to inform you that your Hall of Fame nomination has been <strong style="color: #059669;">APPROVED</strong>!</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="color: #059669; margin-top: 0;">✓ Approved Nomination</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Nominee:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.nomineeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">District:</td>
              <td style="padding: 8px 0;">${data.district}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Grand Division:</td>
              <td style="padding: 8px 0;">${data.grandDivision}</td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #059669;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The nominee will be honored at the TAPT Annual Conference.</li>
          <li style="margin-bottom: 10px;">Both you and the nominee should plan to attend the awards ceremony.</li>
          <li style="margin-bottom: 10px;">Additional details about the ceremony will be sent closer to the event.</li>
        </ol>
        
        <p>Thank you for recognizing excellence in pupil transportation!</p>
        
        <p style="color: #666;">
          Best regards,<br>
          <strong>Tennessee Association of Pupil Transportation</strong>
        </p>
      </div>
      
      <div style="background: #059669; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
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

// Email template for rejected nominations
function generateRejectionEmail(data: {
  nominatorName: string;
  nomineeName: string;
  district: string;
  grandDivision: string;
  rejectionReason: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hall of Fame Nomination Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hall of Fame Nomination</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Status Update</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for submitting a Hall of Fame nomination. After careful review, we regret to inform you that the nomination was not approved at this time.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="color: #dc2626; margin-top: 0;">Nomination Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Nominee:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.nomineeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">District:</td>
              <td style="padding: 8px 0;">${data.district}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Grand Division:</td>
              <td style="padding: 8px 0;">${data.grandDivision}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fef2f2; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h4 style="color: #991b1b; margin: 0 0 10px 0;">Reason:</h4>
          <p style="margin: 0; color: #991b1b;">${data.rejectionReason}</p>
        </div>
        
        <p>If you have questions about this decision, please contact TAPT for more information.</p>
        
        <p>We appreciate your commitment to recognizing excellence in pupil transportation and encourage you to consider nominating again in future years.</p>
        
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

    console.log('📧 Resending status email for nomination:', nominationId);

    // Fetch the nomination
    const { data: nomination, error: fetchError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*')
      .eq('id', nominationId)
      .single();

    if (fetchError || !nomination) {
      console.error('Failed to fetch nomination:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Nomination not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check that nomination has been approved or rejected
    if (nomination.status !== 'approved' && nomination.status !== 'rejected') {
      return new Response(
        JSON.stringify({ error: 'Can only resend status email for approved or rejected nominations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nominatorName = `${nomination.supervisor_first_name} ${nomination.supervisor_last_name}`;
    const nomineeName = `${nomination.nominee_first_name} ${nomination.nominee_last_name}`;

    let emailHtml: string;
    let emailSubject: string;

    if (nomination.status === 'approved') {
      emailHtml = generateApprovalEmail({
        nominatorName,
        nomineeName,
        district: nomination.district,
        grandDivision: nomination.grand_division || nomination.region
      });
      emailSubject = `TAPT Hall of Fame Nomination Approved - ${nomineeName}`;
    } else {
      emailHtml = generateRejectionEmail({
        nominatorName,
        nomineeName,
        district: nomination.district,
        grandDivision: nomination.grand_division || nomination.region,
        rejectionReason: nomination.rejection_reason || 'No reason provided'
      });
      emailSubject = `TAPT Hall of Fame Nomination Status Update - ${nomineeName}`;
    }

    const emailResult = await sendEmail({
      to: nomination.supervisor_email,
      subject: emailSubject,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('❌ Failed to send status email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Status email sent to:', nomination.supervisor_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${nomination.status === 'approved' ? 'Approval' : 'Rejection'} email sent successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error resending status email:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
