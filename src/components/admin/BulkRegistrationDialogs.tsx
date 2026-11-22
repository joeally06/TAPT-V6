import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { formatMoney } from '../../lib/dashboard';
import {
  MAX_BULK_MARK_PAID,
  fetchBulkPaymentRows,
  planBulkMarkPaid,
  runBulkMarkPaid,
  type BulkPayResult,
  type BulkPaymentPlan
} from '../../lib/bulkPayments';
import { REMINDER_SKIP_MESSAGES, sendPaymentReminders, type ReminderResult } from '../../lib/registrationEmails';
import { getErrorMessage, type RegistrationType } from '../../lib/registrationPayments';
import { useDialogFocus } from '../../lib/useDialogFocus';

interface DialogShellProps {
  open: boolean;
  title: string;
  // While true the dialog cannot be dismissed (an action is running)
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const DialogShell: React.FC<DialogShellProps> = ({ open, title, busy = false, onClose, children, footer }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(open, ref, onClose, { escapeCloses: !busy });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-dialog-title"
        aria-busy={busy}
        tabIndex={-1}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl outline-none"
      >
        <h2 id="bulk-dialog-title" className="mb-3 text-lg font-bold text-gray-900">
          {title}
        </h2>
        <div className="space-y-3 text-sm text-gray-700">{children}</div>
        <div className="mt-5 flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
};

const PRIMARY = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const SECONDARY = 'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

const Progress: React.FC<{ done: number; total: number; label: string }> = ({ done, total, label }) => (
  <div role="status">
    <p className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label} {Math.min(done + 1, total)} of {total}…
    </p>
    <div className="mt-2 h-2 overflow-hidden rounded bg-gray-200" aria-hidden="true">
      <div className="h-full bg-tapt-blue" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
    <p className="mt-2 text-xs text-gray-500">Keep this window open until it finishes.</p>
  </div>
);

interface BulkDialogProps {
  open: boolean;
  type: RegistrationType;
  // The ticked rows (they can be on other pages)
  ids: string[];
  onClose: () => void;
  // Called once the work is done, with the ids that were processed, so the page can refresh and untick them
  onFinished: (processedIds: string[]) => void;
}

// ---------------------------------------------------------------------------------------------------------------
// Send payment reminders to the ticked rows
// ---------------------------------------------------------------------------------------------------------------

