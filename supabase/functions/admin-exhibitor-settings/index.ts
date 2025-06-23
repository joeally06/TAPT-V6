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
    'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE',
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
    if (!['POST', 'DELETE'].includes(req.method)) {
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

    // Handle different HTTP methods
    if (req.method === 'POST') {
      const body = await req.json();

      // Validate required fields
      const requiredFields = ['name', 'start_date', 'end_date', 'registration_end_date', 'location', 'venue', 'fee', 'payment_instructions'];
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate dates
      const startDate = new Date(body.start_date);
      const endDate = new Date(body.end_date);
      const regEndDate = new Date(body.registration_end_date);

      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }

      if (regEndDate > startDate) {
        throw new Error('Registration end date must be before or on start date');
      }

      // Update exhibitor settings
      const { error: upsertError } = await supabaseAdmin
        .from('exhibitor_settings')
        .upsert({
          id: body.id,
          name: body.name,
          start_date: body.start_date,
          end_date: body.end_date,
          registration_end_date: body.registration_end_date,
          location: body.location,
          venue: body.venue,
          fee: body.fee,
          payment_instructions: body.payment_instructions,
          description: body.description,
          is_active: true,
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
          .from('exhibitor_settings')
          .select('*')
          .eq('is_active', true)
          .single();

        if (currentSettings) {
          // Set current settings to inactive
          const { error: updateError } = await supabaseAdmin
            .from('exhibitor_settings')
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
      } else if (body.rollover) {
        // Archive current registrations
        const { error: archiveError } = await supabaseAdmin.rpc('archive_exhibitor_registrations');
        
        if (archiveError) {
          throw archiveError;
        }
        
        // Update settings
        if (body.settings) {
          const { error: upsertError } = await supabaseAdmin
            .from('exhibitor_settings')
            .upsert({
              ...body.settings,
              is_active: true,
              updated_at: new Date().toISOString()
            });

          if (upsertError) {
            throw upsertError;
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});