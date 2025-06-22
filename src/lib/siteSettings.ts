import { supabase } from './supabase';

export interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  created_at: string;
  updated_at: string;
}

// Get a site setting by key
export const getSiteSetting = async (key: string): Promise<any> => {
  try {
    // Always use direct database query for reliability
    // Edge Function can be used as an optimization later when properly deployed
    const { data, error } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();

    if (error) {
      console.error(`Database error getting site setting ${key}:`, error);
      return null;
    }
    
    // Return the value directly - Supabase client already deserializes JSONB columns
    return data ? data.setting_value : null;
  } catch (error) {
    console.error(`Error getting site setting ${key}:`, error);
    return null;
  }
};

// Update a site setting (admin only)
export const updateSiteSetting = async (key: string, value: any): Promise<boolean> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not defined');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Try Edge Function first for admin operations
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-site-settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ key, value })
        }
      );

      if (response.ok) {
        return true;
      }
      
      // If Edge Function fails, fall back to direct database update
      console.warn('Edge Function failed, falling back to direct database update');
    } catch (fetchError) {
      console.warn('Edge Function not available, using direct database update:', fetchError);
    }

    // Fallback to direct database update
    const { error } = await supabase
      .from('site_settings')
      .upsert({ 
        setting_key: key, 
        setting_value: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`Error updating site setting ${key}:`, error);
    throw error;
  }
};