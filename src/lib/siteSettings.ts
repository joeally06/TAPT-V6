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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not defined');
    }

    // First try to get from Edge Function for most up-to-date value
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/admin-site-settings?key=${encodeURIComponent(key)}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && result.data.length > 0) {
            // The value is already parsed by the Supabase client
            return result.data[0].setting_value;
          }
        }
      } catch (error) {
        console.error('Error fetching from Edge Function:', error);
        // Fall back to direct query
      }
    }

    // Fall back to direct query
    const { data, error } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error) throw error;
    
    // Return the value directly without parsing it again
    // Supabase client already deserializes JSONB columns
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update site setting');
    }

    return true;
  } catch (error) {
    console.error(`Error updating site setting ${key}:`, error);
    throw error;
  }
};