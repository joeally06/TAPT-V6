import React, { useEffect } from 'react';
import { useTurnstile } from '../../hooks/useTurnstile';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  onResetReady?: (resetFn: () => void) => void;
  className?: string;
}

export const Turnstile: React.FC<TurnstileProps> = ({ 
  siteKey, 
  onVerify, 
  onError,
  onExpire,
  onResetReady,
  className = "" 
}) => {
  const { containerRef, reset, isLoaded, error } = useTurnstile(onVerify, onError, onExpire);

  // Expose reset function to parent
  useEffect(() => {
    if (onResetReady && reset) {
      onResetReady(reset);
    }
  }, [reset, onResetReady]);

  return (
    <div className={`turnstile-container ${className}`}>
      <div ref={containerRef} />
      {!isLoaded && !error && (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-gray-500">Loading security verification...</div>
        </div>
      )}
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
          🔒 {error}
        </div>
      )}
    </div>
  );
};