export const BulkRemindersDialog: React.FC<BulkDialogProps> = ({ open, type, ids, onClose, onFinished }) => {
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ReminderResult[]>([]);

  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setResults([]);
    }
  }, [open]);

  const handleSend = async () => {
    setPhase('running');
    setProgress({ done: 0, total: ids.length });
    let sentResults: ReminderResult[];
    try {
      sentResults = await sendPaymentReminders(type, ids, (done, total) => setProgress({ done, total }));
    } catch (error) {
      sentResults = ids.map((id) => ({
        id,
        name: 'Registration',
        status: 'failed' as const,
        reason: 'send_failed' as const,
        message: getErrorMessage(error)
      }));
    }
    setResults(sentResults);
    setPhase('done');
    // Rows that were skipped or failed stay ticked so they can be retried
    onFinished(sentResults.filter((r) => r.status === 'sent').map((r) => r.id));
  };

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const notSent = results.filter((r) => r.status !== 'sent');

  return (
    <DialogShell
      open={open}
      title="Send payment reminders"
      busy={phase === 'running'}
      onClose={onClose}
      footer={
        phase === 'confirm' ? (
          <>
            <button type="button" onClick={onClose} className={SECONDARY}>
              Cancel
            </button>
            <button type="button" onClick={handleSend} className={`${PRIMARY} bg-amber-600 hover:bg-amber-700`}>
              Send reminders
            </button>
          </>
        ) : phase === 'done' ? (
          <button type="button" onClick={onClose} className={`${PRIMARY} bg-tapt-navy hover:bg-tapt-navy/90`}>
            Close
          </button>
        ) : null
      }
    >
      {phase === 'confirm' && (
        <>
          <p>
            Email a payment reminder for <strong>{ids.length}</strong> selected {ids.length === 1 ? 'registration' : 'registrations'}?
          </p>
          <p>
            Each reminder goes to the billing contact (or the registrant) and shows the PO number, the amount due and where to
            send payment. Registrations that are paid, use PayPal, or already got a reminder in the last 24 hours are skipped
            automatically.
          </p>
        </>
      )}
      {phase === 'running' && <Progress done={progress.done} total={progress.total} label="Checking" />}
      {phase === 'done' && (
        <div role="status" className="space-y-3">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            {sentCount > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            )}
            {sentCount} {sentCount === 1 ? 'reminder' : 'reminders'} sent
            {notSent.length > 0 && `, ${notSent.length} not sent`}
          </p>
          {notSent.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md bg-gray-50 p-3">
              {notSent.map((result) => (
                <li key={result.id}>
                  <span className="font-medium text-gray-900">{result.name}</span>
                  {': '}
                  {result.status === 'skipped' && result.reason && result.reason !== 'send_failed'
                    ? REMINDER_SKIP_MESSAGES[result.reason]
                    : `Failed. ${result.message ?? ''}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DialogShell>
  );
};

// ---------------------------------------------------------------------------------------------------------------
// Mark the ticked purchase orders as paid
// ---------------------------------------------------------------------------------------------------------------

export const BulkMarkPaidDialog: React.FC<BulkDialogProps> = ({ open, type, ids, onClose, onFinished }) => {
  const [phase, setPhase] = useState<'loading' | 'confirm' | 'running' | 'done' | 'error'>('loading');
  const [plan, setPlan] = useState<BulkPaymentPlan | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkPayResult[]>([]);

  // Look at the ticked rows each time the dialog opens, so it can say exactly what will happen
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('loading');
    setPlan(null);
    setResults([]);
    fetchBulkPaymentRows(type, ids)
      .then((rows) => {
        if (cancelled) return;
        setPlan(planBulkMarkPaid(rows));
        setPhase('confirm');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Could not load the selected registrations:', err);
        setError(getErrorMessage(err, 'Could not load the selected registrations.'));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
    // The ids are fixed while the dialog is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const handleRun = async () => {
    if (!plan || plan.eligible.length === 0) return;
    setPhase('running');
    setProgress({ done: 0, total: plan.eligible.length });
    const finished = await runBulkMarkPaid(type, plan.eligible, (done, total) => setProgress({ done, total }));
    setResults(finished);
    setPhase('done');
    onFinished(finished.map((row) => row.id));
  };

  const paid = results.filter((r) => r.status === 'paid').length;
  const noReceipt = results.filter((r) => r.status === 'paid_no_receipt');
  const failed = results.filter((r) => r.status === 'failed');
  const eligibleCount = plan?.eligible.length ?? 0;

  return (
    <DialogShell
      open={open}
      title="Mark purchase orders as paid"
      busy={phase === 'running'}
      onClose={onClose}
      footer={
        phase === 'confirm' ? (
          <>
            <button type="button" onClick={onClose} className={SECONDARY}>
              Cancel
            </button>
            {eligibleCount > 0 && (
              <button type="button" onClick={handleRun} className={`${PRIMARY} bg-green-700 hover:bg-green-800`}>
                Mark {eligibleCount} as paid and email receipts
              </button>
            )}
          </>
        ) : phase === 'done' || phase === 'error' ? (
          <button type="button" onClick={onClose} className={`${PRIMARY} bg-tapt-navy hover:bg-tapt-navy/90`}>
            Close
          </button>
        ) : null
      }
    >
      {phase === 'loading' && (
        <p role="status" className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking the selected registrations…
        </p>
      )}
      {phase === 'error' && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {phase === 'confirm' && plan && (
        <>
          {eligibleCount > 0 ? (
            <p>
              <strong>{eligibleCount}</strong> purchase {eligibleCount === 1 ? 'order' : 'orders'} totalling{' '}
              <strong>{formatMoney(plan.total)}</strong> will be marked as paid, and each registrant is emailed a receipt. This
              cannot be undone.
            </p>
          ) : (
            <p>None of the selected registrations is an unpaid purchase order, so there is nothing to mark as paid.</p>
          )}
          {plan.skipped.length > 0 && (
            <div className="rounded-md bg-gray-50 p-3">
              <p className="font-medium text-gray-900">
                {plan.skipped.length} will be skipped (PayPal, already paid, or not awaiting payment):
              </p>
              <p className="mt-1 text-gray-600">
                {plan.skipped.slice(0, 5).map((row) => row.name).join(', ')}
                {plan.skipped.length > 5 ? ` and ${plan.skipped.length - 5} more` : ''}
              </p>
            </div>
          )}
          {plan.overLimit.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-amber-900">
              {MAX_BULK_MARK_PAID} are recorded at a time. {plan.overLimit.length} more stay selected for the next run.
            </p>
          )}
        </>
      )}
      {phase === 'running' && <Progress done={progress.done} total={progress.total} label="Marking" />}
      {phase === 'done' && (
        <div role="status" className="space-y-3">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            {paid + noReceipt.length} marked as paid
            {failed.length > 0 && `, ${failed.length} failed`}
          </p>
          {noReceipt.length > 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">Paid, but the receipt email could not be sent. Contact them directly:</p>
              <ul className="mt-1 list-disc pl-5">
                {noReceipt.map((row) => (
                  <li key={row.id}>{row.name}</li>
                ))}
              </ul>
            </div>
          )}
          {failed.length > 0 && (
            <div className="rounded-md bg-red-50 p-3 text-red-800">
              <p className="font-medium">Not changed:</p>
              <ul className="mt-1 list-disc pl-5">
                {failed.map((row) => (
                  <li key={row.id}>
                    {row.name}: {row.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DialogShell>
  );
};
