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

const sanitizeError = (error: unknown): string => {
  const errorMap: Record<string, string> = {
    '23505': 'A nomination for this candidate has already been submitted.',
    '22P02': 'Invalid input format.',
    '23503': 'Related record not found.',
    '23514': 'Input does not meet requirements.',
  };
  
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (errorMap[code]) return errorMap[code];
  }
  
  if (error instanceof Error && error.message) {
    const safeMessages = [
      'Security verification required',
      'Security verification failed',
      'Missing required field',
      'Invalid email format',
      'Invalid region',
      'Invalid nominator title',
      'All attestations must be confirmed',
      'Phone number must be 10 digits',
      'Rate limit exceeded',
      'Nominations are not currently open',
      'A nomination for this candidate already exists',
      'Candidate signature name is required',
    ];
    
    for (const msg of safeMessages) {
      if (error.message.includes(msg)) return error.message;
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
};

const VALID_REGIONS = ['West', 'Middle', 'East'];

const VALID_NOMINATOR_TITLES = [
  'Director of Schools',
  'District Pupil Transportation Supervisor',
  'Pupil Transportation Staff Member'
];

const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
};

function generateConfirmationEmail(data: {
  nominatorName: string;
  candidateName: string;
  candidateRegion: string;
  schoolDistrict: string;
  submittedAt: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Regional Director Nomination Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📋 TAPT Regional Director</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Board Member Nomination Received</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for submitting a Regional Director / Board Member nomination. Your nomination has been successfully received and is now pending review.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1e3a5f; margin-top: 0;">Nomination Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Candidate:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.candidateName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.candidateRegion}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">School District:</td>
              <td style="padding: 8px 0;">${data.schoolDistrict}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Submitted:</td>
              <td style="padding: 8px 0;">${data.submittedAt}</td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #1e3a5f;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The TAPT nomination committee will review all submissions.</li>
          <li style="margin-bottom: 10px;">Candidate eligibility will be verified and confirmed.</li>
          <li style="margin-bottom: 10px;">Voting will take place during the Annual Conference.</li>
        </ol>

        <div style="background: #eff6ff; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h4 style="color: #1e40af; margin: 0 0 10px 0;">📌 Regional Nomination Slots</h4>
          <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
            <li>West Region: 2 nominees</li>
            <li>Middle Region: 3 nominees</li>
            <li>East Region: 2 nominees</li>
          </ul>
        </div>
        
        <p>If you have any questions, please contact TAPT.</p>
        
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

interface NominationPayload {
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_title: string;
  candidate_school_district: string;
  candidate_region: string;
  candidate_email: string;
  candidate_phone: string;
  nominator_first_name: string;
  nominator_last_name: string;
  nominator_title: string;
  nominator_school_district: string;
  nominator_email: string;
  nominator_phone: string;
  nominator_certification: boolean;
  active_member_good_standing: boolean;
  affiliated_with_district_in_region: boolean;
  district_approval_and_support: boolean;
  travel_expenses_assumed: boolean;
  commits_to_three_year_term: boolean;
  impartial_regarding_vendors: boolean;
  candidate_certification: boolean;
  candidate_signature_name: string;
  turnstileToken: string;
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

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

    const payload: NominationPayload = await req.json();

    // ========================================
    // SECURITY: Verify Turnstile token
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
      if (error instanceof Error && error.message === 'Security verification failed') throw error;
      console.error('Turnstile verification error:', error);
      throw new Error('Security verification failed');
    }

    // ========================================
    // VALIDATION: Required string fields
    // ========================================
    const requiredStringFields = [
      'candidate_first_name',
      'candidate_last_name',
      'candidate_school_district',
      'candidate_region',
      'candidate_email',
      'candidate_phone',
      'nominator_first_name',
      'nominator_last_name',
      'nominator_title',
      'nominator_school_district',
      'nominator_email',
      'nominator_phone',
      'candidate_signature_name',
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
      'nominator_certification',
      'active_member_good_standing',
      'affiliated_with_district_in_region',
      'district_approval_and_support',
      'travel_expenses_assumed',
      'commits_to_three_year_term',
      'impartial_regarding_vendors',
      'candidate_certification',
    ];

    for (const field of attestationFields) {
      if (payload[field as keyof NominationPayload] !== true) {
        throw new Error('All attestations must be confirmed to submit a nomination');
      }
    }

    // ========================================
    // VALIDATION: Region
    // ========================================
    if (!VALID_REGIONS.includes(payload.candidate_region)) {
      throw new Error(`Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`);
    }

    // ========================================
    // VALIDATION: Nominator Title
    // ========================================
    if (!VALID_NOMINATOR_TITLES.includes(payload.nominator_title)) {
      throw new Error(`Invalid nominator title. Must be one of: ${VALID_NOMINATOR_TITLES.join(', ')}`);
    }

    // ========================================
    // VALIDATION: Email formats
    // ========================================
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.candidate_email)) {
      throw new Error('Invalid email format for candidate');
    }
    if (!emailRegex.test(payload.nominator_email)) {
      throw new Error('Invalid email format for nominator');
    }

    // ========================================
    // VALIDATION: Phone formats (10 digits)
    // ========================================
    const candidatePhoneDigits = payload.candidate_phone.replace(/\D/g, '');
    if (candidatePhoneDigits.length !== 10) {
      throw new Error('Candidate phone number must be 10 digits');
    }
    const nominatorPhoneDigits = payload.nominator_phone.replace(/\D/g, '');
    if (nominatorPhoneDigits.length !== 10) {
      throw new Error('Nominator phone number must be 10 digits');
    }

    // ========================================
    // VALIDATION: Candidate signature
    // ========================================
    if (!payload.candidate_signature_name || payload.candidate_signature_name.trim() === '') {
      throw new Error('Candidate signature name is required');
    }

    // ========================================
    // RATE LIMITING
    // ========================================
    const now = new Date();
    const rateLimitKey = `rd_nomination_${payload.nominator_email.toLowerCase()}`;
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
      await supabaseAdmin
        .from('rate_limits')
        .upsert({
          key: rateLimitKey,
          count: new Date(rateLimit.last_attempt) > hourAgo ? rateLimit.count + 1 : 1,
          last_attempt: now.toISOString()
        });
    } else {
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
      .from('regional_director_nomination_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError || !settings) {
      throw new Error('Nominations are not currently open');
    }

    const startDate = new Date(settings.start_date);
    const endDate = new Date(settings.end_date);
    endDate.setHours(23, 59, 59, 999);

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
      .from('regional_director_nominations')
      .select('*', { count: 'exact', head: true })
      .ilike('candidate_first_name', sanitizeInput(payload.candidate_first_name))
      .ilike('candidate_last_name', sanitizeInput(payload.candidate_last_name))
      .ilike('candidate_school_district', sanitizeInput(payload.candidate_school_district));

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      throw new Error('Failed to check for duplicate nominations');
    }

    if (existingCount && existingCount > 0) {
      throw new Error('A nomination for this candidate already exists');
    }

    // ========================================
    // INSERT: Create the nomination record
    // ========================================
    const nominationData = {
      candidate_first_name: sanitizeInput(payload.candidate_first_name),
      candidate_last_name: sanitizeInput(payload.candidate_last_name),
      candidate_title: sanitizeInput(payload.candidate_title || ''),
      candidate_school_district: sanitizeInput(payload.candidate_school_district),
      candidate_region: payload.candidate_region,
      candidate_email: payload.candidate_email.toLowerCase().trim(),
      candidate_phone: candidatePhoneDigits,
      nominator_first_name: sanitizeInput(payload.nominator_first_name),
      nominator_last_name: sanitizeInput(payload.nominator_last_name),
      nominator_title: payload.nominator_title,
      nominator_school_district: sanitizeInput(payload.nominator_school_district),
      nominator_email: payload.nominator_email.toLowerCase().trim(),
      nominator_phone: nominatorPhoneDigits,
      nominator_certification: true,
      active_member_good_standing: true,
      affiliated_with_district_in_region: true,
      district_approval_and_support: true,
      travel_expenses_assumed: true,
      commits_to_three_year_term: true,
      impartial_regarding_vendors: true,
      candidate_certification: true,
      candidate_signature_name: sanitizeInput(payload.candidate_signature_name),
      candidate_signature_date: now.toISOString().split('T')[0],
      status: 'pending'
    };

    const { data, error } = await supabaseAdmin
      .from('regional_director_nominations')
      .insert([nominationData])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('Regional Director nomination submitted successfully:', {
      id: data.id,
      candidate: `${data.candidate_first_name} ${data.candidate_last_name}`,
      region: data.candidate_region
    });

    // ========================================
    // SEND: Confirmation email to nominator
    // ========================================
    try {
      const nominatorName = `${sanitizeInput(payload.nominator_first_name)} ${sanitizeInput(payload.nominator_last_name)}`;
      const candidateName = `${data.candidate_first_name} ${data.candidate_last_name}`;
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
        candidateName,
        candidateRegion: data.candidate_region,
        schoolDistrict: data.candidate_school_district,
        submittedAt
      });

      const emailResult = await sendEmail({
        to: data.nominator_email,
        subject: `TAPT Regional Director Nomination Received - ${candidateName}`,
        html: emailHtml
      });

      if (emailResult.success) {
        console.log('✅ Confirmation email sent to:', data.nominator_email);
      } else {
        console.error('❌ Failed to send confirmation email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Error sending confirmation email:', emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          id: data.id,
          candidate_name: `${data.candidate_first_name} ${data.candidate_last_name}`,
          region: data.candidate_region
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
    console.error('Regional Director Nomination error:', error);
    
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
