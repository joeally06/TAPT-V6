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

// Email template for approved scholarship nominations
function generateApprovalEmail(data: {
  nominatorName: string;
  studentName: string;
  highSchool: string;
  region: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Student Scholarship Nomination Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎓 Congratulations!</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Student Scholarship Nomination Approved</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>We are pleased to inform you that your student scholarship nomination has been <strong style="color: #059669;">APPROVED</strong>!</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="color: #059669; margin-top: 0;">✓ Approved Nomination</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Student:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">High School:</td>
              <td style="padding: 8px 0;">${data.highSchool}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.region}</td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #059669;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The scholarship recipient will be recognized at the TAPT Annual Conference.</li>
          <li style="margin-bottom: 10px;">Additional details about the award ceremony and scholarship disbursement will be sent closer to the event.</li>
          <li style="margin-bottom: 10px;">Please ensure the student is aware of their selection.</li>
        </ol>
        
        <p>Thank you for supporting the next generation in pupil transportation!</p>
        
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

// Email template for rejected scholarship nominations
function generateRejectionEmail(data: {
  nominatorName: string;
  studentName: string;
  highSchool: string;
  region: string;
  rejectionReason: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Student Scholarship Nomination Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎓 TAPT Student Scholarship</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Status Update</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for your student scholarship nomination. After careful review by our committee, we regret to inform you that the nomination was not approved at this time.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="color: #dc2626; margin-top: 0;">Nomination Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Student:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">High School:</td>
              <td style="padding: 8px 0;">${data.highSchool}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.region}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fef2f2; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #fecaca;">
          <h4 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">Reason:</h4>
          <p style="margin: 0; color: #7f1d1d;">${data.rejectionReason}</p>
        </div>
        
        <p>We appreciate your commitment to supporting students in pupil transportation. You are welcome to submit a new nomination in the future that addresses the concerns noted above.</p>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
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
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    console.log(`Processing ${req.method} request for scholarship nomination status`);
    
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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is admin using RPC to avoid RLS recursion
    const { data: role, error: roleError } = await supabaseAdmin.rpc('get_user_role', { user_id: user.id });

    if (roleError || role !== 'admin') {
      console.error("User role check failed:", roleError);
      throw new Error('Unauthorized - Admin access required');
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("Received payload:", JSON.stringify(body));
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format: Unable to parse JSON');
    }

    if (!body.id) {
      throw new Error('Nomination ID is required');
    }

    if (!body.status || !['pending', 'approved', 'rejected'].includes(body.status)) {
      throw new Error('Valid status (pending, approved, or rejected) is required');
    }

    // Fetch existing nomination to check current status and get data for email
    const { data: existingNomination, error: fetchError } = await supabaseAdmin
      .from('student_scholarship_applications')
      .select('status, nominator_first_name, nominator_last_name, nominator_email, full_name, high_school, region')
      .eq('id', body.id)
      .single();

    if (fetchError || !existingNomination) {
      console.error("Error fetching nomination:", fetchError);
      throw new Error('Nomination not found');
    }

    // Prevent status changes once decision is finalized
    if (existingNomination.status === 'approved' || existingNomination.status === 'rejected') {
      throw new Error(`This nomination has already been ${existingNomination.status}. The decision is final and cannot be changed.`);
    }

    // For rejection, require a reason
    if (body.status === 'rejected' && (!body.rejectionReason || body.rejectionReason.trim() === '')) {
      throw new Error('A rejection reason is required');
    }

    // Build update data
    const updateData: Record<string, any> = { status: body.status };
    
    if (body.status === 'approved') {
      updateData.admin_verified_by = user.id;
      updateData.admin_verified_at = new Date().toISOString();
      updateData.rejection_reason = null;
    } else if (body.status === 'rejected') {
      updateData.rejection_reason = body.rejectionReason.trim();
      updateData.admin_verified_by = null;
      updateData.admin_verified_at = null;
    } else {
      updateData.admin_verified_by = null;
      updateData.admin_verified_at = null;
      updateData.rejection_reason = null;
    }

    // Update nomination status
    const { error: updateError } = await supabaseAdmin
      .from('student_scholarship_applications')
      .update(updateData)
      .eq('id', body.id);

    if (updateError) {
      console.error("Error updating nomination status:", updateError);
      throw updateError;
    }

    // Send email notification for approved or rejected status
    if (body.status === 'approved' || body.status === 'rejected') {
      const nominatorName = `${existingNomination.nominator_first_name} ${existingNomination.nominator_last_name}`;
      const studentName = `${existingNomination.full_name.first} ${existingNomination.full_name.last}`;
      const region = existingNomination.region ? `${existingNomination.region} Tennessee` : 'Tennessee';
      
      try {
        let emailHtml: string;
        let emailSubject: string;
        
        if (body.status === 'approved') {
          emailSubject = `🎓 Student Scholarship Nomination Approved - ${studentName}`;
          emailHtml = generateApprovalEmail({
            nominatorName,
            studentName,
            highSchool: existingNomination.high_school,
            region
          });
        } else {
          emailSubject = `TAPT Student Scholarship Nomination Status Update - ${studentName}`;
          emailHtml = generateRejectionEmail({
            nominatorName,
            studentName,
            highSchool: existingNomination.high_school,
            region,
            rejectionReason: body.rejectionReason.trim()
          });
        }
        
        const emailResult = await sendEmail({
          to: existingNomination.nominator_email,
          subject: emailSubject,
          html: emailHtml
        });
        
        if (emailResult.success) {
          console.log(`✅ Status notification email sent to ${existingNomination.nominator_email}`);
        } else {
          console.error(`⚠️ Failed to send status notification email:`, emailResult.error);
        }
      } catch (emailError) {
        console.error('⚠️ Error sending status notification email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: user.id,
        action: `update_scholarship_nomination_status_${body.status}`,
        outcome: 'success',
        details: { nomination_id: body.id, status: body.status }
      }]);
    } catch (logError) {
      console.error("Error logging action:", logError);
    }

    console.log("Scholarship nomination status updated successfully");
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Nomination status updated to ${body.status}`
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error("Error in admin-scholarship-status function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
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
