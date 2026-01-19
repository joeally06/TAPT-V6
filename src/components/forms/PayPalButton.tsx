import React, { useEffect, useRef, useState } from 'react';
import { PAYPAL_CONFIG, PayPalOrderDetails } from '@/config/paypal';

interface PayPalButtonProps {
  amount: number;
  currency?: string;
  onSuccess: (details: PayPalOrderDetails) => void;
  onError: (error: any) => void;
  onCancel?: () => void;
  disabled?: boolean;
  description?: string;
}

// Extend Window interface for PayPal SDK
declare global {
  interface Window {
    paypal?: any;
  }
}

export function PayPalButton({
  amount,
  currency = 'USD',
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  description = 'TAPT Registration Payment'
}: PayPalButtonProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const buttonsRenderedRef = useRef(false);

  // Track if component is mounted
  useEffect(() => {
    return () => {
      buttonsRenderedRef.current = false;
    };
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    // Check if PayPal client ID is configured
    if (!PAYPAL_CONFIG.clientId) {
      setError('PayPal is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    // Check if PayPal SDK is already loaded
    if (window.paypal) {
      console.log('✅ PayPal SDK already loaded');
      setSdkReady(true);
      setLoading(false);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="paypal.com/sdk/js"]`);
    if (existingScript) {
      console.log('📦 PayPal SDK script already exists, waiting...');
      existingScript.addEventListener('load', () => {
        setSdkReady(true);
        setLoading(false);
      });
      return;
    }

    // Load PayPal SDK
    console.log('📦 Loading PayPal SDK...');
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CONFIG.clientId}&currency=${currency}&intent=${PAYPAL_CONFIG.intent}`;
    script.async = true;
    
    script.onload = () => {
      console.log('✅ PayPal SDK loaded successfully');
      setSdkReady(true);
      setLoading(false);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load PayPal SDK');
      setError('Failed to load PayPal. Please refresh the page and try again.');
      setLoading(false);
      onError(new Error('Failed to load PayPal SDK'));
    };

    document.body.appendChild(script);

    // Don't remove the script on unmount - it should stay loaded
  }, [currency, onError]);

  // Render PayPal buttons
  useEffect(() => {
    // Don't render buttons if payment is already complete
    if (paymentComplete || buttonsRenderedRef.current) {
      return;
    }

    if (sdkReady && paypalRef.current && !disabled && !error && window.paypal) {
      // Clear any existing buttons
      paypalRef.current.innerHTML = '';

      try {
        console.log('🔧 Rendering PayPal Buttons for amount:', amount);
        
        const buttons = window.paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            console.log('💳 Creating PayPal order...');
            return actions.order.create({
              purchase_units: [{
                description,
                amount: {
                  currency_code: currency,
                  value: amount.toFixed(2)
                }
              }],
              application_context: {
                shipping_preference: 'NO_SHIPPING' // No shipping required for registration
              }
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              console.log('✅ Payment approved, capturing order...');
              const details = await actions.order.capture();
              console.log('✅ Payment captured successfully:', details);
              
              // Mark payment as complete to prevent re-rendering
              setPaymentComplete(true);
              onSuccess(details);
            } catch (captureError) {
              console.error('❌ Error capturing payment:', captureError);
              onError(captureError);
            }
          },
          onError: (err: any) => {
            console.error('❌ PayPal error:', err);
            onError(err);
          },
          onCancel: (data: any) => {
            console.log('⚠️ Payment cancelled by user');
            if (onCancel) {
              onCancel();
            }
          },
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
            height: 45
          }
        });
        
        // Render if container exists
        if (paypalRef.current) {
          buttons.render(paypalRef.current).then(() => {
            console.log('✅ PayPal Buttons rendered');
            buttonsRenderedRef.current = true;
          }).catch((renderErr: any) => {
            console.error('❌ PayPal render promise error:', renderErr);
          });
        }
      } catch (renderError) {
        console.error('❌ PayPal Buttons render error:', renderError);
        setError('Failed to render payment buttons. Please refresh and try again.');
        onError(renderError);
      }
    }
  }, [sdkReady, amount, currency, description, onSuccess, onError, onCancel, disabled, error, paymentComplete]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-600">Loading PayPal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Reload Page
        </button>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-green-700 font-medium">Payment completed successfully!</p>
        <p className="text-green-600 text-sm mt-1">Please complete the security verification below and submit your registration.</p>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500">PayPal payment is currently disabled</p>
      </div>
    );
  }

  return (
    <div className="paypal-button-container">
      <div ref={paypalRef} className="min-h-[150px]" />
    </div>
  );
}
