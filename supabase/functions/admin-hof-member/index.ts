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
  console.log("Admin Hall of Fame member function called");
  
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
    'Access-Control-Allow-Methods': 'POST, PUT, DELETE, PATCH, OPTIONS',
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
    console.log(`Processing ${req.method} request for admin Hall of Fame member`);
    
    // Verify request method
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
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
    if (req.method === 'POST' || req.method === 'PUT') {
      // Create or update Hall of Fame member
      let body;
      try {
        body = await req.json();
        console.log("Received payload:", JSON.stringify(body));
      } catch (error) {
        console.error("Error parsing request JSON:", error);
        throw new Error('Invalid request format: Unable to parse JSON');
      }

      // Validate required fields
      const requiredFields = ['name', 'title', 'induction_year', 'bio'];
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Prepare data for insert/update - IMPORTANT: Don't include id in the initial object
      const memberData: any = {
        name: body.name,
        title: body.title,
        role: body.role ?? null,
        organization: body.organization ?? null,
        location: body.location ?? null,
        contact_info: body.contact_info ?? null,
        image_url: body.image_url ?? null,
        website: body.website ?? null,
        notes: body.notes ?? null,
        term: body.term ?? null,
        induction_year: body.induction_year,
        achievements: body.achievements ?? [],
        bio: body.bio
      };

      // Only add id to the object if it exists (for updates)
      if (body.id) {
        memberData.id = body.id;
      }

      let result;
      if (body.id) {
        // Update existing member
        const { data, error } = await supabaseAdmin
          .from('hall_of_fame_members')
          .update(memberData)
          .eq('id', body.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Insert new member
        const { data, error } = await supabaseAdmin
          .from('hall_of_fame_members')
          .insert([memberData])
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: body.id ? 'update_hof_member' : 'create_hof_member',
          outcome: 'success',
          details: { member_id: result.id, name: result.name }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      console.log("Hall of Fame member saved successfully");
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
      // Delete Hall of Fame member
      let body;
      try {
        body = await req.json();
        console.log("Received delete payload:", JSON.stringify(body));
      } catch (error) {
        console.error("Error parsing request JSON:", error);
        throw new Error('Invalid request format: Unable to parse JSON');
      }

      if (!body.id) {
        throw new Error('Member ID is required');
      }

      // Get member data before deleting (for storage cleanup)
      const { data: memberData, error: memberFetchError } = await supabaseAdmin
        .from('hall_of_fame_members')
        .select('image_url')
        .eq('id', body.id)
        .single();

      if (memberFetchError && memberFetchError.code !== 'PGRST116') { // Ignore "no rows returned" error
        throw memberFetchError;
      }

      // Delete the member
      const { error: deleteError } = await supabaseAdmin
        .from('hall_of_fame_members')
        .delete()
        .eq('id', body.id);

      if (deleteError) throw deleteError;

      // Optionally delete image from storage if image_url exists
      if (memberData?.image_url) {
        const imageUrlParts = memberData.image_url.split('/');
        const fileName = imageUrlParts[imageUrlParts.length - 1];
        const folderName = imageUrlParts[imageUrlParts.length - 2]; // Should be 'hall_of_fame'

        if (fileName && folderName === 'hall_of_fame') {
          const { error: storageError } = await supabaseAdmin.storage
            .from('public') // Assuming 'public' bucket for Hall of Fame images
            .remove([`${folderName}/${fileName}`]);

          if (storageError) {
            console.error('Storage delete error:', storageError.message);
            // Log but do not block deletion
          }
        }
      }

      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_hof_member',
          outcome: 'success',
          details: { member_id: body.id, image_url: memberData?.image_url }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      console.log("Hall of Fame member deleted successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Hall of Fame member deleted successfully'
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    else if (req.method === 'PATCH') {
      // Handle reordering
      const body = await req.json();
      if (!body.reorder || !body.members || !Array.isArray(body.members)) {
        throw new Error('Invalid reorder request');
      }
      
      // Update order for each member
      for (const member of body.members) {
        const { error: updateError } = await supabaseAdmin
          .from('hall_of_fame_members')
          .update({ order: member.order })
          .eq('id', member.id);
        
        if (updateError) {
          throw updateError;
        }
      }
      
      // Log the action
      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'reorder_hof_members',
          outcome: 'success',
          details: { members: body.members.map((m: any) => ({ id: m.id, order: m.order })) }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    throw new Error(`Unsupported method: ${req.method}`);
  } catch (error) {
    console.error("Error in admin-hof-member function:", error);
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