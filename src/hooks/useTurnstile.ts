import { useEffect, useRef, useState } from 'react';
import { getTurnstileSiteKey, validateDomainSecurity, isValidDomain } from '../config/turnstile';

declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      getResponse: (widgetId: string) => string;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  retry?: 'auto' | 'never';
}

interface UseTurnstileReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  reset: () => void;
  getResponse: () => string;
  isLoaded: boolean;
  error: string | null;
}

export const useTurnstile = (
  onVerify: (token: string) => void,
  onError?: (error: string) => void
): UseTurnstileReturn => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [widgetId, setWidgetId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Security validation
    validateDomainSecurity();

    // Prevent loading on invalid domains in production
    if (import.meta.env.PROD && !isValidDomain()) {
      setError('Domain not authorized for Turnstile');
      return;
    }

    // Load Turnstile script securely
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    // Note: Add SRI hash in production for additional security
    // script.integrity = 'sha384-...';
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      setIsLoaded(true);
      setError(null);
    };
    
    script.onerror = () => {
      setError('Failed to load Turnstile script');
      onError?.('Failed to load Turnstile script');
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [onError]);

  useEffect(() => {
    if (isLoaded && containerRef.current && window.turnstile && !error) {
      try {
        const siteKey = getTurnstileSiteKey();
        
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          'error-callback': () => {
            const errorMsg = 'Turnstile verification failed';
            setError(errorMsg);
            onError?.(errorMsg);
          },
          'expired-callback': () => {
            const errorMsg = 'Turnstile token expired';
            setError(errorMsg);
            onError?.(errorMsg);
          },
          'timeout-callback': () => {
            const errorMsg = 'Turnstile verification timed out';
            setError(errorMsg);
            onError?.(errorMsg);
          },
          theme: 'auto',
          size: 'normal',
          retry: 'auto'
        });
        
        setWidgetId(id);
      } catch (err) {
        const errorMsg = 'Failed to initialize Turnstile';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    }

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (err) {
          console.warn('Failed to remove Turnstile widget:', err);
        }
      }
    };
  }, [isLoaded, onVerify, onError, error]);

  const reset = () => {
    if (widgetId && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
        setError(null);
      } catch (err) {
        console.error('Failed to reset Turnstile:', err);
      }
    }
  };

  const getResponse = () => {
    if (widgetId && window.turnstile) {
      try {
        return window.turnstile.getResponse(widgetId);
      } catch (err) {
        console.error('Failed to get Turnstile response:', err);
        return '';
      }
    }
    return '';
  };

  return { containerRef, reset, getResponse, isLoaded, error };
};
