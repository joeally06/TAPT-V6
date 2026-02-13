import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { Turnstile } from '../ui/Turnstile';
import { getTurnstileSiteKey } from '../../config/turnstile';
import { checkRateLimit, recordAttempt } from '../../utils/turnstileVerification';

interface SecureFormProps {
  children: React.ReactNode;
  onSubmit: (data: any, isVerified: boolean, turnstileToken?: string) => Promise<void>;
  className?: string;
  requireTurnstile?: boolean;
  disabled?: boolean;
  submitButtonText?: string;
}

export interface SecureFormHandle {
  resetTurnstile: () => void;
}

export const SecureForm = forwardRef<SecureFormHandle, SecureFormProps>(({
  children,
  onSubmit,
  className = "",
  requireTurnstile = true,
  disabled = false,
  submitButtonText = "Submit"
}, ref) => {
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const turnstileResetRef = useRef<(() => void) | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose reset method to parent
  useImperativeHandle(ref, () => ({
    resetTurnstile: () => {
      console.log('🔒 SecureForm: Resetting Turnstile widget');
      if (turnstileResetRef.current) {
        turnstileResetRef.current();
        setTurnstileToken('');
        setIsVerified(false);
        setTurnstileError(null);
        setIsExpired(false);
      }
      // Clear any pending auto-reset timer
      if (expireTimerRef.current) {
        clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
    }
  }));

  const handleTurnstileReset = useCallback((resetFn: () => void) => {
    turnstileResetRef.current = resetFn;
  }, []);

  const handleTurnstileVerify = useCallback((token: string) => {
    console.log('🔒 SecureForm: Turnstile token received:', token ? 'Token present' : 'Empty token');
    console.log('🔒 SecureForm: Token length:', token?.length || 0);
    setTurnstileToken(token);
    setTurnstileError(null);
    setIsVerified(false); // Will verify on submit
    setIsExpired(false);
  }, []);

  const handleTurnstileError = useCallback((error: string) => {
    setTurnstileError(error);
    setTurnstileToken('');
    setIsVerified(false);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    console.log('🔒 SecureForm: Turnstile token expired, auto-resetting...');
    setTurnstileToken('');
    setIsVerified(false);
    setTurnstileError(null);
    setIsExpired(true);

    // Auto-reset the widget after a short delay so the user sees the message
    // Clear any existing timer to prevent stacking
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current);
    }
    expireTimerRef.current = setTimeout(() => {
      if (turnstileResetRef.current) {
        console.log('🔒 SecureForm: Auto-resetting Turnstile widget after expiration');
        turnstileResetRef.current();
      }
      expireTimerRef.current = null;
    }, 1000);
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
      console.log('🔒 SecureForm: No turnstile token available for submission');
      if (isExpired) {
        setTurnstileError('Your security verification expired. Please wait for it to refresh, then try again.');
      } else {
        setTurnstileError('Please complete the security verification');
      }
      return;
    }

    console.log('🔒 SecureForm: About to submit with token:', turnstileToken ? 'Token present' : 'Empty token');
    console.log('🔒 SecureForm: Token length at submission:', turnstileToken?.length || 0);

    setIsSubmitting(true);
    setTurnstileError(null);
    setSubmitError(null);
    setIsExpired(false);

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
      setIsExpired(false);
      
      // Reset the Turnstile widget to get a fresh token for the next submission
      if (turnstileResetRef.current) {
        console.log('🔒 SecureForm: Resetting Turnstile widget after successful submission');
        turnstileResetRef.current();
      }
      
    } catch (error) {
      console.error('❌ Form submission error:', error);
      // Display form/submission errors separately from Turnstile security errors
      setSubmitError(error instanceof Error ? error.message : 'Submission failed');
      setIsVerified(false);
      
      // Reset the Turnstile widget on error to get a fresh token for retry
      // Turnstile tokens are single-use, so we need a new one after any submission attempt
      if (turnstileResetRef.current) {
        console.log('🔒 SecureForm: Resetting Turnstile widget after error');
        turnstileResetRef.current();
        setTurnstileToken('');
      }
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
            onExpire={handleTurnstileExpire}
            onResetReady={handleTurnstileReset}
            className="mb-4"
          />
          
          {/* Token expired — friendly amber message with auto-reset notice */}
          {isExpired && !turnstileToken && !turnstileError && (
            <div className="text-amber-800 text-sm bg-amber-50 p-3 rounded border border-amber-300">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">Security verification expired</p>
                  <p className="mt-1">This can happen when the page is open for a while. A new verification is loading automatically — please wait a moment, then you can submit your form.</p>
                </div>
              </div>
            </div>
          )}

          {turnstileError && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
              <div className="flex items-start">
                <span className="mr-2 flex-shrink-0" aria-hidden="true">🔒</span>
                <div>
                  <p>{turnstileError}</p>
                  {isExpired && (
                    <button
                      type="button"
                      onClick={() => {
                        if (turnstileResetRef.current) {
                          turnstileResetRef.current();
                          setTurnstileError(null);
                          setIsExpired(false);
                        }
                      }}
                      className="mt-2 text-red-700 underline hover:text-red-900 font-medium"
                    >
                      Click here to refresh verification
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {!turnstileToken && !turnstileError && !isExpired && (
            <div className="text-yellow-700 text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
              🔒 Waiting for security verification to complete...
            </div>
          )}

          {turnstileToken && !turnstileError && (
            <div className="text-green-600 text-sm bg-green-50 p-2 rounded border border-green-200">
              ✅ Security verification complete. You may submit the form.
            </div>
          )}

          {submitError && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200 mt-2">
              ⚠️ {submitError}
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
          submitButtonText
        )}
      </button>
    </form>
  );
});
