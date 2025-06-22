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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    if (req.method !== 'GET') {
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

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      throw new Error(`Failed to count users: ${usersError.message}`);
    }

    // Get conference registrations count
    const { count: conferenceRegistrations, error: confError } = await supabaseAdmin
      .from('conference_registrations')
      .select('*', { count: 'exact', head: true });

    if (confError) {
      throw new Error(`Failed to count conference registrations: ${confError.message}`);
    }

    // Get tech conference registrations count
    const { count: techConferenceRegistrations, error: techConfError } = await supabaseAdmin
      .from('tech_conference_registrations')
      .select('*', { count: 'exact', head: true });

    if (techConfError) {
      throw new Error(`Failed to count tech conference registrations: ${techConfError.message}`);
    }

    // Get hall of fame nominations count
    const { count: nominations, error: nomError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*', { count: 'exact', head: true });

    if (nomError) {
      throw new Error(`Failed to count hall of fame nominations: ${nomError.message}`);
    }

    // Get pending nominations count
    const { count: pendingNominations, error: pendingError } = await supabaseAdmin
      .from('hall_of_fame_nominations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingError) {
      throw new Error(`Failed to count pending nominations: ${pendingError.message}`);
    }

    // Get upcoming events count
    const { count: upcomingEvents, error: eventsError } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'event')
      .eq('status', 'published')
      .gt('date', new Date().toISOString());

    if (eventsError) {
      throw new Error(`Failed to count upcoming events: ${eventsError.message}`);
    }

    // Get recent activities
    const { data: recentActivities, error: activitiesError } = await supabaseAdmin
      .from('admin_logs')
      .select('*')
      .eq('outcome', 'success')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (activitiesError) {
      throw new Error(`Failed to fetch recent activities: ${activitiesError.message}`);
    }

    // Log the action
    try {
      await supabaseAdmin.from('admin_logs').insert([{
        user_id: user.id,
        action: 'fetch_dashboard_stats',
        outcome: 'success',
        details: { timestamp: new Date().toISOString() }
      }]);
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error("Error logging action:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        stats: {
          totalUsers,
          conferenceRegistrations,
          techConferenceRegistrations,
          nominations,
          pendingNominations,
          upcomingEvents
        },
        recentActivities
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