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
  console.log("Admin user function called");
  
  const origin = req.headers.get('Origin') || '';
  // Check if origin matches any allowed pattern (including wildcards)
  const allowOrigin = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';
  
  const responseCorsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: responseCorsHeaders 
    });
  }

  try {
    console.log(`Processing ${req.method} request for admin user`);
    
    // Verify request method
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
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

    if (req.method === 'GET') {
      console.log("Fetching users list");
      
      // Fetch all users
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        throw listError;
      }

      // Get roles from users table
      const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('users')
        .select('id, role');

      if (rolesError) {
        throw rolesError;
      }

      // Create a map of user roles
      const roleMap = new Map(rolesData.map(user => [user.id, user.role]));

      // Combine the data
      const users = authUsers.users.map(authUser => ({
        id: authUser.id,
        email: authUser.email,
        role: roleMap.get(authUser.id) || 'user',
        created_at: authUser.created_at
      }));

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'list_users',
          outcome: 'success',
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      console.log(`Found ${users.length} users`);
      return new Response(
        JSON.stringify({ 
          success: true,
          users
        }),
        { 
          headers: {
            ...responseCorsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else if (req.method === 'POST') {
      console.log("Creating new user");
      
      // Create new user
      const payload = await req.json();
      console.log("Received payload:", JSON.stringify({
        email: payload.email,
        role: payload.role
        // Omitting password for security
      }));

      // Check if user already exists in auth
      const { data: existingUsers } = await supabaseAdmin
        .from('auth.users')
        .select('id')
        .eq('email', payload.email)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('A user with this email already exists');
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        throw createError || new Error('Failed to create user');
      }

      // Check if user already exists in users table
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', newUser.user.id)
        .single();

      if (!existingUser) {
        // Only insert if user doesn't exist
        const { error: roleError } = await supabaseAdmin
          .from('users')
          .insert([{
            id: newUser.user.id,
            role: payload.role,
          }]);

        if (roleError) {
          // Cleanup: delete the auth user if role assignment fails
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          throw roleError;
        }
      }

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'create_user',
          outcome: 'success',
          details: { created_user: newUser.user.id, email: payload.email, role: payload.role }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      console.log("User created successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          user: {
            id: newUser.user.id,
            email: newUser.user.email,
            role: payload.role,
          }
        }),
        { 
          headers: {
            ...responseCorsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else if (req.method === 'DELETE') {
      console.log("Deleting user");
      
      // Delete user
      const payload = await req.json();
      console.log("Received payload:", JSON.stringify(payload));

      // First, verify the user exists in auth
      const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(
        payload.userId
      );

      if (authUserError || !authUser.user) {
        throw new Error('User not found in auth system');
      }

      // Check if user exists and is not the last admin
      const { data: userToDelete, error: userCheckError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', payload.userId)
        .single();

      if (userCheckError) {
        throw new Error(`Failed to check user status: ${userCheckError.message}`);
      }

      if (userToDelete?.role === 'admin') {
        // Count remaining admins
        const { count, error: countError } = await supabaseAdmin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');

        if (countError) {
          throw new Error(`Failed to count admins: ${countError.message}`);
        }

        if (count === 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      // Delete any conference registrations associated with the user
      const { error: regDeleteError } = await supabaseAdmin
        .from('conference_registrations')
        .delete()
        .eq('id', payload.userId);

      if (regDeleteError) {
        console.error('Error deleting conference registrations:', regDeleteError);
        // Continue with deletion even if this fails
      }

      // Delete the user from the users table first
      const { error: userDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', payload.userId);

      if (userDeleteError) {
        throw new Error(`Failed to delete user from users table: ${userDeleteError.message}`);
      }

      // Finally, delete user from auth
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        payload.userId
      );

      if (deleteAuthError) {
        // If auth deletion fails, we should try to rollback the users table deletion
        try {
          await supabaseAdmin
            .from('users')
            .insert([{ id: payload.userId, role: userToDelete?.role || 'user' }]);
        } catch (rollbackError) {
          console.error('Failed to rollback user deletion:', rollbackError);
        }
        throw new Error(`Failed to delete user from auth: ${deleteAuthError.message}`);
      }

      try {
        await supabaseAdmin.from('admin_logs').insert([{
          user_id: user.id,
          action: 'delete_user',
          outcome: 'success',
          details: { deleted_user: payload.userId }
        }]);
      } catch (logError) {
        console.error("Error logging action:", logError);
      }

      console.log("User deleted successfully");
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User deleted successfully'
        }),
        { 
          headers: {
            ...responseCorsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

  } catch (error) {
    console.error("Error in admin-user function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: sanitizeError(error),
      }),
      { 
        status: 400,
        headers: {
          ...responseCorsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});