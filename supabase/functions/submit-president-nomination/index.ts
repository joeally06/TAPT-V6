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
    '23505': 'A nomination for this nominee has already been submitted.',
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
      'All certifications must be confirmed',
      'Phone number must be 10 digits',
      'Rate limit exceeded',
      'Nominations are not currently open',
      'A nomination for this nominee already exists',
      'Nominee signature name is required',
      'Nominator signature name is required',
      'Statement of interest is required',
    ];
    
    for (const msg of safeMessages) {
      if (error.message.includes(msg)) return error.message;
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
};

const VALID_REGIONS = ['West', 'Middle', 'East'];

const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
};

function generateConfirmationEmail(data: {
  nominatorName: string;
  nomineeName: string;
  nomineeRegion: string;
  schoolDistrict: string;
  termLabel: string;
  submittedAt: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>President Nomination Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏛️ TAPT President ${data.termLabel}</h1>
        <p style="color: #e0e0e0; margin: 10px 0 0 0; font-size: 16px;">Nomination Received</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
        <p style="font-size: 16px;">Dear <strong>${data.nominatorName}</strong>,</p>
        
        <p>Thank you for submitting a TAPT President ${data.termLabel} nomination. Your nomination has been successfully received and is now pending review.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="color: #7c3aed; margin-top: 0;">Nomination Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 140px;">Nominee:</td>
              <td style="padding: 8px 0; font-weight: bold;">${data.nomineeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Region:</td>
              <td style="padding: 8px 0;">${data.nomineeRegion}</td>
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
        
        <h3 style="color: #7c3aed;">What Happens Next?</h3>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">The TAPT nomination committee will review all submissions.</li>
          <li style="margin-bottom: 10px;">Nominee eligibility and qualifications will be verified.</li>
          <li style="margin-bottom: 10px;">The election will take place at the Annual Conference.</li>
        </ol>
        
        <p>If you have any questions, please contact TAPT.</p>
        
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
  nominee_first_name: string;
  nominee_last_name: string;
  nominee_title: string;
  nominee_school_district: string;
  nominee_region: string;
  nominee_email: string;
  nominee_phone: string;
  nominator_first_name: string;
  nominator_last_name: string;
  nominator_title: string;
  nominator_school_district: string;
  nominator_email: string;
  nominator_phone: string;
  nominator_certification: boolean;
  current_member_good_standing: boolean;
  district_supports_nomination: boolean;
  district_allows_travel: boolean;
  district_assumes_expenses: boolean;
  elected_by_membership: boolean;
  serves_term: boolean;
  understands_commitment: boolean;
  impartial_regarding_vendors: boolean;
  disclose_conflicts: boolean;
  professionalism_integrity: boolean;
  team_player: boolean;
  no_personal_recognition: boolean;
  statement_of_interest: string;
  nominee_signature_name: string;
  nominator_signature_name: string;
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
      'nominee_first_name',
      'nominee_last_name',
      'nominee_school_district',
      'nominee_region',
      'nominee_email',
      'nominee_phone',
      'nominator_first_name',
      'nominator_last_name',
      'nominator_title',
      'nominator_school_district',
      'nominator_email',
      'nominator_phone',
      'statement_of_interest',
      'nominee_signature_name',
      'nominator_signature_name',
    ];

    for (const field of requiredStringFields) {
      const value = payload[field as keyof NominationPayload];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`Missing required field: ${field.replace(/_/g, ' ')}`);
      }
    }

    // ========================================
    // VALIDATION: All certifications must be true
    // ========================================
    const certificationFields = [
      'nominator_certification',
      'current_member_good_standing',
      'district_supports_nomination',
      'district_allows_travel',
      'district_assumes_expenses',
      'elected_by_membership',
      'serves_term',
      'understands_commitment',
      'impartial_regarding_vendors',
      'disclose_conflicts',
      'professionalism_integrity',
      'team_player',
      'no_personal_recognition',
    ];

    for (const field of certificationFields) {
      if (payload[field as keyof NominationPayload] !== true) {
        throw new Error('All certifications must be confirmed to submit a nomination');
      }
    }

    // ========================================
    // VALIDATION: Region
    // ========================================
    if (!VALID_REGIONS.includes(payload.nominee_region)) {
      throw new Error(`Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`);
    }

    // ========================================
    // VALIDATION: Email formats
    // ========================================
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.nominee_email)) {
      throw new Error('Invalid email format for nominee');
    }
    if (!emailRegex.test(payload.nominator_email)) {
      throw new Error('Invalid email format for nominator');
    }

    // ========================================
    // VALIDATION: Phone formats (10 digits)
    // ========================================
    const nomineePhoneDigits = payload.nominee_phone.replace(/\D/g, '');
    if (nomineePhoneDigits.length !== 10) {
      throw new Error('Nominee phone number must be 10 digits');
    }
    const nominatorPhoneDigits = payload.nominator_phone.replace(/\D/g, '');
    if (nominatorPhoneDigits.length !== 10) {
      throw new Error('Nominator phone number must be 10 digits');
    }

    // ========================================
    // VALIDATION: Signatures
    // ========================================
    if (!payload.nominee_signature_name || payload.nominee_signature_name.trim() === '') {
      throw new Error('Nominee signature name is required');
    }
    if (!payload.nominator_signature_name || payload.nominator_signature_name.trim() === '') {
      throw new Error('Nominator signature name is required');
    }

    // ========================================
    // VALIDATION: Statement of interest
    // ========================================
    if (!payload.statement_of_interest || payload.statement_of_interest.trim() === '') {
      throw new Error('Statement of interest is required');
    }

    // ========================================
    // RATE LIMITING
    // ========================================
    const now = new Date();
    const rateLimitKey = `pres_nomination_${payload.nominator_email.toLowerCase()}`;
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
      .from('president_nomination_settings')
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
      .from('president_nominations')
      .select('*', { count: 'exact', head: true })
      .ilike('nominee_first_name', sanitizeInput(payload.nominee_first_name))
      .ilike('nominee_last_name', sanitizeInput(payload.nominee_last_name))
      .ilike('nominee_school_district', sanitizeInput(payload.nominee_school_district));

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      throw new Error('Failed to check for duplicate nominations');
    }

    if (existingCount && existingCount > 0) {
      throw new Error('A nomination for this nominee already exists');
    }

    // ========================================
    // INSERT: Create the nomination record
    // ========================================
    const nominationData = {
      nominee_first_name: sanitizeInput(payload.nominee_first_name),
      nominee_last_name: sanitizeInput(payload.nominee_last_name),
      nominee_title: sanitizeInput(payload.nominee_title || ''),
      nominee_school_district: sanitizeInput(payload.nominee_school_district),
      nominee_region: payload.nominee_region,
      nominee_email: payload.nominee_email.toLowerCase().trim(),
      nominee_phone: nomineePhoneDigits,
      nominator_first_name: sanitizeInput(payload.nominator_first_name),
      nominator_last_name: sanitizeInput(payload.nominator_last_name),
      nominator_title: sanitizeInput(payload.nominator_title),
      nominator_school_district: sanitizeInput(payload.nominator_school_district),
      nominator_email: payload.nominator_email.toLowerCase().trim(),
      nominator_phone: nominatorPhoneDigits,
      nominator_certification: true,
      current_member_good_standing: true,
      district_supports_nomination: true,
      district_allows_travel: true,
      district_assumes_expenses: true,
      elected_by_membership: true,
      serves_term: true,
      understands_commitment: true,
      impartial_regarding_vendors: true,
      disclose_conflicts: true,
      professionalism_integrity: true,
      team_player: true,
      no_personal_recognition: true,
      statement_of_interest: sanitizeInput(payload.statement_of_interest),
      nominee_signature_name: sanitizeInput(payload.nominee_signature_name),
      nominee_signature_date: now.toISOString().split('T')[0],
      nominator_signature_name: sanitizeInput(payload.nominator_signature_name),
      nominator_signature_date: now.toISOString().split('T')[0],
      status: 'pending'
    };

    const { data, error } = await supabaseAdmin
      .from('president_nominations')
      .insert([nominationData])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('President nomination submitted successfully:', {
      id: data.id,
      nominee: `${data.nominee_first_name} ${data.nominee_last_name}`,
      region: data.nominee_region
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
        nomineeRegion: data.nominee_region,
        schoolDistrict: data.nominee_school_district,
        termLabel: settings.term_label || '26-27',
        submittedAt
      });

      const emailResult = await sendEmail({
        to: data.nominator_email,
        subject: `TAPT President Nomination Received - ${nomineeName}`,
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
          nominee_name: `${data.nominee_first_name} ${data.nominee_last_name}`,
          region: data.nominee_region
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
    console.error('President Nomination error:', error);
    
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
