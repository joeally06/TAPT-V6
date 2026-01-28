/**
 * Settings Utility for Edge Functions
 * Helper functions to fetch and use site settings in Deno Edge Functions
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SettingsMap {
  [key: string]: string;
}

/**
 * Parse JSONB setting_value to string
 */
function parseSettingValue(jsonbValue: any): string {
  if (typeof jsonbValue === 'string') {
    return jsonbValue;
  }
  return JSON.stringify(jsonbValue);
}

// Default fallback values in case settings can't be fetched
const DEFAULT_SETTINGS: SettingsMap = {
  payment_remittance_name: 'Tennessee Association of Pupil Transportation',
  payment_remittance_address_line1: '123 Main Street',
  payment_remittance_address_line2: 'Suite 100',
  payment_remittance_city: 'Nashville',
  payment_remittance_state: 'TN',
  payment_remittance_zip: '37201',
  payment_contact_email: 'info@tapt.org',
  payment_contact_phone: '(615) 555-0100',
  payment_receipt_footer: 'Thank you for your payment. Please keep this receipt for your records.',
  payment_receipt_subject: 'Payment Receipt - TAPT {{event_name}}',
  site_support_email: 'support@tapt.org',
  site_support_phone: '(615) 555-0100',
  site_organization_name: 'Tennessee Association of Pupil Transportation',
};

/**
 * Fetch all settings from the database
 * Returns a map of key-value pairs for easy access
 */
export async function fetchSettings(
  supabase: SupabaseClient
): Promise<SettingsMap> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('setting_key, setting_value')
      .like('setting_key', 'payment_%');

    if (error) {
      console.error('Error fetching settings:', error);
      return DEFAULT_SETTINGS;
    }

    if (!data || data.length === 0) {
      console.warn('No settings found in database, using defaults');
      return DEFAULT_SETTINGS;
    }

    // Convert array to map, parsing JSONB values
    const settingsMap: SettingsMap = {};
    data.forEach((setting: { setting_key: string; setting_value: any }) => {
      settingsMap[setting.setting_key] = parseSettingValue(setting.setting_value);
    });

    // Merge with defaults to ensure all keys exist
    return { ...DEFAULT_SETTINGS, ...settingsMap };
  } catch (error) {
    console.error('Exception fetching settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Fetch settings by key prefix (replaces category-based filtering)
 */
export async function fetchSettingsByCategory(
  supabase: SupabaseClient,
  category: string
): Promise<SettingsMap> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('setting_key, setting_value')
      .like('setting_key', `${category}_%`);

    if (error) {
      console.error(`Error fetching ${category} settings:`, error);
      return {};
    }

    const settingsMap: SettingsMap = {};
    data?.forEach((setting: { setting_key: string; setting_value: any }) => {
      settingsMap[setting.setting_key] = parseSettingValue(setting.setting_value);
    });

    return settingsMap;
  } catch (error) {
    console.error(`Exception fetching ${category} settings:`, error);
    return {};
  }
}

/**
 * Get a single setting value
 */
export async function getSetting(
  supabase: SupabaseClient,
  key: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) {
      console.warn(`Setting not found: ${key}, using default if available`);
      return DEFAULT_SETTINGS[key] || null;
    }

    return data.value;
  } catch (error) {
    console.error(`Exception fetching setting ${key}:`, error);
    return DEFAULT_SETTINGS[key] || null;
  }
}

/**
 * Format remittance address from settings
 * Returns a formatted HTML address block
 */
export function formatRemittanceAddress(settings: SettingsMap): string {
  const lines = [
    settings.payment_remittance_name,
    settings.payment_remittance_address_line1,
    settings.payment_remittance_address_line2,
    `${settings.payment_remittance_city}, ${settings.payment_remittance_state} ${settings.payment_remittance_zip}`,
  ];

  // Filter out empty lines and format for HTML
  return lines
    .filter(line => line && line.trim())
    .join('<br>');
}

/**
 * Format remittance address as plain text
 */
export function formatRemittanceAddressPlain(settings: SettingsMap): string {
  const lines = [
    settings.payment_remittance_name,
    settings.payment_remittance_address_line1,
    settings.payment_remittance_address_line2,
    `${settings.payment_remittance_city}, ${settings.payment_remittance_state} ${settings.payment_remittance_zip}`,
  ];

  return lines
    .filter(line => line && line.trim())
    .join('\n');
}

/**
 * Replace template variables in a string
 * Example: replaceVariables("Hello {{name}}", { name: "John" }) => "Hello John"
 */
export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * Get payment contact information
 */
export function getPaymentContactInfo(settings: SettingsMap): {
  email: string;
  phone: string;
} {
  return {
    email: settings.payment_contact_email || DEFAULT_SETTINGS.payment_contact_email,
    phone: settings.payment_contact_phone || DEFAULT_SETTINGS.payment_contact_phone,
  };
}

/**
 * Initialize a Supabase client with service role
 * Used for settings that need admin access
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
