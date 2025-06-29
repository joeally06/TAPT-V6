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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // Verify user is admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      throw new Error('Unauthorized - Admin access required');
    }

    // Handle GET request - retrieve settings
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const key = url.searchParams.get('key');
      
      let query = supabaseAdmin.from('site_settings').select('*');
      
      if (key) {
        query = query.eq('setting_key', key);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // Handle POST request - update settings
    if (req.method === 'POST') {
      const body = await req.json();
      
      if (!body.key || body.value === undefined) {
        throw new Error('Missing required fields: key and value');
      }
      
      // Upsert the setting with explicit onConflict option
      const { data, error } = await supabaseAdmin
        .from('site_settings')
        .upsert({
          setting_key: body.key,
          setting_value: body.value
        }, {
          onConflict: 'setting_key'  // Explicitly specify the conflict resolution column
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'update_site_setting',
          outcome: 'success',
          details: { key: body.key }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    throw new Error(`Unsupported method: ${req.method}`);
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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