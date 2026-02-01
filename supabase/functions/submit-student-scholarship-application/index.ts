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
  // Add WebContainer domains
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

// Utility to sanitize error messages - never expose internal details
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

// Input sanitization to prevent XSS and injection attacks
const sanitizeString = (input: string | undefined | null): string => {
  if (!input) return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 10000); // Limit length to prevent DoS
};

const sanitizeEmail = (email: string): string => {
  return sanitizeString(email).toLowerCase();
};

const sanitizePhone = (phone: string): string => {
  // Keep only digits, parentheses, hyphens, spaces, and plus sign
  return sanitizeString(phone).replace(/[^\d\s\-\(\)\+]/g, '').slice(0, 20);
};

// Valid Tennessee regions
const VALID_REGIONS = ['East', 'Middle', 'West'] as const;
type Region = typeof VALID_REGIONS[number];

// New nomination-based interface (transportation directors nominate students)
interface ScholarshipNomination {
  // Nominator Information (Required)
  nominator: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
    district: string;
  };
  // Region (Required)
  region: Region;
  // Student Information
  student: {
    firstName: string;
    lastName: string;
    highSchool: string;
    graduationYear: string;
    email?: string; // Optional
    phone?: string; // Optional
    homeAddress: {
      addr_line1: string;
      addr_line2?: string;
      city: string;
      state: string;
      postal: string;
    };
  };
  // Essay (Required)
  essay: string;
  // Security
  turnstileToken: string;
}

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

