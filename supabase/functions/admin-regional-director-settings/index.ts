import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: role, error: roleError } = await supabaseAdmin.rpc('get_user_role', { user_id: user.id });
    if (roleError || role !== 'admin') throw new Error('Unauthorized - Admin access required');

    // ========================================
    // POST: Upsert settings
    // ========================================
    if (req.method === 'POST') {
      const body = await req.json();

      const requiredFields = ['name', 'start_date', 'end_date'];
      for (const field of requiredFields) {
        if (!body[field]) throw new Error(`Missing required field: ${field}`);
      }

      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);
      if (endDate <= startDate) throw new Error('End date must be after start date');

      const settingsData = {
        id: body.id,
        name: body.name,
        start_date: body.start_date,
        end_date: body.end_date,
        description: body.description || null,
        nomination_instructions: body.nomination_instructions || null,
        is_active: body.is_active ?? true,
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabaseAdmin
        .from('regional_director_nomination_settings')
        .upsert(settingsData);

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // DELETE: Clear settings
    // ========================================
    if (req.method === 'DELETE') {
      const { error: deleteError } = await supabaseAdmin
        .from('regional_director_nomination_settings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error("Error in admin-regional-director-settings:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
