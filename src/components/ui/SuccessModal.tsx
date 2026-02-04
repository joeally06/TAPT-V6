import React, { useEffect, useCallback } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface SuccessModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Main title displayed in the modal */
  title: string;
  /** Primary message content */
  message: string;
  /** Optional secondary message (smaller text) */
  subMessage?: string;
  /** Custom button text (defaults to "OK") */
  buttonText?: string;
}

/**
 * SuccessModal - A reusable modal component for displaying success confirmations.
 * 
 * Features:
 * - Accessible (ARIA labels, focus management)
 * - Keyboard support (Escape to close)
 * - Body scroll lock when open
 * - Click outside to close
 * - Prevents event propagation for modal content
 * 
 * @example
 * <SuccessModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Registration Complete!"
 *   message="Your registration has been submitted."
 *   subMessage="Check your email for confirmation."
 * />
 */
export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  subMessage,
  buttonText = 'OK'
}) => {
  // Memoize the close handler to prevent unnecessary re-renders
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store the current overflow value
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      aria-describedby="success-modal-description"
    >
      {/* Backdrop with fade effect */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal Container - Centered */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full p-1"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Content */}
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" aria-hidden="true" />
            </div>
            
            {/* Title */}
            <h3 
              id="success-modal-title"
              className="text-xl font-bold text-gray-900 mb-2"
            >
              {title}
            </h3>
            
            {/* Main Message */}
            <p 
              id="success-modal-description"
              className="text-gray-600 mb-2"
            >
              {message}
            </p>
            
            {/* Sub Message (optional) */}
            {subMessage && (
              <p className="text-sm text-gray-500 mb-4">
                {subMessage}
              </p>
            )}
            
            {/* OK Button - Auto-focused for accessibility */}
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 w-full inline-flex justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              autoFocus
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
