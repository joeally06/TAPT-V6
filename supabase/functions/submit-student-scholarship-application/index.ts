import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://tapt.org',
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

// Utility to sanitize error messages
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

interface ScholarshipApplication {
  fullName: {
    first: string;
    last: string;
  };
  birthdate: string;
  gender?: string;
  isUsCitizen?: boolean;
  applicationStatus: string;
  isFirstGen?: boolean;
  majorArea?: string;
  careerObjective?: string;
  highSchool: string;
  schoolDistrict: string;
  graduationYear: string;
  gpa?: string;
  activities?: string;
  actYear?: string;
  actScore?: string;
  essay: string;
  homeAddress: {
    addr_line1: string;
    addr_line2?: string;
    city: string;
    state: string;
    postal: string;
  };
  mobilePhone: string;
  email: string;
  signature: string;
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
    console.log("Processing scholarship application submission");
    
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

    // Parse request body
    let payload: ScholarshipApplication;
    try {
      payload = await req.json();
      console.log("Received payload:", JSON.stringify({
        name: `${payload.fullName.first} ${payload.fullName.last}`,
        email: payload.email,
        // Omit other fields for privacy in logs
      }));
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format: Unable to parse JSON');
    }

    // Validate required fields
    const requiredFields = [
      'fullName',
      'birthdate',
      'applicationStatus',
      'highSchool',
      'schoolDistrict',
      'graduationYear',
      'essay',
      'homeAddress',
      'mobilePhone',
      'email',
      'signature'
    ];

    for (const field of requiredFields) {
      if (!payload[field as keyof ScholarshipApplication]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new Error('Invalid email format');
    }

    // Validate essay length (300-500 words)
    const essayWords = payload.essay.trim().split(/\s+/).length;
    if (essayWords < 300 || essayWords > 500) {
      throw new Error(`Essay must be between 300-500 words. Current word count: ${essayWords}`);
    }

    // Check for rate limiting
    const rateLimitKey = `scholarship_${payload.email}`;
    const { data: rateLimit } = await supabaseAdmin
      .from('rate_limits')
      .select('count, last_attempt')
      .eq('key', rateLimitKey)
      .single();

    const now = new Date();
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

    // Check if application period is open
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('student_scholarship_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (settingsError) {
      throw new Error('Failed to check application period');
    }

    if (!settings) {
      throw new Error('Scholarship application is not currently open');
    }

    // Check if application deadline has passed
    const deadlineDate = new Date(settings.application_deadline);
    if (now > deadlineDate) {
      throw new Error(`Application deadline was ${deadlineDate.toLocaleDateString()}`);
    }

    // Insert application
    const { data, error } = await supabaseAdmin
      .from('student_scholarship_applications')
      .insert([{
        full_name: payload.fullName,
        birthdate: new Date(payload.birthdate),
        gender: payload.gender,
        is_us_citizen: payload.isUsCitizen,
        application_status: payload.applicationStatus,
        is_first_gen: payload.isFirstGen,
        major_area: payload.majorArea,
        career_objective: payload.careerObjective,
        high_school: payload.highSchool,
        school_district: payload.schoolDistrict,
        graduation_year: payload.graduationYear,
        gpa: payload.gpa,
        activities: payload.activities,
        act_year: payload.actYear,
        act_score: payload.actScore,
        essay: payload.essay,
        home_address: payload.homeAddress,
        mobile_phone: payload.mobilePhone,
        email: payload.email,
        signature: payload.signature
      }])
      .select()
      .single();

    if (error) throw error;

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: null, // No user for public submissions
        action: 'submit_scholarship_application',
        outcome: 'success',
        details: { application_id: data.id }
      }]);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("Error logging action:", logError);
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