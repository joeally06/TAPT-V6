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

// Utility to sanitize error messages - prevents information leakage
const sanitizeError = (error: unknown): string => {
  const errorMap: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Invalid login credentials.',
    '23505': 'A nomination for this driver has already been submitted.',
    '22P02': 'Invalid input format.',
    '23503': 'Related record not found.',
    '23514': 'Input does not meet requirements.',
  };
  
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (errorMap[code]) return errorMap[code];
  }
  
  if (error instanceof Error && error.message) {
    // Only return safe, user-facing error messages
    const safeMessages = [
      'Security verification required',
      'Security verification failed',
      'Missing required field',
      'Invalid email format',
      'Invalid years of service',
      'Nomination reason exceeds maximum length',
      'Rate limit exceeded',
      'Nominations are not currently open',
      'A nomination for this person already exists',
      'Invalid grand division',
      'Invalid nominator role',
      'All attestations must be confirmed',
      'Phone number must be 10 digits'
    ];
    
    for (const msg of safeMessages) {
      if (error.message.includes(msg)) return error.message;
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
};

// Valid grand divisions (one winner per division)
const VALID_GRAND_DIVISIONS = ['East Tennessee', 'Middle Tennessee', 'West Tennessee'];

// Valid nominator roles per guidelines
const VALID_NOMINATOR_ROLES = ['Transportation Supervisor', 'Director of Schools'];

// Input sanitization - strips HTML/script tags and trims whitespace
const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '')    // Remove angle brackets
    .trim();
};

