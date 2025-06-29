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

// Helper to log admin role actions
type RoleChangeLogEntry = {
  action: string;
  requesting_user_id: string | null;
  target_user_id: string | null;
  outcome: 'success' | 'failure';
  error?: string;
  details?: any;
};
async function logRoleChange(supabaseAdmin: any, entry: RoleChangeLogEntry) {
  try {
    await supabaseAdmin.from('role_change_audit').insert([
      {
        action: entry.action,
        requesting_user_id: entry.requesting_user_id,
        target_user_id: entry.target_user_id,
        success: entry.outcome === 'success',
        timestamp: new Date().toISOString(),
        error: entry.error || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    ]);
    // TODO: Integrate alerting/monitoring for repeated failures
  } catch (e) {
    // Logging failure should not block main flow
  }
}

interface RoleAssignmentPayload {
  userId: string;
}

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
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

    // Verify the requesting user exists and is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { userId }: RoleAssignmentPayload = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Verify the user exists in auth.users
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      userId
    );

    if (userError || !authUser.user) {
      throw new Error('User not found');
    }

    // Check if any admin exists
    const { count: adminCount, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (countError) {
      throw new Error('Failed to check admin count');
    }

    // --- Audit Logging and Rate Limiting ---
    // Rate limiting: allow max 5 role changes per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateError } = await supabaseAdmin
      .from('role_change_audit')
      .select('*', { count: 'exact', head: true })
      .eq('requesting_user_id', user.id)
      .gte('timestamp', oneHourAgo);
    if (rateError) {
      throw new Error('Failed to check rate limit');
    }
    if (recentCount && recentCount >= 5) {
      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: user.id,
        target_user_id: userId,
        outcome: 'failure',
        error: 'Rate limit exceeded',
        details: { error: 'Rate limit exceeded' }
      });
      throw new Error('Rate limit exceeded for role changes');
    }

    // If no admin exists, allow the first user to become admin
    if (adminCount === 0) {
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: userId,
          role: 'admin'
        });

      if (insertError) {
        await logRoleChange(supabaseAdmin, {
          action: 'assign_admin',
          requesting_user_id: user.id,
          target_user_id: userId,
          outcome: 'failure',
          error: 'Failed to assign admin role',
          details: { error: insertError.message }
        });
        throw new Error('Failed to assign admin role');
      }

      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: user.id,
        target_user_id: userId,
        outcome: 'success',
        details: { message: 'Admin role assigned successfully' }
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Admin role assigned successfully'
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // If admins exist, only allow existing admins to assign admin role
    const { data: requestingUser, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: user.id,
        target_user_id: userId,
        outcome: 'failure',
        error: 'Failed to verify user role',
        details: { error: roleError.message }
      });
      throw new Error('Failed to verify user role');
    }

    if (!requestingUser || requestingUser.role !== 'admin') {
      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: user.id,
        target_user_id: userId,
        outcome: 'failure',
        error: 'Only existing admins can assign admin role',
        details: { error: 'Only existing admins can assign admin role' }
      });
      throw new Error('Only existing admins can assign admin role');
    }

    // Assign admin role
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        role: 'admin'
      });

    if (updateError) {
      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: user.id,
        target_user_id: userId,
        outcome: 'failure',
        error: 'Failed to assign admin role',
        details: { error: updateError.message }
      });
      throw new Error('Failed to assign admin role');
    }

    await logRoleChange(supabaseAdmin, {
      action: 'assign_admin',
      requesting_user_id: user.id,
      target_user_id: userId,
      outcome: 'success',
      details: { message: 'Admin role assigned successfully' }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Admin role assigned successfully'
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error.message);

    // On error, log failed attempt
    try {
      // Re-create supabaseAdmin if not in scope (for Deno Edge Functions, must be inside handler)
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
      // Try to extract userId and requesting user from request body if possible
      let userId = null;
      try {
        const body = await req.json();
        userId = body.userId || null;
      } catch {}
      await logRoleChange(supabaseAdmin, {
        action: 'assign_admin',
        requesting_user_id: null,
        target_user_id: userId,
        outcome: 'failure',
        error: error.message,
        details: { error: error.message }
      });
    } catch (auditError) {
      // [SECURITY] Monitoring/alerting hook: failed to log audit event
      // TODO: Integrate with alerting system
    }

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