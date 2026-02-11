import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
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
  }) ? origin : '';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get Supabase client
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

    // Verify user is admin via RPC to avoid RLS recursion
    const { data: userRole, error: roleError } = await supabaseAdmin
      .rpc('get_user_role', { user_id: user.id });

    if (roleError || userRole !== 'admin') {
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
        throw new Error('Conference end date must be after conference start date');
      }

      if (regEndDate > startDate) {
        throw new Error('Registration end date must be before or on the conference start date');
      }

      // Validate meal_price if provided
      let mealPrice: number | undefined;
      if (body.meal_price !== undefined) {
        mealPrice = parseFloat(body.meal_price);
        if (isNaN(mealPrice) || mealPrice < 0) {
          throw new Error('Meal price must be a non-negative number');
        }
      }

      // Validate meals_available if provided
      if (body.meals_available !== undefined) {
        if (!Array.isArray(body.meals_available)) {
          throw new Error('meals_available must be an array');
        }
        // Enforce max 20 meals to prevent abuse
        if (body.meals_available.length > 20) {
          throw new Error('Maximum of 20 meals allowed');
        }
        const seenIds = new Set<string>();
        for (const meal of body.meals_available) {
          if (!meal.id || typeof meal.id !== 'string' || meal.id.length > 100) {
            throw new Error('Each meal must have a valid string id (max 100 chars)');
          }
          if (!meal.label || typeof meal.label !== 'string' || meal.label.length > 200) {
            throw new Error('Each meal must have a valid string label (max 200 chars)');
          }
          if (typeof meal.enabled !== 'boolean') {
            throw new Error('Each meal must have a boolean enabled field');
          }
          // Sanitize: only allow alphanumeric + underscores in IDs
          if (!/^[a-z0-9_]+$/.test(meal.id)) {
            throw new Error('Meal IDs must contain only lowercase letters, numbers, and underscores');
          }
          if (seenIds.has(meal.id)) {
            throw new Error(`Duplicate meal ID: ${meal.id}`);
          }
          seenIds.add(meal.id);
        }
      }

      // Build upsert data
      const upsertData: Record<string, unknown> = {
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
      };

      // Include meal fields if provided
      if (mealPrice !== undefined) {
        upsertData.meal_price = mealPrice;
      }
      if (body.meals_available !== undefined) {
        // Store only sanitized fields
        upsertData.meals_available = body.meals_available.map((m: { id: string; label: string; enabled: boolean }) => ({
          id: m.id,
          label: m.label,
          enabled: m.enabled
        }));
      }

      // Update tech conference settings
      const { error: upsertError } = await supabaseAdmin
        .from('tech_conference_settings')
        .upsert(upsertData);

      if (upsertError) {
        throw upsertError;
      }

      console.log('✅ Tech conference settings saved successfully (including meal config)');
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
          .from('tech_conference_settings')
          .select('*')
          .eq('is_active', true)
          .single();

        if (currentSettings) {
          // Set current settings to inactive
          const { error: updateError } = await supabaseAdmin
            .from('tech_conference_settings')
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});