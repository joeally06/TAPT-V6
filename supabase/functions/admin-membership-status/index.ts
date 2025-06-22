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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    console.log(`Processing ${req.method} request for membership status`);
    
    // Verify request method
    if (!['POST', 'DELETE'].includes(req.method)) {
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

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log("Received payload:", JSON.stringify(body));
    } catch (error) {
      console.error("Error parsing request JSON:", error);
      throw new Error('Invalid request format: Unable to parse JSON');
    }

    if (!body.id) {
      throw new Error('Application ID is required');
    }

    // Handle POST request (update status)
    if (req.method === 'POST') {
      if (!body.status || !['approved', 'rejected'].includes(body.status)) {
        throw new Error('Valid status (approved or rejected) is required');
      }

      // Update application status
      const { error: updateError } = await supabaseAdmin
        .from('membership_applications')
        .update({ status: body.status })
        .eq('id', body.id);

      if (updateError) {
        console.error("Error updating application status:", updateError);
        throw updateError;
      }

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: `update_membership_status_${body.status}`,
          outcome: 'success',
          details: { application_id: body.id, status: body.status }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }

      console.log("Membership status updated successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Application status updated to ${body.status}`
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
      // Delete the application
      const { error: deleteError } = await supabaseAdmin
        .from('membership_applications')
        .delete()
        .eq('id', body.id);

      if (deleteError) {
        console.error("Error deleting application:", deleteError);
        throw deleteError;
      }

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_membership_application',
          outcome: 'success',
          details: { application_id: body.id }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }

      console.log("Membership application deleted successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Application deleted successfully'
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
    console.error("Error in admin-membership-status function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
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