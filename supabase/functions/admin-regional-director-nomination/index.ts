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
  recipientName: string;
  candidateName: string;
  district: string;
  region: string;
  recipientRole: 'nominator' | 'candidate';
}): string {
  const isCandidate = data.recipientRole === 'candidate';
  const introText = isCandidate
    ? `We are pleased to inform you that your nomination for Regional Director / Board Member has been <strong style="color: #059669;">APPROVED</strong>!`
    : `We are pleased to inform you that the Regional Director / Board Member nomination you submitted has been <strong style="color: #059669;">APPROVED</strong>!`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Regional Director Nomination Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📋 Congratulations!</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Regional Director Nomination Approved</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.recipientName}</strong>,</p>
        
        <p>${introText}</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="color: #059669; margin-top: 0;">✓ Approved Nomination</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Candidate:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.candidateName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">District:</td>
              <td style="padding: 8px 0;">${data.district}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.region}</td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #059669;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The candidate will be placed on the ballot for the regional election.</li>
          <li style="margin-bottom: 10px;">Voting will take place during the TAPT Annual Conference.</li>
          <li style="margin-bottom: 10px;">Additional details will be sent closer to the event.</li>
        </ol>
        
        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 14px;"><strong>📋 Campaign Information:</strong> Nominees may promote their candidacy through flyers distributed during the Annual Conference. All campaign efforts must remain professional and respectful.</p>
        </div>
        
        <p>Thank you for your participation in TAPT leadership!</p>
        
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
  recipientName: string;
  candidateName: string;
  district: string;
  region: string;
  rejectionReason: string;
  recipientRole: 'nominator' | 'candidate';
}): string {
  const isCandidate = data.recipientRole === 'candidate';
  const introText = isCandidate
    ? `Thank you for your interest in serving as a Regional Director / Board Member. After careful review by our committee, we regret to inform you that the nomination was not approved at this time.`
    : `Thank you for your Regional Director / Board Member nomination. After careful review by our committee, we regret to inform you that the nomination was not approved at this time.`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Regional Director Nomination Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📋 TAPT Regional Director</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Status Update</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.recipientName}</strong>,</p>
        
        <p>${introText}</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="color: #dc2626; margin-top: 0;">Nomination Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Candidate:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.candidateName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">District:</td>
              <td style="padding: 8px 0;">${data.district}</td>
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
        
        <p>We appreciate your commitment to TAPT leadership. You are welcome to submit a new nomination in the future that addresses the concerns noted above.</p>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
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
          <a href="https://tapt.org" style="color: #60a5fa;">www.tapt.org</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

