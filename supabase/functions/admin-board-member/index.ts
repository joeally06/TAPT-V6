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
      const pattern = allowed.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...securityHeaders
  };

  // Always return CORS headers for all responses
  if (req.method === 'OPTIONS') {
    // Preflight response must include all CORS headers
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    if (req.method === 'DELETE') {
      // Parse JSON body for id and image info
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders });
      }
      const token = authHeader.replace('Bearer ', '');
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
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const body = await req.json();
      if (!body.id) {
        return new Response(JSON.stringify({ error: 'Missing board member id' }), { status: 400, headers: corsHeaders });
      }
      // Delete board member
      const { error: deleteError } = await supabaseAdmin.from('board_members').delete().eq('id', body.id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: corsHeaders });
      }
      // Optionally delete image from storage if image info provided
      if (body.image) {
        const { error: storageError } = await supabaseAdmin.storage.from('board-members').remove([body.image]);
        if (storageError) {
          // Log but do not block deletion
          console.error('Storage delete error:', storageError.message);
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    if (req.method === 'PATCH') {
      // Handle reordering
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders });
      }
      const token = authHeader.replace('Bearer ', '');
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
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const body = await req.json();
      if (!body.reorder || !body.members || !Array.isArray(body.members)) {
        return new Response(JSON.stringify({ error: 'Invalid reorder request' }), { status: 400, headers: corsHeaders });
      }
      
      // Update order for each member
      for (const member of body.members) {
        const { error: updateError } = await supabaseAdmin
          .from('board_members')
          .update({ order: member.order })
          .eq('id', member.id);
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: corsHeaders });
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
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

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    // Validate required fields (add more as needed)
    if (!body.name || !body.title) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
    }

    // Upsert board member
    const { error: upsertError } = await supabaseAdmin.from('board_members').upsert({
      id: body.id,
      name: body.name,
      title: body.title,
      district: body.district ?? null,
      bio: body.bio ?? null,
      image: body.image ?? null,
      order: body.order ?? 0
    });
    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: securityHeaders });
  }
});