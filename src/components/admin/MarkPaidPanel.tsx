import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { formatMoney } from '../../lib/dashboard';
import {
  NOT_AWAITING_PAYMENT_MESSAGE,
  formatShortDate,
  getErrorMessage,
  getPaymentState,
  markRegistrationPaid,
  type PaymentRow,
  type RegistrationType
} from '../../lib/registrationPayments';
import type { TimelineItem } from '../../lib/registrationEmails';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { PaymentTimeline } from './PaymentTimeline';

export interface MarkPaidRegistration extends PaymentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  po_number?: string | null;
}

interface MarkPaidPanelProps {
  registration: MarkPaidRegistration;
  type: RegistrationType;
  // Called after the payment is recorded, with the id that was marked and the fields that changed, so the page can
  // refresh. The id lets the page ignore the answer if a different registration is open by then.
  onMarkedPaid: (id: string, changes: { payment_status: string; payment_completed_at: string }) => void;
  // Registered, emails sent and payment, when the page has the history. Without it a short two-line version is shown.
  timeline?: TimelineItem[];
  timelineLoading?: boolean;
  // Someone else already paid it (or the list is out of date): the page should reload
  onConflict?: () => void;
}

// The "Payment" section at the top of a registration's panel: status, amount, history and the Mark paid button.
export const MarkPaidPanel: React.FC<MarkPaidPanelProps> = ({
  registration,
  type,
  onMarkedPaid,
  timeline,
  timelineLoading = false,
  onConflict
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // The Mark paid button disappears once it works, so move keyboard focus to the result message
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const state = getPaymentState(registration);
  const amount = Number(registration.total_amount);
  const name = `${registration.first_name} ${registration.last_name}`;

  const handleMarkPaid = async () => {
    const amountLine = Number.isFinite(amount) ? `Amount: ${formatMoney(amount)}\n` : '';
    const poLine = registration.po_number ? `PO Number: ${registration.po_number}\n` : '';
    if (
      !confirm(
        `Mark payment as completed for ${name}?\n\n` +
          poLine +
          amountLine +
          `\nA payment receipt will be automatically emailed to ${registration.email}\n\n` +
          `This action cannot be undone.`
      )
    ) {
      return;
    }

    setProcessing(true);
    setError(null);
    setNotice(null);
    try {
      const { receiptSent } = await markRegistrationPaid(type, registration.id);
      setNotice(
        receiptSent
          ? `Payment marked as completed. A receipt has been emailed to ${registration.email}.`
          : 'Payment marked as completed. However, there was an issue sending the email receipt. Please contact the registrant manually.'
      );
      onMarkedPaid(registration.id, { payment_status: 'completed', payment_completed_at: new Date().toISOString() });
    } catch (err) {
      console.error('Error marking payment as paid:', err);
      setError(`Failed to update payment status: ${getErrorMessage(err)}`);
      if (getErrorMessage(err) === NOT_AWAITING_PAYMENT_MESSAGE) onConflict?.();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section aria-labelledby="payment-panel-heading">
      <h3 id="payment-panel-heading" className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Payment
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <PaymentStatusBadge state={state} showDetail={false} />
        {Number.isFinite(amount) && <span className="text-sm font-medium text-gray-900">{formatMoney(amount)}</span>}
      </div>

      {timeline ? (
        <div className="mt-3">
          <PaymentTimeline items={timeline} loading={timelineLoading} />
        </div>
      ) : (
      <ol className="mt-3 space-y-1.5 border-l-2 border-gray-200 pl-3 text-sm text-gray-700">
        <li>Registered {formatShortDate(registration.created_at)}</li>
        {state.isPaid ? (
          <li>
            Payment received{registration.payment_completed_at ? ` ${formatShortDate(registration.payment_completed_at)}` : ''}
          </li>
        ) : (
          state.detail && <li className="text-gray-500">{state.detail}</li>
        )}
      </ol>
      )}

      {state.canMarkPaid && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={processing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-tapt-blue px-3 py-2 text-sm font-semibold text-white hover:bg-tapt-navy disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            {processing ? 'Saving…' : 'Mark as paid and email receipt'}
          </button>
          <p className="mt-1 text-xs text-gray-500">A receipt is emailed to {registration.email}. This cannot be undone.</p>
        </div>
      )}

      {!state.isPaid && !state.canMarkPaid && registration.payment_method === 'paypal' && registration.payment_status !== 'failed' && registration.payment_status !== 'refunded' && (
        <p className="mt-3 text-xs text-gray-500">PayPal payments are recorded automatically.</p>
      )}

      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="status" className="mt-3 rounded-md bg-green-50 p-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
};

export default MarkPaidPanel;
