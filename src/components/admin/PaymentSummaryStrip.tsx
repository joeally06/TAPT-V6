import React from 'react';
import { formatMoney } from '../../lib/dashboard';
import { OVERDUE_DAYS, type PaymentSummary } from '../../lib/registrationPayments';
import { StatCard } from './RegistrationListParts';

interface PaymentSummaryStripProps {
  summary: PaymentSummary | null;
  // True when the totals could not be loaded
  unavailable?: boolean;
}

// Totals for the whole table, not just the rows on the page.
export const PaymentSummaryStrip: React.FC<PaymentSummaryStripProps> = ({ summary, unavailable = false }) => {
  if (!summary && unavailable) {
    return (
      <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Payment totals could not be loaded. The list below still works.
      </p>
    );
  }
  if (!summary) {
    return <div className="h-[62px] animate-pulse rounded-lg bg-gray-200" aria-hidden="true" />;
  }
  return (
    <div>
      {unavailable && (
        <p role="status" className="mb-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Payment totals could not be refreshed and may be out of date.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4" aria-label="Payment summary" role="group">
        <StatCard label="Registered" value={String(summary.registered)} />
        <StatCard label="Paid" value={String(summary.paid)} note={formatMoney(summary.collected) + ' collected'} />
        <StatCard
          label="Awaiting payment"
          value={String(summary.awaiting)}
          note={summary.overdue > 0 ? `${summary.overdue} overdue ${OVERDUE_DAYS}+ days` : undefined}
        />
        <StatCard label="Outstanding" value={formatMoney(summary.outstanding)} />
      </div>
    </div>
  );
};

export default PaymentSummaryStrip;
