import { Resend } from 'npm:resend@2.0.0';

/**
 * Send email using Resend API
 * @param params Email parameters
 * @returns Result object with success status
 */
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  const { to, subject, html, from = 'TAPT <noreply@tapt.org>' } = params;
  
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY not configured');
    return { 
      success: false, 
      error: 'Email service not configured' 
    };
  }
  
  const resend = new Resend(resendApiKey);
  
  try {
    console.log(`📧 Sending email to: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`📧 Subject: ${subject}`);
    
    const result = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    });
    
    console.log('✅ Email sent successfully:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, error };
  }
}
