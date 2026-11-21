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

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_DAYS = 14;
const CLOSING_WINDOW_DAYS = 30;
const ACTIVITY_LIMIT = 8;
// Reading the dashboard and listing users are logged too; they would fill the activity feed.
const NOISY_ACTIONS = ['fetch_dashboard_stats', 'list_users'];

const PAYMENT_PROGRAMS = [
  { key: 'conference', label: 'Annual Conference', table: 'conference_registrations', path: '/admin/conference-registrations' },
  { key: 'techConference', label: 'Tech Conference', table: 'tech_conference_registrations', path: '/admin/tech-conference-registrations' },
  { key: 'exhibitor', label: 'Exhibitors', table: 'exhibitor_registrations', path: '/admin/exhibitor-registrations' }
];

// Each settings table names its closing date differently.
const CLOSING_SOURCES = [
  { label: 'Conference registration', table: 'conference_settings', column: 'registration_end_date', path: '/admin/conference-settings' },
  { label: 'Tech Conference registration', table: 'tech_conference_settings', column: 'registration_end_date', path: '/admin/tech-conference-settings' },
  { label: 'Exhibitor registration', table: 'exhibitor_settings', column: 'registration_end_date', path: '/admin/exhibitor-settings' },
  { label: 'Regional Luncheon registration', table: 'regional_luncheon_settings', column: 'registration_deadline', path: '/admin/regional-luncheon-settings' },
  { label: 'Scholarship applications', table: 'student_scholarship_settings', column: 'application_deadline', path: '/admin/student-scholarship-settings' },
  { label: 'Hall of Fame nominations', table: 'hall_of_fame_settings', column: 'end_date', path: '/admin/hall-of-fame-settings' },
  { label: 'Regional Director nominations', table: 'regional_director_nomination_settings', column: 'end_date', path: '/admin/regional-director-nomination-settings' },
  { label: 'President nominations', table: 'president_nomination_settings', column: 'end_date', path: '/admin/president-nomination-settings' }
];

// total_amount can be null (exhibitors) or a numeric string
const toAmount = (value: unknown): number => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

// Reads a whole table in pages so the default 1000-row limit cannot cut a total short.
// deno-lint-ignore no-explicit-any
async function fetchAllRows(supabaseAdmin: any, table: string, columns: string): Promise<any[]> {
  const pageSize = 1000;
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

// deno-lint-ignore no-explicit-any
async function countRows(supabaseAdmin: any, table: string): Promise<number | null> {
  const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`Failed to count ${table}:`, error.message);
    return null;
  }
  return count ?? 0;
}