// Email template for student notification (optional - only if student email provided)
function generateStudentNotificationEmail(data: {
  studentName: string;
  nominatorName: string;
  nominatorTitle: string;
  nominatorDistrict: string;
  scholarshipName: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scholarship Nomination Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎓 Congratulations!</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">You've Been Nominated for a Scholarship</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.studentName}</strong>,</p>
        
        <p>We are pleased to inform you that you have been nominated for the <strong>${data.scholarshipName}</strong>!</p>
        
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="font-size: 18px; margin: 0; color: #92400e;">
            🌟 You've been nominated by <strong>${data.nominatorName}</strong>
          </p>
          <p style="margin: 10px 0 0 0; color: #a16207;">
            ${data.nominatorTitle}<br>
            ${data.nominatorDistrict}
          </p>
        </div>
        
        <h3 style="color: #1e3a5f;">What This Means</h3>
        <p>Your Transportation Director has recognized your achievements and potential by nominating you for this scholarship. This is a wonderful acknowledgment of your hard work and dedication.</p>
        
        <h3 style="color: #1e3a5f;">What Happens Next?</h3>
        <ul style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The TAPT scholarship committee will review all nominations.</li>
          <li style="margin-bottom: 10px;">You may be contacted for additional information or verification.</li>
          <li style="margin-bottom: 10px;">Scholarship recipients will be announced and notified directly.</li>
        </ul>
        
        <p>We wish you the best of luck in your academic pursuits!</p>
        
        <p style="color: #666; margin-top: 30px;">
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
    console.log("Processing scholarship nomination submission");
    
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      throw new Error('Server configuration error');
    }

    // Create Supabase client with service role key (bypasses RLS)
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
    let payload: ScholarshipNomination;
    try {
      payload = await req.json();
      console.log("Received nomination from:", sanitizeEmail(payload.nominator?.email || ''));
      console.log("🔍 Payload keys received:", Object.keys(payload));
      console.log("🔍 turnstileToken present:", 'turnstileToken' in payload);
      console.log("🔍 turnstileToken type:", typeof payload.turnstileToken);
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format');
    }

    // Validate nominator information (all required)
    if (!payload.nominator) {
      throw new Error('Nominator information is required');
    }
    
    const nominatorFields = ['firstName', 'lastName', 'title', 'email', 'phone', 'district'];
    for (const field of nominatorFields) {
      if (!payload.nominator[field as keyof typeof payload.nominator]?.trim()) {
        throw new Error(`Nominator ${field} is required`);
      }
    }

    // Validate region
    if (!payload.region || !VALID_REGIONS.includes(payload.region)) {
      throw new Error('Please select a valid Tennessee region (East, Middle, or West)');
    }

    // Validate student information
    if (!payload.student) {
      throw new Error('Student information is required');
    }

    const studentRequiredFields = ['firstName', 'lastName', 'highSchool', 'graduationYear'];
    for (const field of studentRequiredFields) {
      if (!payload.student[field as keyof typeof payload.student]) {
        throw new Error(`Student ${field} is required`);
      }
    }

    // Validate graduation year - must be current year
    const currentYear = new Date().getFullYear();
    const graduationYear = parseInt(payload.student.graduationYear, 10);
    if (isNaN(graduationYear) || graduationYear !== currentYear) {
      throw new Error(`Student must be graduating in ${currentYear} to be eligible`);
    }

    // Validate home address
    if (!payload.student.homeAddress) {
      throw new Error('Student home address is required');
    }
    
    const addressRequiredFields = ['addr_line1', 'city', 'state', 'postal'];
    for (const field of addressRequiredFields) {
      if (!payload.student.homeAddress[field as keyof typeof payload.student.homeAddress]?.trim()) {
        throw new Error(`Student address ${field} is required`);
      }
    }

    // Validate essay
    if (!payload.essay?.trim()) {
      throw new Error('Nomination essay is required');
    }

    // Validate essay length (300-500 words)
    const essayWords = payload.essay.trim().split(/\s+/).length;
    if (essayWords < 300 || essayWords > 500) {
      throw new Error(`Essay must be between 300-500 words. Current word count: ${essayWords}`);
    }

    // Validate Turnstile token
    if (!payload.turnstileToken) {
      throw new Error('Security verification required');
    }

    // Verify Turnstile token
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      console.error('❌ TURNSTILE_SECRET_KEY not configured');
      throw new Error('Server configuration error');
    }

    console.log('🔒 Turnstile token length:', payload.turnstileToken.length);
    
    const clientIP = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For');
    console.log('🔒 Client IP for verification:', clientIP || '(not available)');

    // Use JSON format (same as working functions like submit-regional-luncheon)
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: turnstileSecret,
        response: payload.turnstileToken,
        remoteip: clientIP
      })
    });

    const turnstileResult = await turnstileResponse.json();
    console.log('🔒 Turnstile verification result:', turnstileResult);
    
    if (!turnstileResult.success) {
      console.error('❌ Turnstile verification failed:', turnstileResult);
      console.error('❌ Error codes:', turnstileResult['error-codes']);
      throw new Error('Security verification failed. Please try again.');
    }
    
    console.log('✅ Turnstile verification successful');

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.nominator.email)) {
      throw new Error('Invalid nominator email format');
    }
    if (payload.student.email && !emailRegex.test(payload.student.email)) {
      throw new Error('Invalid student email format');
    }

    // Rate limiting based on nominator email (5 submissions per hour)
    const rateLimitKey = `scholarship_nominator_${sanitizeEmail(payload.nominator.email)}`;
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('count, last_attempt')
      .eq('key', rateLimitKey)
      .single();

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      if (new Date(rateLimit.last_attempt) > hourAgo && rateLimit.count >= 5) {
        throw new Error('Too many submissions. Please try again later.');
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

    // Check if application period is open
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('student_scholarship_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Scholarship nominations are not currently open');
    }

    // Check if application deadline has passed
    const deadlineDate = new Date(settings.application_deadline);
    if (now > deadlineDate) {
      throw new Error(`Nomination deadline was ${deadlineDate.toLocaleDateString()}`);
    }

    // Sanitize all inputs before database insert
    const sanitizedData = {
      // Nominator info
      nominator_first_name: sanitizeString(payload.nominator.firstName),
      nominator_last_name: sanitizeString(payload.nominator.lastName),
      nominator_title: sanitizeString(payload.nominator.title),
      nominator_email: sanitizeEmail(payload.nominator.email),
      nominator_phone: sanitizePhone(payload.nominator.phone),
      nominator_district: sanitizeString(payload.nominator.district),
      // Region
      region: payload.region,
      // Student info
      full_name: {
        first: sanitizeString(payload.student.firstName),
        last: sanitizeString(payload.student.lastName)
      },
      high_school: sanitizeString(payload.student.highSchool),
      school_district: sanitizeString(payload.nominator.district), // Use nominator's district
      graduation_year: payload.student.graduationYear,
      email: payload.student.email ? sanitizeEmail(payload.student.email) : null,
      mobile_phone: payload.student.phone ? sanitizePhone(payload.student.phone) : null,
      home_address: {
        addr_line1: sanitizeString(payload.student.homeAddress.addr_line1),
        addr_line2: sanitizeString(payload.student.homeAddress.addr_line2 || ''),
        city: sanitizeString(payload.student.homeAddress.city),
        state: sanitizeString(payload.student.homeAddress.state),
        postal: sanitizeString(payload.student.homeAddress.postal)
      },
      // Essay
      essay: sanitizeString(payload.essay),
      // Legacy fields set to null for new nomination system
      birthdate: null,
      gender: null,
      is_us_citizen: null,
      application_status: 'Nominated', // New status for nomination system
      is_first_gen: null,
      major_area: null,
      career_objective: null,
      gpa: null,
      activities: null,
      act_year: null,
      act_score: null,
      signature: null
    };

    // Insert nomination
    const { data, error } = await supabaseAdmin
      .from('student_scholarship_applications')
      .insert([sanitizedData])
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: null, // No user for public submissions
        action: 'submit_scholarship_nomination',
        outcome: 'success',
        details: { 
          nomination_id: data.id,
          region: payload.region,
          nominator_email: sanitizeEmail(payload.nominator.email)
        }
      }]);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("Error logging action:", logError);
    }

    console.log("Nomination submitted successfully:", data.id);

    // Send confirmation emails
    try {
      const nominatorName = `${sanitizedData.nominator_first_name} ${sanitizedData.nominator_last_name}`;
      const studentName = `${sanitizedData.full_name.first} ${sanitizedData.full_name.last}`;
      const deadlineFormatted = settings.application_deadline 
        ? new Date(settings.application_deadline).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'TBD';

      // Send confirmation to nominator
      const nominatorEmailHtml = generateNominatorConfirmationEmail({
        nominatorName,
        nominatorTitle: sanitizedData.nominator_title,
        nominatorDistrict: sanitizedData.nominator_district,
        studentName,
        studentHighSchool: sanitizedData.high_school,
        region: sanitizedData.region,
        submittedAt: new Date(data.created_at).toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'short'
        }),
        scholarshipName: settings.name || 'TAPT Student Scholarship',
        deadline: deadlineFormatted
      });

      const nominatorEmailResult = await sendEmail({
        to: sanitizedData.nominator_email,
        subject: `Nomination Confirmed - ${studentName} | TAPT Student Scholarship`,
        html: nominatorEmailHtml
      });

      if (nominatorEmailResult.success) {
        console.log('✅ Nominator confirmation email sent to:', sanitizedData.nominator_email);
      } else {
        console.error('❌ Failed to send nominator email:', nominatorEmailResult.error);
      }

      // Send notification to student (if email provided)
      if (sanitizedData.email) {
        const studentEmailHtml = generateStudentNotificationEmail({
          studentName,
          nominatorName,
          nominatorTitle: sanitizedData.nominator_title,
          nominatorDistrict: sanitizedData.nominator_district,
          scholarshipName: settings.name || 'TAPT Student Scholarship'
        });

        const studentEmailResult = await sendEmail({
          to: sanitizedData.email,
          subject: `You've Been Nominated! | TAPT Student Scholarship`,
          html: studentEmailHtml
        });

        if (studentEmailResult.success) {
          console.log('✅ Student notification email sent to:', sanitizedData.email);
        } else {
          console.error('❌ Failed to send student email:', studentEmailResult.error);
        }
      }

    } catch (emailError) {
      // Don't fail the nomination if email fails
      console.error('❌ Error sending confirmation emails:', emailError);
      console.log('⚠️ Nomination was saved but email(s) may have failed');
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
    console.error("Error in submit-student-scholarship-application function:", error);
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