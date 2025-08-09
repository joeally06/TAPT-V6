import { createClient } from "npm:@supabase/supabase-js@2.39.3";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Update the content type constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE content DROP CONSTRAINT IF EXISTS valid_content_type;
        ALTER TABLE content ADD CONSTRAINT valid_content_type CHECK (
          type IN ('event', 'announcement', 'resource', 'news', 'links', 'resources-page')
        );
      `
    });

    if (error) {
      console.error('Error updating constraint:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
