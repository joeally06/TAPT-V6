import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { 
  getRequestId, 
  createSuccessResponse, 
  createErrorResponse,
  logWithRequestId,
  logErrorWithRequestId,
  createEdgeRequestContext
} from "../_shared/requestId.ts";

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

interface ContactMessage {
  name: string;
  email: string;
  phone?: string;
  district?: string;
  message: string;
  verified?: boolean; // Add verification flag
  turnstileToken?: string; // Add turnstile token
}

// Function to verify Turnstile token
const verifyTurnstileToken = async (token: string, userIP?: string): Promise<boolean> => {
  try {
    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secretKey) {
      console.error('Turnstile secret key not configured');
      return false;
    }

    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (userIP) {
      formData.append('remoteip', userIP);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('🔒 Turnstile verification result:', result.success ? 'SUCCESS' : 'FAILED', {
      errorCodes: result['error-codes']
    });
    
    return result.success === true;
  } catch (error) {
    console.error('❌ Turnstile verification error:', error);
    return false;
  }
};

Deno.serve(async (req) => {
  // Extract or generate request ID
  const requestId = getRequestId(req);
  const requestContext = createEdgeRequestContext(req, requestId);
  
  logWithRequestId(requestId, 'Incoming request', {
    method: requestContext.method,
    url: requestContext.url,
    ip: requestContext.ip
  });
  
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'X-Request-ID': requestId,
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
    logWithRequestId(requestId, "Processing contact message submission");
    
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
    let payload: ContactMessage;
    try {
      payload = await req.json();
      console.log("Received payload:", JSON.stringify({
        name: payload.name,
        email: payload.email,
        verified: payload.verified,
        // Omit message for privacy in logs
      }));
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format: Unable to parse JSON');
    }

    // Validate required fields
    if (!payload.name || !payload.email || !payload.message) {
      throw new Error('Name, email, and message are required fields');
    }

    // Verify Turnstile token if provided
    if (payload.turnstileToken) {
      const clientIP = req.headers.get('cf-connecting-ip') || 
                       req.headers.get('x-forwarded-for') || 
                       req.headers.get('x-real-ip') || 
                       undefined;
      
      const isVerified = await verifyTurnstileToken(payload.turnstileToken, clientIP);
      if (!isVerified) {
        throw new Error('Security verification failed. Please try again.');
      }
      
      console.log('✅ Turnstile verification passed for contact message submission');
    } else if (payload.verified === true) {
      // If marked as verified but no token provided, reject
      throw new Error('Security verification required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      throw new Error('Invalid email format');
    }

    // Check for rate limiting
    const rateLimitKey = `contact_message_${payload.email}`;
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

    // Insert message
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .insert([{
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        district: payload.district || null,
        message: payload.message,
        read_status: false
      }])
      .select()
      .single();

    if (error) throw error;

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: null, // No user for public submissions
        action: 'submit_contact_message',
        outcome: 'success',
        details: { 
          message_id: data.id,
          request_id: requestId
        }
      }]);
    } catch (logError) {
      // Don't fail the request if logging fails
      logErrorWithRequestId(requestId, "Error logging action", logError);
    }

    logWithRequestId(requestId, "Contact message submitted successfully", { id: data.id });

    return createSuccessResponse(
      {
        id: data.id,
        created_at: data.created_at
      },
      requestId,
      200
    );

  } catch (error) {
    logErrorWithRequestId(requestId, "Error in submit-contact-message function", error);
    return createErrorResponse(
      sanitizeError(error),
      requestId,
      400
    );
  }
});