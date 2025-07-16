// Frontend configuration - ONLY contains public information
const TURNSTILE_CONFIG = {
  siteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  allowedDomains: ['tapt.org', 'tntapt.com', 'localhost'], // Public domains
  verifyEndpoint: '/api/verify-turnstile' // Your backend endpoint
} as const;

export const getTurnstileSiteKey = (): string => {
  const siteKey = TURNSTILE_CONFIG.siteKey;
  
  if (!siteKey) {
    console.error('❌ Turnstile site key not found in environment variables');
    throw new Error('Turnstile configuration error - missing site key');
  }
  
  return siteKey;
};

export const getVerifyEndpoint = (): string => {
  return TURNSTILE_CONFIG.verifyEndpoint;
};

export const isValidDomain = (): boolean => {
  const currentDomain = window.location.hostname;
  return TURNSTILE_CONFIG.allowedDomains.includes(currentDomain);
};

// Security check - warn if running on unexpected domain
export const validateDomainSecurity = (): void => {
  if (!isValidDomain()) {
    console.warn('⚠️ Running on unregistered domain:', window.location.hostname);
  }
};
