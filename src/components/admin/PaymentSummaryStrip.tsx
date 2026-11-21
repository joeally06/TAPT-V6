import React from 'react';
import { formatMoney } from '../../lib/dashboard';
import { OVERDUE_DAYS, type PaymentSummary } from '../../lib/registrationPayments';

interface PaymentSummaryStripProps {
  summary: PaymentSummary | null;
  // True when the totals could not be loaded
  unavailable?: boolean;
}

const Stat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums text-tapt-navy">{value}</p>
    {note && <p className="text-xs text-gray-500">{note}</p>}
  </div>
);

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
    return <div className="h-[78px] animate-pulse rounded-lg bg-gray-200" aria-hidden="true" />;
  }
  return (
    <div>
      {unavailable && (
        <p role="status" className="mb-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Payment totals could not be refreshed and may be out of date.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Payment summary" role="group">
        <Stat label="Registered" value={String(summary.registered)} />
        <Stat label="Paid" value={String(summary.paid)} note={formatMoney(summary.collected) + ' collected'} />
        <Stat
          label="Awaiting payment"
          value={String(summary.awaiting)}
          note={summary.overdue > 0 ? `${summary.overdue} overdue ${OVERDUE_DAYS}+ days` : undefined}
        />
        <Stat label="Outstanding" value={formatMoney(summary.outstanding)} />
      </div>
    </div>
  );
};

export default PaymentSummaryStrip;
