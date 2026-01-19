/**
 * PayPal Configuration
 * Get credentials from https://developer.paypal.com/dashboard/applications
 */

export const PAYPAL_CONFIG = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
  currency: 'USD',
  intent: 'capture', // lowercase required by PayPal SDK
  // Use sandbox for development, live for production
  environment: import.meta.env.VITE_ENV === 'production' ? 'production' : 'sandbox'
} as const;

/**
 * Get PayPal SDK script URL
 */
export const getPayPalScriptUrl = (): string => {
  if (!PAYPAL_CONFIG.clientId) {
    console.error('❌ PayPal Client ID not configured');
    return '';
  }
  
  return `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CONFIG.clientId}&currency=${PAYPAL_CONFIG.currency}&intent=${PAYPAL_CONFIG.intent}`;
};

/**
 * Validate PayPal configuration
 */
export const isPayPalConfigured = (): boolean => {
  if (!PAYPAL_CONFIG.clientId) {
    console.warn('⚠️ PayPal Client ID not configured. PayPal payments will be disabled.');
    return false;
  }
  return true;
};

/**
 * PayPal transaction details interface
 */
export interface PayPalOrderDetails {
  id: string;
  status: string;
  payer?: {
    email_address?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
  purchase_units?: Array<{
    amount?: {
      currency_code?: string;
      value?: string;
    };
  }>;
  create_time?: string;
  update_time?: string;
}