// Read-only figures for the admin dashboard. Called inside its own try/catch so a failure
// here never breaks the existing stats.
// deno-lint-ignore no-explicit-any
async function buildDashboard(supabaseAdmin: any, scholarshipApplications: number) {
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const overdueBefore = now - OVERDUE_DAYS * DAY_MS;

  // Money and payment status for the three programs that take payments
  let overdueCount = 0;
  let overdueAmount = 0;
  const programs = [];
  const paymentRows = await Promise.all(
    PAYMENT_PROGRAMS.map((program) =>
      fetchAllRows(supabaseAdmin, program.table, 'payment_method, payment_status, total_amount, created_at')
    )
  );
  for (const [index, program] of PAYMENT_PROGRAMS.entries()) {
    const rows = paymentRows[index];
    let paid = 0;
    let awaiting = 0;
    let collected = 0;
    let outstanding = 0;
    let newThisWeek = 0;
    for (const row of rows) {
      const amount = toAmount(row.total_amount);
      const createdAt = Date.parse(row.created_at);
      if (createdAt >= weekAgo) newThisWeek++;
      if (row.payment_status === 'completed') {
        paid++;
        collected += amount;
      } else if (row.payment_status === 'pending') {
        awaiting++;
        outstanding += amount;
        // "Unpaid" matches the Payment Management page: purchase orders still pending
        if (row.payment_method === 'po' && createdAt < overdueBefore) {
          overdueCount++;
          overdueAmount += amount;
        }
      }
    }
    programs.push({
      key: program.key,
      label: program.label,
      path: program.path,
      registered: rows.length,
      paid,
      awaiting,
      collected: roundMoney(collected),
      outstanding: roundMoney(outstanding),
      newThisWeek
    });
  }

  // Programs that are counted but do not take payments here
  const luncheonCount = await countRows(supabaseAdmin, 'regional_luncheon_registrations');
  const others = [
    { key: 'regionalLuncheon', label: 'Regional Luncheon', path: '/admin/regional-luncheon-registrations', count: luncheonCount },
    { key: 'scholarships', label: 'Scholarship applications', path: '/admin/student-scholarship-applications', count: scholarshipApplications }
  ].filter((item) => item.count !== null);

  // Active forms that close soon
  const windowStart = Date.parse(new Date(now).toISOString().slice(0, 10)) - DAY_MS;
  const windowEnd = now + CLOSING_WINDOW_DAYS * DAY_MS;
  const closingRows = await Promise.all(
    CLOSING_SOURCES.map(async (source) => {
      try {
        const { data, error } = await supabaseAdmin
          .from(source.table)
          .select(`name, ${source.column}`)
          .eq('is_active', true);
        if (error) {
          console.error(`Failed to read ${source.table}:`, error.message);
          return [];
        }
        // deno-lint-ignore no-explicit-any
        return (data ?? []).map((row: any) => ({ source, row }));
      } catch (readError) {
        console.error(`Failed to read ${source.table}:`, readError);
        return [];
      }
    })
  );
  const closing = [];
  for (const { source, row } of closingRows.flat()) {
    const value = row[source.column];
    const closesOn = typeof value === 'string' ? value.slice(0, 10) : '';
    const closesAt = Date.parse(closesOn);
    if (Number.isNaN(closesAt) || closesAt < windowStart || closesAt > windowEnd) continue;
    closing.push({ label: source.label, name: row.name ?? null, closes_at: closesOn, path: source.path });
  }
  closing.sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at));

  // Recent admin and form activity, without the dashboard's own reads
  const { data: logs, error: logsError } = await supabaseAdmin
    .from('admin_logs')
    .select('id, user_id, action, timestamp')
    .eq('outcome', 'success')
    .not('action', 'in', `(${NOISY_ACTIONS.join(',')})`)
    .order('timestamp', { ascending: false })
    .limit(ACTIVITY_LIMIT);
  if (logsError) throw new Error(`Failed to read activity: ${logsError.message}`);

  // deno-lint-ignore no-explicit-any
  const userIds = [...new Set((logs ?? []).map((log: any) => log.user_id).filter(Boolean))];
  const emailById = new Map<string, string>();
  // Best effort: an id that cannot be looked up just shows as an unnamed admin.
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id as string);
        if (error) console.error('Could not look up an activity user:', error.message);
        if (data?.user?.email) emailById.set(id as string, data.user.email);
      } catch (lookupError) {
        console.error('Could not look up an activity user:', lookupError);
      }
    })
  );
  // deno-lint-ignore no-explicit-any
  const activity = (logs ?? []).map((log: any) => ({
    id: log.id,
    action: log.action,
    at: log.timestamp,
    actor: log.user_id ? (emailById.get(log.user_id) ?? null) : null
  }));

  return {
    programs,
    others,
    unpaidOverdue: { count: overdueCount, amount: roundMoney(overdueAmount), days: OVERDUE_DAYS },
    closing,
    activity
  };
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
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

    // Get exhibitor registrations count
    const { count: exhibitorRegistrations, error: exhibitorError } = await supabaseAdmin
      .from('exhibitor_registrations')
      .select('*', { count: 'exact', head: true });

    if (exhibitorError) {
      throw new Error(`Failed to count exhibitor registrations: ${exhibitorError.message}`);
    }

    // Get student scholarship applications count
    const { count: scholarshipApplications, error: scholarshipError } = await supabaseAdmin
      .from('student_scholarship_applications')
      .select('*', { count: 'exact', head: true });

    if (scholarshipError) {
      throw new Error(`Failed to count scholarship applications: ${scholarshipError.message}`);
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

    // Get upcoming events count (compare using date-only string since events store YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0]; // e.g. '2026-02-14'
    const { count: upcomingEvents, error: eventsError } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'event')
      .eq('status', 'published')
      .gte('date', today);

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

    // New dashboard data. A failure here must not break the stats above.
    let dashboard = null;
    try {
      dashboard = await buildDashboard(supabaseAdmin, scholarshipApplications ?? 0);
    } catch (dashboardError) {
      console.error('Error building dashboard data:', dashboardError);
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
          exhibitorRegistrations,
          scholarshipApplications,
          nominations,
          pendingNominations,
          upcomingEvents
        },
        recentActivities,
        dashboard
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