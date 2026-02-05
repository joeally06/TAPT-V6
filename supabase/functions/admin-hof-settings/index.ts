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
  
  return 'An unexpected error occurred. Please try again.';
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
  }) ? origin : '';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid JWT');
    }

    // Verify user is admin
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userData || userData.role !== 'admin') {
      throw new Error('Unauthorized - Admin access required');
    }

    // Handle different HTTP methods
    if (req.method === 'POST') {
      const body = await req.json();

      // If this is a member creation (not settings), check for member fields
      if (body.name && body.induction_year && body.bio) {
        // Validate required member fields
        const requiredMemberFields = ['name', 'title', 'induction_year', 'bio'];
        for (const field of requiredMemberFields) {
          if (!body[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        // Insert new Hall of Fame member
        const { error: insertError } = await supabaseAdmin
          .from('hall_of_fame_members')
          .insert({
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
          });
        if (insertError) throw insertError;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Validate required fields
      const requiredFields = ['name', 'start_date', 'end_date'];
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate dates
      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);

      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }

      // Update hall of fame settings
      const { error: upsertError } = await supabaseAdmin
        .from('hall_of_fame_settings')
        .upsert({
          id: body.id,
          name: body.name,
          start_date: body.start_date,
          end_date: body.end_date,
          description: body.description,
          nomination_instructions: body.nomination_instructions,
          eligibility_criteria: body.eligibility_criteria,
          is_active: true,
          // Dynamic year configuration
          conference_year_1: body.conference_year_1,
          conference_year_2: body.conference_year_2,
          conference_year_3: body.conference_year_3,
          award_year: body.award_year,
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        throw upsertError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } 
    else if (req.method === 'DELETE') {
      const body = await req.json();
      
      if (body.clear) {
        // Archive current settings
        const { data: currentSettings } = await supabaseAdmin
          .from('hall_of_fame_settings')
          .select('*')
          .eq('is_active', true)
          .single();

        if (currentSettings) {
          // Set current settings to inactive
          const { error: updateError } = await supabaseAdmin
            .from('hall_of_fame_settings')
            .update({ is_active: false })
            .eq('id', currentSettings.id);

          if (updateError) {
            throw updateError;
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    throw new Error(`Unsupported method: ${req.method}`);
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});