import React from 'react';
import type { PaymentState, PaymentTone } from '../../lib/registrationPayments';

const TONE_CLASSES: Record<PaymentTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700'
};

// Payment status as words plus a colored dot, so color is never the only signal.
// `method` (for example "PayPal") goes on the grey line under the pill, before the detail.
export const PaymentStatusBadge: React.FC<{ state: PaymentState; showDetail?: boolean; method?: string | null }> = ({
  state,
  showDetail = true,
  method = null
}) => {
  const subline = showDetail ? [method, state.detail].filter(Boolean).join(' · ') : '';
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${TONE_CLASSES[state.tone]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {state.label}
      </span>
      {subline && <p className="mt-0.5 text-xs text-gray-500">{subline}</p>}
    </div>
  );
};

export default PaymentStatusBadge;
