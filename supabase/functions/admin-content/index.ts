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
  console.log("Admin content function called");
  
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
    console.log(`Processing ${req.method} request for admin content`);
    
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
    if (req.method === 'POST') {
      // Create or update content
      let body;
      try {
        body = await req.json();
        console.log("Received payload:", JSON.stringify(body));
      } catch (error) {
        console.error("Error parsing request JSON:", error);
        throw new Error('Invalid request format: Unable to parse JSON');
      }

      // Validate required fields
      const requiredFields = ['title', 'description', 'type', 'status'];
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate content type
      const validTypes = ['event', 'announcement', 'resource', 'news'];
      if (!validTypes.includes(body.type)) {
        throw new Error('Invalid content type');
      }

      // Validate status
      const validStatuses = ['draft', 'published'];
      if (!validStatuses.includes(body.status)) {
        throw new Error('Invalid status');
      }

      // Validate category for news type
      if (body.type === 'news') {
        const validCategories = ['announcements', 'events', 'safety', 'regulations', 'industry'];
        if (!body.category || !validCategories.includes(body.category)) {
          throw new Error('Invalid or missing category for news content');
        }
      }

      // Validate linked_form_type if present
      if (body.linked_form_type) {
        const validFormTypes = ['conference', 'tech-conference', 'hall-of-fame'];
        if (!validFormTypes.includes(body.linked_form_type)) {
          throw new Error('Invalid linked form type');
        }
      }

      // Prepare data for insert/update
      const contentData = {
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        featured: body.featured || false,
        is_featured: body.is_featured || false,
        image_url: body.image_url || null,
        date: body.date || null,
        category: body.category || null,
        link: body.link || null,
        linked_form_type: body.linked_form_type || null
      };

      let result;
      if (body.id) {
        // Update existing content
        const { data, error } = await supabaseAdmin
          .from('content')
          .update(contentData)
          .eq('id', body.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new content
        const { data, error } = await supabaseAdmin
          .from('content')
          .insert([contentData])
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: body.id ? 'update_content' : 'create_content',
          outcome: 'success',
          details: { content_id: result.id, content_type: body.type }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }

      console.log("Content saved successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          data: result
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } 
    else if (req.method === 'DELETE') {
      // Delete content
      let body;
      try {
        body = await req.json();
        console.log("Received delete payload:", JSON.stringify(body));
      } catch (error) {
        console.error("Error parsing request JSON:", error);
        throw new Error('Invalid request format: Unable to parse JSON');
      }

      if (!body.id) {
        throw new Error('Content ID is required');
      }

      // Get content type before deleting (for logging)
      const { data: contentData, error: contentError } = await supabaseAdmin
        .from('content')
        .select('type')
        .eq('id', body.id)
        .single();

      if (contentError && contentError.code !== 'PGRST116') { // Ignore "no rows returned" error
        throw contentError;
      }

      // Delete the content
      const { error: deleteError } = await supabaseAdmin
        .from('content')
        .delete()
        .eq('id', body.id);

      if (deleteError) throw deleteError;

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_content',
          outcome: 'success',
          details: { content_id: body.id, content_type: contentData?.type || 'unknown' }
        }]);
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("Error logging action:", logError);
      }

      console.log("Content deleted successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Content deleted successfully'
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
    console.error("Error in admin-content function:", error);
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