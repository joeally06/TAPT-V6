/**
 * Site Settings Types
 * Type definitions for the site_settings table
 */

export interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: any; // JSONB field
  created_at: string;
  updated_at: string;
}

export interface ParsedSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export type SettingCategory = 'payment' | 'general' | 'email' | 'other';

export interface SettingsMap {
  [key: string]: string;
}

/**
 * Payment-specific settings keys
 */
export const PAYMENT_SETTING_KEYS = {
  REMITTANCE_NAME: 'payment_remittance_name',
  REMITTANCE_ADDRESS_LINE1: 'payment_remittance_address_line1',
  REMITTANCE_ADDRESS_LINE2: 'payment_remittance_address_line2',
  REMITTANCE_CITY: 'payment_remittance_city',
  REMITTANCE_STATE: 'payment_remittance_state',
  REMITTANCE_ZIP: 'payment_remittance_zip',
  CONTACT_EMAIL: 'payment_contact_email',
  CONTACT_PHONE: 'payment_contact_phone',
  RECEIPT_FOOTER: 'payment_receipt_footer',
  RECEIPT_SUBJECT: 'payment_receipt_subject',
} as const;

/**
 * General settings keys
 */
export const GENERAL_SETTING_KEYS = {
  SUPPORT_EMAIL: 'site_support_email',
  SUPPORT_PHONE: 'site_support_phone',
  ORGANIZATION_NAME: 'site_organization_name',
} as const;

/**
 * Validation rules for different setting types
 */
export interface SettingValidationRule {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  required?: boolean;
  errorMessage?: string;
}

export const SETTING_VALIDATION: Record<string, SettingValidationRule> = {
  [PAYMENT_SETTING_KEYS.CONTACT_EMAIL]: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMessage: 'Please enter a valid email address',
    required: true,
  },
  [GENERAL_SETTING_KEYS.SUPPORT_EMAIL]: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMessage: 'Please enter a valid email address',
    required: true,
  },
  [PAYMENT_SETTING_KEYS.CONTACT_PHONE]: {
    pattern: /^\(\d{3}\)\s\d{3}-\d{4}$/,
    errorMessage: 'Phone format: (615) 555-0100',
    required: false,
  },
  [PAYMENT_SETTING_KEYS.REMITTANCE_ZIP]: {
    pattern: /^\d{5}(-\d{4})?$/,
    errorMessage: 'ZIP format: 12345 or 12345-6789',
    required: true,
  },
  [PAYMENT_SETTING_KEYS.REMITTANCE_STATE]: {
    maxLength: 2,
    minLength: 2,
    pattern: /^[A-Z]{2}$/,
    errorMessage: 'Use 2-letter state code (e.g., TN)',
    required: true,
  },
};
