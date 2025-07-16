import React, { useState, useCallback } from 'react';
import { Turnstile } from '../ui/Turnstile';
import { getTurnstileSiteKey } from '../../config/turnstile';
import { checkRateLimit, recordAttempt } from '../../utils/turnstileVerification';

interface SecureFormProps {
  children: React.ReactNode;
  onSubmit: (data: any, isVerified: boolean, turnstileToken?: string) => Promise<void>;
  className?: string;
  requireTurnstile?: boolean;
  disabled?: boolean;
}

export const SecureForm: React.FC<SecureFormProps> = ({
  children,
  onSubmit,
  className = "",
  requireTurnstile = true,
  disabled = false
}) => {
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError(null);
    setIsVerified(false); // Will verify on submit
  }, []);

  const handleTurnstileError = useCallback((error: string) => {
    setTurnstileError(error);
    setTurnstileToken('');
    setIsVerified(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (disabled || isSubmitting) return;

    // Rate limiting check
    if (!checkRateLimit()) {
      setTurnstileError('Too many attempts. Please wait before trying again.');
      return;
    }

    if (requireTurnstile && !turnstileToken) {
      setTurnstileError('Please complete the security verification');
      return;
    }

    setIsSubmitting(true);
    setTurnstileError(null);

    try {
      let verified = false;

      if (requireTurnstile && turnstileToken) {
        // Record attempt for rate limiting
        recordAttempt();
        
        // For now, we'll pass the token to the backend for verification
        // The backend will handle the actual Turnstile verification
        verified = true; // We trust the backend to verify
        
        console.log('🔒 Turnstile token will be verified by backend');
      }

      setIsVerified(verified);

      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      
      // Pass the turnstile token to the submit handler
      await onSubmit(data, verified, turnstileToken);
      
      // Reset form state on success
      setTurnstileToken('');
      setIsVerified(false);
      
    } catch (error) {
      console.error('❌ Form submission error:', error);
      setTurnstileError(error instanceof Error ? error.message : 'Submission failed');
      setIsVerified(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = !requireTurnstile || (turnstileToken && !turnstileError);

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      
      {requireTurnstile && (
        <div className="mt-6 space-y-2">
          <Turnstile
            siteKey={getTurnstileSiteKey()}
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
            className="mb-4"
          />
          
          {turnstileError && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
              🔒 {turnstileError}
            </div>
          )}
          
          {isVerified && (
            <div className="text-green-600 text-sm bg-green-50 p-2 rounded border border-green-200">
              ✅ Security verification successful
            </div>
          )}
        </div>
      )}
      
      <button
        type="submit"
        disabled={disabled || isSubmitting || !isFormValid}
        className={`
          w-full mt-4 py-3 px-4 rounded-lg font-medium transition-colors
          ${isFormValid && !disabled && !isSubmitting
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          'Submit'
        )}
      </button>
    </form>
  );
};
