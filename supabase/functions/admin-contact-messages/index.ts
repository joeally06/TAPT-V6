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
  }) ? origin : '*';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Handle GET request - retrieve messages
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      const unreadOnly = url.searchParams.get('unread') === 'true';
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      
      let query = supabaseAdmin.from('contact_messages').select('*', { count: 'exact' });
      
      if (id) {
        query = query.eq('id', id);
      }
      
      if (unreadOnly) {
        query = query.eq('read_status', false);
      }
      
      // Add pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      query = query.order('created_at', { ascending: false }).range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ 
          success: true,
          data,
          count,
          page,
          pageSize
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // Handle PATCH request - update message read status
    if (req.method === 'PATCH') {
      const body = await req.json();
      
      if (!body.id) {
        throw new Error('Message ID is required');
      }
      
      // Update read status
      const { data, error } = await supabaseAdmin
        .from('contact_messages')
        .update({ read_status: body.read_status })
        .eq('id', body.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'update_message_status',
          outcome: 'success',
          details: { message_id: body.id, read_status: body.read_status }
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
    
    // Handle DELETE request - delete message
    if (req.method === 'DELETE') {
      const body = await req.json();
      
      if (!body.id) {
        throw new Error('Message ID is required');
      }
      
      // Delete the message
      const { error } = await supabaseAdmin
        .from('contact_messages')
        .delete()
        .eq('id', body.id);
      
      if (error) throw error;
      
      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_contact_message',
          outcome: 'success',
          details: { message_id: body.id }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true
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