// Send notification emails to both nominator and candidate
async function sendStatusEmails(nomination: any, status: string, rejectionReason?: string) {
  const candidateName = `${nomination.candidate_first_name} ${nomination.candidate_last_name}`;
  const nominatorName = `${nomination.nominator_first_name} ${nomination.nominator_last_name}`;
  const emailResults = { nominator: false, candidate: false };

  const commonData = {
    candidateName,
    district: nomination.candidate_school_district,
    region: nomination.candidate_region,
  };

  // Send to nominator
  try {
    let emailHtml: string;
    let emailSubject: string;

    if (status === 'approved') {
      emailSubject = `✓ Regional Director Nomination Approved - ${candidateName}`;
      emailHtml = generateApprovalEmail({ ...commonData, recipientName: nominatorName, recipientRole: 'nominator' });
    } else {
      emailSubject = `TAPT Regional Director Nomination Status Update - ${candidateName}`;
      emailHtml = generateRejectionEmail({ ...commonData, recipientName: nominatorName, rejectionReason: rejectionReason || '', recipientRole: 'nominator' });
    }

    const result = await sendEmail({ to: nomination.nominator_email, subject: emailSubject, html: emailHtml });
    emailResults.nominator = result.success;
    if (result.success) {
      console.log(`✅ Status email sent to nominator: ${nomination.nominator_email}`);
    } else {
      console.error(`⚠️ Failed to send email to nominator:`, result.error);
    }
  } catch (err) {
    console.error('⚠️ Error sending nominator email:', err);
  }

  // Send to candidate
  try {
    let emailHtml: string;
    let emailSubject: string;

    if (status === 'approved') {
      emailSubject = `✓ Your Regional Director Nomination Has Been Approved`;
      emailHtml = generateApprovalEmail({ ...commonData, recipientName: candidateName, recipientRole: 'candidate' });
    } else {
      emailSubject = `TAPT Regional Director Nomination Status Update`;
      emailHtml = generateRejectionEmail({ ...commonData, recipientName: candidateName, rejectionReason: rejectionReason || '', recipientRole: 'candidate' });
    }

    const result = await sendEmail({ to: nomination.candidate_email, subject: emailSubject, html: emailHtml });
    emailResults.candidate = result.success;
    if (result.success) {
      console.log(`✅ Status email sent to candidate: ${nomination.candidate_email}`);
    } else {
      console.error(`⚠️ Failed to send email to candidate:`, result.error);
    }
  } catch (err) {
    console.error('⚠️ Error sending candidate email:', err);
  }

  return emailResults;
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
    'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: role, error: roleError } = await supabaseAdmin.rpc('get_user_role', { user_id: user.id });
    if (roleError || role !== 'admin') throw new Error('Unauthorized - Admin access required');

    let body;
    try {
      body = await req.json();
    } catch {
      throw new Error('Invalid request format');
    }

    // ========================================
    // DELETE: Remove a nomination
    // ========================================
    if (req.method === 'DELETE') {
      if (!body.id) throw new Error('Nomination ID is required');

      const { error: deleteError } = await supabaseAdmin
        .from('regional_director_nominations')
        .delete()
        .eq('id', body.id);

      if (deleteError) throw deleteError;

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_regional_director_nomination',
          outcome: 'success',
          details: { nomination_id: body.id }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Nomination deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // POST: Update nomination status
    // ========================================
    if (req.method === 'POST') {
      if (!body.id) throw new Error('Nomination ID is required');
      if (!body.status || !['pending', 'approved', 'rejected'].includes(body.status)) {
        throw new Error('Valid status (pending, approved, or rejected) is required');
      }

      // Check current status
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('regional_director_nominations')
        .select('status, nominator_first_name, nominator_last_name, nominator_email, candidate_first_name, candidate_last_name, candidate_email, candidate_school_district, candidate_region')
        .eq('id', body.id)
        .single();

      if (fetchError || !existing) throw new Error('Nomination not found');

      if (existing.status === 'approved' || existing.status === 'rejected') {
        throw new Error(`This nomination has already been ${existing.status}. The decision is final.`);
      }

      if (body.status === 'approved' && !body.adminVerified) {
        throw new Error('Admin verification is required before approving');
      }

      if (body.status === 'rejected' && (!body.rejectionReason || body.rejectionReason.trim() === '')) {
        throw new Error('A rejection reason is required');
      }

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

      const { error: updateError } = await supabaseAdmin
        .from('regional_director_nominations')
        .update(updateData)
        .eq('id', body.id);

      if (updateError) throw updateError;

      // Auto-send notification emails for approved/rejected
      let emailResults = { nominator: false, candidate: false };
      if (body.status === 'approved' || body.status === 'rejected') {
        emailResults = await sendStatusEmails(
          existing,
          body.status,
          body.status === 'rejected' ? body.rejectionReason.trim() : undefined
        );
      }

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: `update_regional_director_nomination_status_${body.status}`,
          outcome: 'success',
          details: { nomination_id: body.id, status: body.status, emails_sent: emailResults }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      return new Response(
        JSON.stringify({ success: true, message: `Nomination status updated to ${body.status}`, emailResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // PUT: Resend notification emails
    // ========================================
    if (req.method === 'PUT') {
      if (!body.id) throw new Error('Nomination ID is required');

      const { data: nomination, error: fetchError } = await supabaseAdmin
        .from('regional_director_nominations')
        .select('status, rejection_reason, nominator_first_name, nominator_last_name, nominator_email, candidate_first_name, candidate_last_name, candidate_email, candidate_school_district, candidate_region')
        .eq('id', body.id)
        .single();

      if (fetchError || !nomination) throw new Error('Nomination not found');

      if (nomination.status !== 'approved' && nomination.status !== 'rejected') {
        throw new Error('Can only resend emails for approved or rejected nominations');
      }

      const emailResults = await sendStatusEmails(
        nomination,
        nomination.status,
        nomination.status === 'rejected' ? nomination.rejection_reason : undefined
      );

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'resend_regional_director_nomination_emails',
          outcome: 'success',
          details: { nomination_id: body.id, status: nomination.status, emails_sent: emailResults }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Notification emails resent', emailResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error("Error in admin-regional-director-nomination function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
