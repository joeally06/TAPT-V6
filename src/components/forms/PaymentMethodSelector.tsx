import React from 'react';
import { DollarSign, FileText } from 'lucide-react';

export interface PaymentMethodSelectorProps {
  selectedMethod: 'po' | 'paypal' | null;
  onMethodChange: (method: 'po' | 'paypal') => void;
  amount: number;
  poNumber?: string;
  onPoNumberChange?: (poNumber: string) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  amount,
  poNumber = '',
  onPoNumberChange,
  disabled = false
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Payment Method <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Purchase Order Option */}
          <button
            type="button"
            onClick={() => onMethodChange('po')}
            disabled={disabled}
            className={`
              relative flex items-center p-6 border-2 rounded-lg transition-all
              ${selectedMethod === 'po'
                ? 'border-primary bg-blue-50 ring-2 ring-primary'
                : 'border-gray-300 hover:border-gray-400'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <FileText className={`w-8 h-8 mr-4 ${selectedMethod === 'po' ? 'text-primary' : 'text-gray-400'}`} />
            <div className="text-left flex-1">
              <div className="font-semibold text-gray-900">Purchase Order</div>
              <div className="text-sm text-gray-500">Pay via PO number</div>
            </div>
            {selectedMethod === 'po' && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>

          {/* PayPal Option */}
          <button
            type="button"
            onClick={() => onMethodChange('paypal')}
            disabled={disabled}
            className={`
              relative flex items-center p-6 border-2 rounded-lg transition-all
              ${selectedMethod === 'paypal'
                ? 'border-primary bg-blue-50 ring-2 ring-primary'
                : 'border-gray-300 hover:border-gray-400'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <DollarSign className={`w-8 h-8 mr-4 ${selectedMethod === 'paypal' ? 'text-primary' : 'text-gray-400'}`} />
            <div className="text-left flex-1">
              <div className="font-semibold text-gray-900">PayPal</div>
              <div className="text-sm text-gray-500">Pay securely online</div>
            </div>
            {selectedMethod === 'paypal' && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* PO Number Input */}
      {selectedMethod === 'po' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Purchase Order Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="poNumber"
            value={poNumber}
            onChange={(e) => onPoNumberChange?.(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="Enter PO number"
            required
            disabled={disabled}
          />
          <p className="text-sm text-yellow-700 mt-2">
            💡 Payment will be processed after receiving your purchase order. You will receive an invoice via email.
          </p>
        </div>
      )}

      {/* PayPal Summary */}
      {selectedMethod === 'paypal' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Amount to Pay:</span>
            <span className="text-2xl font-bold text-primary">${amount.toFixed(2)}</span>
          </div>
          <p className="text-sm text-blue-700">
            🔒 You will complete payment securely through PayPal before submitting your registration.
          </p>
        </div>
      )}
    </div>
  );
}
