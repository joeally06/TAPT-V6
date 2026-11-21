import React from 'react';
import type { PaymentState, PaymentTone } from '../../lib/registrationPayments';

const TONE_CLASSES: Record<PaymentTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700'
};

// Payment status as words plus a colored dot, so color is never the only signal.
export const PaymentStatusBadge: React.FC<{ state: PaymentState; showDetail?: boolean }> = ({
  state,
  showDetail = true
}) => (
  <div>
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[state.tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {state.label}
    </span>
    {showDetail && state.detail && <p className="mt-0.5 text-xs text-gray-500">{state.detail}</p>}
  </div>
);

export default PaymentStatusBadge;
