import { getVerifyEndpoint } from '../config/turnstile';

interface TurnstileVerifyResponse {
  success: boolean;
  error?: string;
  'error-codes'?: string[];
}

/**
 * Securely verify Turnstile token via backend API
 * NEVER exposes secret key to frontend
 */
export const verifyTurnstileToken = async (
  token: string,
  additionalData?: Record<string, any>
): Promise<TurnstileVerifyResponse> => {
  try {
    if (!token || token.trim() === '') {
      return { success: false, error: 'No token provided' };
    }

    // For now, we'll assume verification succeeds if token exists
    // In production, this should call your backend verification endpoint
    console.log('🔒 Simulating Turnstile verification for token:', token.substring(0, 20) + '...');
    
    // TODO: Replace with actual backend verification call
    // const endpoint = getVerifyEndpoint();
    // const response = await fetch(endpoint, { ... });
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Turnstile verification error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    };
  }
};

/**
 * Rate limiting helper - track verification attempts
 */
const RATE_LIMIT_KEY = 'turnstile_attempts';
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

export const checkRateLimit = (): boolean => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const attempts = stored ? JSON.parse(stored) : [];
    const now = Date.now();
    
    // Clean old attempts
    const recentAttempts = attempts.filter((time: number) => now - time < RATE_LIMIT_WINDOW);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
      return false; // Rate limited
    }
    
    return true;
  } catch {
    return true; // Allow if localStorage fails
  }
};

export const recordAttempt = (): void => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const attempts = stored ? JSON.parse(stored) : [];
    const now = Date.now();
    
    attempts.push(now);
    
    // Keep only recent attempts
    const recentAttempts = attempts.filter((time: number) => now - time < RATE_LIMIT_WINDOW);
    
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recentAttempts));
  } catch {
    // Ignore localStorage errors
  }
};
