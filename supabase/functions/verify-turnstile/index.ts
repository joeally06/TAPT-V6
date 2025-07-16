import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY');
const ALLOWED_ORIGINS = ['https://tapt.org', 'https://tntapt.com', 'http://localhost:5173'];

interface TurnstileVerifyRequest {
  token: string;
  timestamp: number;
}

serve(async (req) => {
  // CORS and security headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Security checks
    const origin = req.headers.get('origin');
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      console.warn('❌ Forbidden origin:', origin);
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (!TURNSTILE_SECRET_KEY) {
      console.error('❌ Turnstile secret key not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const { token, timestamp }: TurnstileVerifyRequest = await req.json();

    // Validate request
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) { // 5 minutes
      return new Response(JSON.stringify({ success: false, error: 'Request too old' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify with Cloudflare
    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    
    // Get client IP from headers
    const clientIP = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip');
    
    if (clientIP) {
      formData.append('remoteip', clientIP);
    }

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = await verifyResponse.json();

    // Log verification attempts
    console.log(`🔒 Turnstile verification: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
      ip: clientIP,
      timestamp: new Date().toISOString(),
      errorCodes: result['error-codes']
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
