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
  }) ? origin : '*';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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
    // Verify request method
    if (!['GET', 'DELETE'].includes(req.method)) {
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

    // Handle GET request - fetch registrations
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const sortField = url.searchParams.get('sortField') || 'created_at';
      const sortDirection = url.searchParams.get('sortDirection') || 'desc';
      const searchTerm = url.searchParams.get('search') || '';
      
      // Calculate pagination range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Build query
      let query = supabaseAdmin
        .from('exhibitor_registrations')
        .select('*', { count: 'exact' });
      
      // Add search if provided
      if (searchTerm) {
        query = query.or(`business_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      // Add sorting and pagination
      query = query
        .order(sortField, { ascending: sortDirection === 'asc' })
        .range(from, to);
      
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
    
    // Handle DELETE request
    if (req.method === 'DELETE') {
      const body = await req.json();
      
      // Clear all registrations
      if (body.clear) {
        // First, archive current registrations
        const { data: registrations, error: fetchError } = await supabaseAdmin
          .from('exhibitor_registrations')
          .select('*');
        
        if (fetchError) throw fetchError;
        
        if (registrations && registrations.length > 0) {
          // Generate archive ID
          const archiveId = crypto.randomUUID();
          
          // Prepare archive data
          const archiveData = registrations.map(reg => ({
            ...reg,
            id: crypto.randomUUID(),
            original_id: reg.id,
            archived_at: new Date().toISOString(),
            archive_id: archiveId
          }));
          
          // Insert into archive
          const { error: archiveError } = await supabaseAdmin
            .from('exhibitor_registrations_archive')
            .insert(archiveData);
          
          if (archiveError) throw archiveError;
          
          // Delete all registrations
          const { error: deleteError } = await supabaseAdmin
            .from('exhibitor_registrations')
            .delete()
            .not('id', 'is', null);
          
          if (deleteError) throw deleteError;
          
          // Log the action
          try {
            await supabaseAdmin.from('admin_logs').insert([{
              user_id: user.id,
              action: 'clear_exhibitor_registrations',
              outcome: 'success',
              details: { count: registrations.length, archive_id: archiveId }
            }]);
          } catch (logError) {
            // Don't fail the request if logging fails
            console.error("Error logging action:", logError);
          }
        }
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'All exhibitor registrations cleared and archived successfully'
          }),
          { 
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      // Delete single registration
      if (body.id) {
        // Get registration data before deleting (for logging)
        const { data: registration, error: fetchError } = await supabaseAdmin
          .from('exhibitor_registrations')
          .select('*')
          .eq('id', body.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Delete the registration
        const { error: deleteError } = await supabaseAdmin
          .from('exhibitor_registrations')
          .delete()
          .eq('id', body.id);
        
        if (deleteError) throw deleteError;
        
        // Log the action
        try {
          await supabaseAdmin.from('admin_logs').insert([{
            user_id: user.id,
            action: 'delete_exhibitor_registration',
            outcome: 'success',
            details: { registration_id: body.id, business_name: registration.business_name }
          }]);
        } catch (logError) {
          // Don't fail the request if logging fails
          console.error("Error logging action:", logError);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Exhibitor registration deleted successfully'
          }),
          { 
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      throw new Error('Invalid delete request: missing id or clear parameter');
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