// Email template for Hall of Fame nomination confirmation
function generateConfirmationEmail(data: {
  nominatorName: string;
  nomineeName: string;
  district: string;
  grandDivision: string;
  yearsOfService: number;
  submittedAt: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hall of Fame Nomination Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏆 TAPT Hall of Fame</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Received</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for submitting a Hall of Fame nomination. Your nomination has been successfully received and is now pending review.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="color: #7c3aed; margin-top: 0;">Nomination Summary</h3>
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
            <tr>
              <td style="padding: 8px 0; color: #666;">Years of Service:</td>
              <td style="padding: 8px 0;">${data.yearsOfService} years</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Submitted:</td>
              <td style="padding: 8px 0;">${data.submittedAt}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h4 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Important Next Steps</h4>
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            TAPT will contact you to request documentation verifying the nominee's years of service and driving record. 
            <strong>The nominee will not be considered a finalist until all required documentation is received.</strong>
          </p>
        </div>
        
        <h3 style="color: #7c3aed;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">You will receive a separate request for supporting documentation.</li>
          <li style="margin-bottom: 10px;">Our Hall of Fame committee will review all complete nominations.</li>
          <li style="margin-bottom: 10px;">Inductees will be announced and honored at the TAPT Annual Conference.</li>
        </ol>
        
        <p>If you have any questions, please contact TAPT.</p>
        
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

interface NominationPayload {
  // Nominee information
  nominee_first_name: string;
  nominee_last_name: string;
  district: string;
  grand_division: string;
  years_of_service: number;
  
  // Nominator information
  nominator_first_name: string;
  nominator_last_name: string;
  nominator_role: string;
  nominator_email: string;
  nominator_phone: string;
  
  // Nomination details
  nomination_reason: string;
  
  // Required attestations
  clean_driving_record: boolean;
  district_is_tapt_member: boolean;
  // Dynamic year attestations - years come from settings
  conference_year_1: number;
  conference_year_2: number;
  conference_year_3: number;
  district_attended_year_1: boolean;
  district_attended_year_2: boolean;
  district_attended_year_3: boolean;
  nominator_is_officially_listed: boolean;
  acknowledge_documentation: boolean;
  acknowledge_attendance: boolean;
  
  // Security token
  turnstileToken: string;
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request method
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

    // Get request body
    const payload: NominationPayload = await req.json();

    // ========================================
    // SECURITY: Verify Turnstile token first
    // ========================================
    if (!payload.turnstileToken) {
      throw new Error('Security verification required');
    }

    try {
      const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
          response: payload.turnstileToken,
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      
      if (!turnstileResult.success) {
        console.error('Turnstile verification failed:', turnstileResult);
        throw new Error('Security verification failed');
      }
    } catch (error) {
      console.error('Turnstile verification error:', error);
      throw new Error('Security verification failed');
    }

    // ========================================
    // VALIDATION: Required string fields
    // ========================================
    const requiredStringFields = [
      'nominee_first_name',
      'nominee_last_name',
      'district',
      'grand_division',
      'nominator_first_name',
      'nominator_last_name',
      'nominator_role',
      'nominator_email',
      'nominator_phone',
      'nomination_reason'
    ];

    for (const field of requiredStringFields) {
      const value = payload[field as keyof NominationPayload];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`Missing required field: ${field.replace(/_/g, ' ')}`);
      }
    }

    // ========================================
    // VALIDATION: All attestations must be true
    // ========================================
    const attestationFields = [
      'clean_driving_record',
      'district_is_tapt_member',
      'district_attended_year_1',
      'district_attended_year_2',
      'district_attended_year_3',
      'nominator_is_officially_listed',
      'acknowledge_documentation',
      'acknowledge_attendance'
    ];

    for (const field of attestationFields) {
      if (payload[field as keyof NominationPayload] !== true) {
        throw new Error('All attestations must be confirmed to submit a nomination');
      }
    }

    // ========================================
    // VALIDATION: Conference years must be valid
    // ========================================
    const currentYear = new Date().getFullYear();
    const yearFields = ['conference_year_1', 'conference_year_2', 'conference_year_3'];
    for (const field of yearFields) {
      const year = payload[field as keyof NominationPayload] as number;
      if (typeof year !== 'number' || year < 2000 || year > currentYear + 10) {
        throw new Error(`Invalid conference year: ${field}`);
      }
    }

    // ========================================
    // VALIDATION: Grand Division
    // ========================================
    if (!VALID_GRAND_DIVISIONS.includes(payload.grand_division)) {
      throw new Error(`Invalid grand division. Must be one of: ${VALID_GRAND_DIVISIONS.join(', ')}`);
    }

    // ========================================
    // VALIDATION: Nominator Role
    // ========================================
    if (!VALID_NOMINATOR_ROLES.includes(payload.nominator_role)) {
      throw new Error(`Invalid nominator role. Must be one of: ${VALID_NOMINATOR_ROLES.join(', ')}`);
    }

    // ========================================
    // VALIDATION: Email format
    // ========================================
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.nominator_email)) {
      throw new Error('Invalid email format');
    }

    // ========================================
    // VALIDATION: Phone format (10 digits)
    // ========================================
    const phoneDigits = payload.nominator_phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      throw new Error('Phone number must be 10 digits');
    }

    // ========================================
    // VALIDATION: Years of service
    // ========================================
    if (typeof payload.years_of_service !== 'number' || 
        payload.years_of_service < 1 || 
        payload.years_of_service > 60) {
      throw new Error('Invalid years of service (must be between 1 and 60)');
    }

    // ========================================
    // VALIDATION: Nomination reason length
    // ========================================
    if (payload.nomination_reason.length > 2000) {
      throw new Error('Nomination reason exceeds maximum length of 2000 characters');
    }

    // ========================================
    // RATE LIMITING: Prevent spam submissions
    // ========================================
    const now = new Date();
    const rateLimitKey = `hof_nomination_${payload.nominator_email.toLowerCase()}`;
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('count, last_attempt')
      .eq('key', rateLimitKey)
      .single();

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      if (new Date(rateLimit.last_attempt) > hourAgo && rateLimit.count >= 3) {
        throw new Error('Rate limit exceeded. Please try again later.');
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

    // ========================================
    // CHECK: Nomination period is open
    // ========================================
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('hall_of_fame_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Nominations are not currently open');
    }

    const startDate = new Date(settings.start_date);
    const endDate = new Date(settings.end_date);
    endDate.setHours(23, 59, 59, 999); // Include the full end date

    if (now < startDate) {
      throw new Error(`Nominations open on ${startDate.toLocaleDateString()}`);
    }

    if (now > endDate) {
      throw new Error(`Nominations closed on ${endDate.toLocaleDateString()}`);
    }

    // ========================================
    // CHECK: Duplicate nomination prevention
    // ========================================
    const { count: existingCount, error: duplicateError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*', { count: 'exact', head: true })
      .ilike('nominee_first_name', sanitizeInput(payload.nominee_first_name))
      .ilike('nominee_last_name', sanitizeInput(payload.nominee_last_name))
      .ilike('district', sanitizeInput(payload.district));

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      throw new Error('Failed to check for duplicate nominations');
    }

    if (existingCount && existingCount > 0) {
      throw new Error('A nomination for this person already exists');
    }

    // ========================================
    // INSERT: Create the nomination record
    // ========================================
    const nominationData = {
      // Nominee info (sanitized)
      nominee_first_name: sanitizeInput(payload.nominee_first_name),
      nominee_last_name: sanitizeInput(payload.nominee_last_name),
      district: sanitizeInput(payload.district),
      grand_division: payload.grand_division,
      years_of_service: payload.years_of_service,
      
      // Nominator info (sanitized)
      supervisor_first_name: sanitizeInput(payload.nominator_first_name),
      supervisor_last_name: sanitizeInput(payload.nominator_last_name),
      nominator_role: payload.nominator_role,
      supervisor_email: payload.nominator_email.toLowerCase().trim(),
      
      // Nomination details (sanitized)
      nomination_reason: sanitizeInput(payload.nomination_reason),
      
      // Attestations (all validated as true above)
      clean_driving_record: true,
      district_is_tapt_member: true,
      // Store the actual years that were attested to (dynamic from settings)
      conference_year_1: payload.conference_year_1,
      conference_year_2: payload.conference_year_2,
      conference_year_3: payload.conference_year_3,
      district_attended_year_1: true,
      district_attended_year_2: true,
      district_attended_year_3: true,
      nominator_is_officially_listed: true,
      acknowledge_documentation: true,
      acknowledge_attendance: true,
      
      // Legacy fields for backwards compatibility
      region: payload.grand_division.replace(' Tennessee', ''),
      is_tapt_member: true, // District attestation covers this
      nominee_city: '', // Not required in 2026 guidelines
      
      // Status
      status: 'pending'
    };

    const { data, error } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .insert([nominationData])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('Nomination submitted successfully:', {
      id: data.id,
      nominee: `${data.nominee_first_name} ${data.nominee_last_name}`,
      district: data.district,
      grand_division: data.grand_division
    });

    // ========================================
    // SEND: Confirmation email to nominator
    // ========================================
    try {
      const nominatorName = `${sanitizeInput(payload.nominator_first_name)} ${sanitizeInput(payload.nominator_last_name)}`;
      const nomineeName = `${data.nominee_first_name} ${data.nominee_last_name}`;
      const submittedAt = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      const emailHtml = generateConfirmationEmail({
        nominatorName,
        nomineeName,
        district: data.district,
        grandDivision: data.grand_division,
        yearsOfService: data.years_of_service,
        submittedAt
      });

      const emailResult = await sendEmail({
        to: data.supervisor_email,
        subject: `TAPT Hall of Fame Nomination Received - ${nomineeName}`,
        html: emailHtml
      });

      if (emailResult.success) {
        console.log('✅ Confirmation email sent to:', data.supervisor_email);
      } else {
        console.error('❌ Failed to send confirmation email:', emailResult.error);
        // Don't throw - nomination was successful, email failure shouldn't fail the whole request
      }
    } catch (emailError) {
      console.error('❌ Error sending confirmation email:', emailError);
      // Don't throw - nomination was successful, email failure shouldn't fail the whole request
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          id: data.id,
          nominee_name: `${data.nominee_first_name} ${data.nominee_last_name}`,
          district: data.district,
          grand_division: data.grand_division
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
    console.error('HOF Nomination error:', error);
    
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