import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { formatMoney } from '../../lib/dashboard';
import {
  formatShortDate,
  getErrorMessage,
  getPaymentState,
  markRegistrationPaid,
  type PaymentRow,
  type RegistrationType
} from '../../lib/registrationPayments';
import { PaymentStatusBadge } from './PaymentStatusBadge';

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
}

// The "Payment" section of a registration's details pop-up.
export const MarkPaidPanel: React.FC<MarkPaidPanelProps> = ({ registration, type, onMarkedPaid }) => {
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
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section aria-labelledby="payment-panel-heading" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 id="payment-panel-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-600">
        Payment
      </h4>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <PaymentStatusBadge state={state} showDetail={false} />
        {Number.isFinite(amount) && <span className="text-sm font-medium text-gray-900">{formatMoney(amount)}</span>}
      </div>

      <ol className="mt-3 space-y-1.5 border-l-2 border-gray-300 pl-3 text-sm text-gray-700">
        <li>Registered {formatShortDate(registration.created_at)}</li>
        {state.isPaid ? (
          <li>
            Payment received{registration.payment_completed_at ? ` ${formatShortDate(registration.payment_completed_at)}` : ''}
          </li>
        ) : (
          state.detail && <li className="text-gray-500">{state.detail}</li>
        )}
      </ol>

      {state.canMarkPaid && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
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
