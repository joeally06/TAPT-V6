import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Send, BellRing } from 'lucide-react';
import {
  REMINDER_SKIP_MESSAGES,
  resendConfirmation,
  sendPaymentReminders,
  type EmailRegistrationType
} from '../../lib/registrationEmails';
import { getErrorMessage, type RegistrationType } from '../../lib/registrationPayments';

interface RegistrationEmailActionsProps {
  type: EmailRegistrationType;
  registrationId: string;
  // The registrant, for the confirmation and the New email link
  email: string;
  // Where a payment reminder goes: the billing contact when there is one (defaults to the registrant)
  reminderEmail?: string;
  // True for an unpaid purchase order; shows the reminder button
  canRemind?: boolean;
  // Called after an email went out, so the history can be reloaded
  onEmailSent: () => void;
}

const BUTTON =
  'inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50';

// The email buttons in a registration panel. Give it a `key` of the registration id so its messages reset.
export const RegistrationEmailActions: React.FC<RegistrationEmailActionsProps> = ({
  type,
  registrationId,
  email,
  reminderEmail,
  canRemind = false,
  onEmailSent
}) => {
  const [busy, setBusy] = useState<'confirmation' | 'reminder' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // Say what happened where a screen reader will find it
  useEffect(() => {
    if (notice || error) noticeRef.current?.focus();
  }, [notice, error]);

  const handleResend = async () => {
    setBusy('confirmation');
    setNotice(null);
    setError(null);
    try {
      await resendConfirmation(type, registrationId);
      setNotice(`Confirmation email sent to ${email}.`);
      onEmailSent();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend the confirmation email'));
    } finally {
      setBusy(null);
    }
  };

  const handleReminder = async () => {
    const reminderTo = reminderEmail || email;
    if (!confirm(`Email a payment reminder to ${reminderTo}?`)) return;
    setBusy('reminder');
    setNotice(null);
    setError(null);
    try {
      const [result] = await sendPaymentReminders(type as RegistrationType, [registrationId]);
      if (result?.status === 'sent') {
        setNotice(`Payment reminder sent to ${reminderTo}.`);
        onEmailSent();
      } else if (result?.status === 'skipped' && result.reason && result.reason !== 'send_failed') {
        setNotice(`No reminder sent: ${REMINDER_SKIP_MESSAGES[result.reason].toLowerCase()}.`);
      } else {
        setError(result?.message || 'The reminder could not be sent.');
        onEmailSent();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'The reminder could not be sent.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {(notice || error) && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role={error ? 'alert' : 'status'}
          className={`rounded-md p-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
        >
          {error ?? notice}
        </p>
      )}
      <div className="grid gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={busy !== null}
          className={BUTTON}
        >
          {busy === 'confirmation' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4 text-gray-600" aria-hidden="true" />
          )}
          {busy === 'confirmation' ? 'Sending…' : 'Resend confirmation'}
        </button>
        {canRemind && (
          <button
            type="button"
            onClick={handleReminder}
            disabled={busy !== null}
            className={BUTTON}
          >
            {busy === 'reminder' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BellRing className="h-4 w-4 text-gray-600" aria-hidden="true" />
            )}
            {busy === 'reminder' ? 'Sending…' : 'Send payment reminder'}
          </button>
        )}
        <a href={`mailto:${email}`} className={BUTTON}>
          <Mail className="h-4 w-4 text-gray-600" aria-hidden="true" />
          New email
        </a>
      </div>
    </div>
  );
};

export default RegistrationEmailActions;
