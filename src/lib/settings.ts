/**
 * Settings Utility Functions
 * Helper functions for fetching and managing site settings
 * Includes caching to reduce database calls
 */

import { supabase } from './supabase';
import type { SiteSetting, ParsedSetting, SettingsMap } from '@/types/settings';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: SettingsMap;
  timestamp: number;
}

const settingsCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse JSONB setting_value to string
 */
function parseSettingValue(jsonbValue: any): string {
  if (typeof jsonbValue === 'string') {
    return jsonbValue;
  }
  return JSON.stringify(jsonbValue);
}

/**
 * Fetch all settings from the database
 * Uses caching to reduce database load
 */
export async function fetchAllSettings(forceRefresh = false): Promise<SettingsMap> {
  const cacheKey = 'all_settings';
  
  // Check cache first
  if (!forceRefresh) {
    const cached = settingsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value');

  if (error) {
    console.error('Error fetching settings:', error);
    return {};
  }

  // Convert array to map for easier access
  const settingsMap: SettingsMap = {};
  data?.forEach((setting: { setting_key: string; setting_value: any }) => {
    settingsMap[setting.setting_key] = parseSettingValue(setting.setting_value);
  });

  // Update cache
  settingsCache.set(cacheKey, {
    data: settingsMap,
    timestamp: Date.now(),
  });

  return settingsMap;
}

/**
 * Fetch settings by key prefix (replaces category filtering)
 * For example, 'payment' will return all keys starting with 'payment_'
 */
export async function fetchSettingsByCategory(
  category: string,
  forceRefresh = false
): Promise<ParsedSetting[]> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, setting_key, setting_value, updated_at')
    .like('setting_key', `${category}_%`)
    .order('setting_key', { ascending: true });

  if (error) {
    console.error(`Error fetching ${category} settings:`, error);
    return [];
  }

  // Parse JSONB values
  return (data || []).map(row => ({
    id: row.id,
    key: row.setting_key,
    value: parseSettingValue(row.setting_value),
    updated_at: row.updated_at
  }));
}

/**
 * Get a single setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const settings = await fetchAllSettings();
  return settings[key] || null;
}

/**
 * Update a single setting
 * Invalidates cache on success
 */
export async function updateSetting(
  key: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  // Define optional fields that can be empty
  const optionalFields = ['payment_remittance_address_line2'];
  
  // Input validation and sanitization
  const sanitizedValue = sanitizeSettingValue(value);
  
  // Allow empty values for optional fields
  if (!sanitizedValue && !optionalFields.includes(key)) {
    return { success: false, error: 'Value cannot be empty' };
  }

  const { error } = await supabase
    .from('site_settings')
    .update({ 
      setting_value: sanitizedValue,
      updated_at: new Date().toISOString()
    })
    .eq('setting_key', key);

  if (error) {
    console.error('Error updating setting:', error);
    return { success: false, error: error.message };
  }

  // Clear cache to force refresh on next fetch
  settingsCache.clear();

  return { success: true };
}

/**
 * Sanitize setting values to prevent XSS
 * Removes HTML tags and script content
 */
export function sanitizeSettingValue(value: string): string {
  // Trim whitespace
  let sanitized = value.trim();
  
  // Remove HTML tags (basic XSS protection)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Limit length (already enforced in DB but good to check)
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
  }
  
  return sanitized;
}

/**
 * Validate a setting value based on its key
 */
export function validateSetting(key: string, value: string): { valid: boolean; error?: string } {
  const trimmedValue = value.trim();
  
  // Email validation
  if (key.includes('email')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedValue)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
  }
  
  // Phone validation (optional format check)
  if (key.includes('phone')) {
    const phoneRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/;
    if (trimmedValue && !phoneRegex.test(trimmedValue)) {
      return { valid: false, error: 'Phone format: (615) 555-0100' };
    }
  }
  
  // ZIP code validation
  if (key.includes('zip')) {
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(trimmedValue)) {
      return { valid: false, error: 'ZIP format: 12345 or 12345-6789' };
    }
  }
  
  // State code validation
  if (key.includes('state') && !key.includes('statement')) {
    const stateRegex = /^[A-Z]{2}$/;
    if (!stateRegex.test(trimmedValue)) {
      return { valid: false, error: 'Use 2-letter state code (e.g., TN)' };
    }
  }
  
  // General length check
  if (trimmedValue.length === 0) {
    return { valid: false, error: 'Value cannot be empty' };
  }
  
  if (trimmedValue.length > 2000) {
    return { valid: false, error: 'Value is too long (max 2000 characters)' };
  }
  
  return { valid: true };
}

/**
 * Format remittance address from settings
 * Returns a formatted multi-line address string
 */
export function formatRemittanceAddress(settings: SettingsMap): string {
  const lines = [
    settings['payment_remittance_name'],
    settings['payment_remittance_address_line1'],
    settings['payment_remittance_address_line2'],
    `${settings['payment_remittance_city']}, ${settings['payment_remittance_state']} ${settings['payment_remittance_zip']}`,
  ];
  
  // Filter out empty lines and join
  return lines.filter(line => line && line.trim()).join('\n');
}

/**
 * Get payment contact information
 */
export async function getPaymentContactInfo(): Promise<{
  email: string;
  phone: string;
}> {
  const settings = await fetchAllSettings();
  return {
    email: settings['payment_contact_email'] || 'info@tapt.org',
    phone: settings['payment_contact_phone'] || '(615) 555-0100',
  };
}

/**
 * Clear the settings cache
 * Useful for testing or forcing a refresh
 */
export function clearSettingsCache(): void {
  settingsCache.clear();
}
