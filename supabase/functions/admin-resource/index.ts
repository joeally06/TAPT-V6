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

Deno.serve(async (req) => {
  console.log("Admin resource function called");
  
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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
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
    console.log(`Processing ${req.method} request for admin resource`);
    
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

    // Handle different HTTP methods
    if (req.method === 'DELETE') {
      // Delete resource
      let body;
      try {
        body = await req.json();
        console.log("Received delete payload:", JSON.stringify(body));
      } catch (error) {
        console.error("Error parsing request JSON:", error);
        throw new Error('Invalid request format: Unable to parse JSON');
      }

      if (!body.id) {
        throw new Error('Resource ID is required');
      }

      // Get resource data before deleting (for storage cleanup)
      const { data: resourceData, error: resourceError } = await supabaseAdmin
        .from('resources')
        .select('file_url')
        .eq('id', body.id)
        .single();

      if (resourceError && resourceError.code !== 'PGRST116') { // Ignore "no rows returned" error
        throw resourceError;
      }

      // Delete the resource
      const { error: deleteError } = await supabaseAdmin
        .from('resources')
        .delete()
        .eq('id', body.id);

      if (deleteError) throw deleteError;

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_resource',
          outcome: 'success',
          details: { resource_id: body.id, file_url: resourceData?.file_url }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }

      console.log("Resource deleted successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Resource deleted successfully'
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
    console.error("Error in admin-resource function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: sanitizeError(error),
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