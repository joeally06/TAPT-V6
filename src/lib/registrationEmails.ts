import { supabase } from './supabase';
import { chunk, ID_CHUNK } from './registrationExport';
import { OVERDUE_DAYS, formatShortDate, getErrorMessage, type RegistrationType } from './registrationPayments';

// Every registration form the admin pages list. The regional luncheon has no payments.
export type EmailRegistrationType = RegistrationType | 'regional_luncheon';

export type EmailKind = 'confirmation' | 'reminder' | 'receipt';

export interface EmailLogEntry {
  id: string;
  kind: EmailKind;
  status: 'sent' | 'failed';
  recipient: string | null;
  error: string | null;
  created_at: string;
}

const RESEND_FUNCTIONS: Record<EmailRegistrationType, string> = {
  conference: 'resend-conference-confirmation',
  tech_conference: 'resend-tech-conference-confirmation',
  exhibitor: 'resend-exhibitor-confirmation',
  regional_luncheon: 'resend-regional-luncheon-confirmation'
};

const functionUrl = (name: string): string => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

const getToken = async (): Promise<string> => {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be logged in to do this.');
  return session.access_token;
};

// ---- Resend a confirmation ----

export const resendConfirmation = async (type: EmailRegistrationType, registrationId: string): Promise<void> => {
  const token = await getToken();
  const response = await fetch(functionUrl(RESEND_FUNCTIONS[type]), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ registrationId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Failed to resend the confirmation email');
};

// ---- Payment reminders ----

export type ReminderSkipReason = 'not_found' | 'not_awaiting' | 'not_po' | 'recent' | 'no_email' | 'no_amount';

export interface ReminderResult {
  id: string;
  name: string;
  status: 'sent' | 'skipped' | 'failed';
  reason?: ReminderSkipReason | 'send_failed';
  message?: string;
}

export const REMINDER_SKIP_MESSAGES: Record<ReminderSkipReason, string> = {
  not_found: 'No longer in the list',
  not_awaiting: 'Not awaiting payment',
  not_po: 'Not a purchase order',
  recent: 'Reminded in the last 24 hours',
  no_email: 'No email address',
  no_amount: 'No amount due'
};

// The function accepts this many registrations per request
export const REMINDER_BATCH = 25;

const failedBatch = (ids: string[], message: string): ReminderResult[] =>
  ids.map((id) => ({ id, name: 'Registration', status: 'failed', reason: 'send_failed', message }));

// Sends reminders in batches. A batch the server could not handle is reported as failed for its ids; the next
// batch still goes ahead.
export const sendPaymentReminders = async (
  type: RegistrationType,
  ids: string[],
  onProgress?: (done: number, total: number) => void
): Promise<ReminderResult[]> => {
  const token = await getToken();
  const results: ReminderResult[] = [];
  onProgress?.(0, ids.length);

  for (const batch of chunk(ids, REMINDER_BATCH)) {
    try {
      const response = await fetch(functionUrl('send-payment-reminders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ registrationType: type, registrationIds: batch })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(body.results)) {
        results.push(...failedBatch(batch, body.error || `Request failed (${response.status})`));
      } else {
        results.push(...(body.results as ReminderResult[]));
      }
    } catch (error) {
      results.push(...failedBatch(batch, getErrorMessage(error, 'Network error')));
    }
    onProgress?.(results.length, ids.length);
  }
  return results;
};

// ---- Email history ----

const LOG_COLUMNS = 'id, kind, status, recipient, error, created_at';

// The history of one registration, oldest first. Returns nothing when the table is not there yet, so the pages keep
// working before the migration is applied.
export const fetchEmailLog = async (type: EmailRegistrationType, registrationId: string): Promise<EmailLogEntry[]> => {
  const { data, error } = await supabase
    .from('registration_email_log')
    .select(LOG_COLUMNS)
    .eq('registration_type', type)
    .eq('registration_id', registrationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    console.warn('Could not load the email history:', error.message);
    return [];
  }
  return (data ?? []) as EmailLogEntry[];
};

// When each of these registrations last got a reminder that went out (id -> ISO time).
export const fetchLastReminders = async (
  type: RegistrationType,
  ids: string[]
): Promise<Record<string, string>> => {
  const latest: Record<string, string> = {};
  for (const part of chunk(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from('registration_email_log')
      .select('registration_id, created_at')
      .eq('registration_type', type)
      .eq('kind', 'reminder')
      .eq('status', 'sent')
      .in('registration_id', part)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Could not load reminder history:', error.message);
      return {};
    }
    for (const row of data ?? []) {
      if (!latest[row.registration_id]) latest[row.registration_id] = row.created_at;
    }
  }
  return latest;
};

// ---- Timeline ----

export interface TimelineItem {
  key: string;
  label: string;
  // null for "not yet" lines
  at: string | null;
  tone: 'done' | 'failed' | 'waiting';
  detail?: string;
}

export interface TimelineRow {
  created_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_completed_at?: string | null;
}

const EMAIL_LABELS: Record<EmailKind, { sent: string; failed: string }> = {
  confirmation: { sent: 'Confirmation email sent', failed: 'Confirmation email failed' },
  reminder: { sent: 'Payment reminder sent', failed: 'Payment reminder failed' },
  receipt: { sent: 'Receipt emailed', failed: 'Receipt email failed' }
};

const DAY_MS = 24 * 60 * 60 * 1000;

// One list from the registration itself and its logged emails. `payments` is false for forms with no payment.
export const buildTimeline = (
  row: TimelineRow,
  log: EmailLogEntry[],
  options: { payments: boolean },
  now: number = Date.now()
): TimelineItem[] => {
  const items: TimelineItem[] = [{ key: 'registered', label: 'Registered', at: row.created_at, tone: 'done' }];

  for (const entry of log) {
    const labels = EMAIL_LABELS[entry.kind];
    if (!labels) continue;
    items.push({
      key: `email-${entry.id}`,
      label: entry.status === 'sent' ? labels.sent : labels.failed,
      at: entry.created_at,
      tone: entry.status === 'sent' ? 'done' : 'failed',
      detail: entry.status === 'sent' ? entry.recipient ?? undefined : entry.error ?? undefined
    });
  }

  if (options.payments) {
    const status = row.payment_status ?? 'pending';
    if (status === 'completed') {
      items.push({ key: 'paid', label: 'Payment received', at: row.payment_completed_at ?? null, tone: 'done' });
    } else if (status === 'failed') {
      items.push({ key: 'payment-failed', label: 'Payment failed', at: null, tone: 'failed' });
    } else if (status === 'refunded') {
      items.push({ key: 'refunded', label: 'Payment refunded', at: null, tone: 'waiting' });
    }
  }

  // Oldest first. Lines with no time (the paid line of an old record) keep their place at the end.
  const dated = items.filter((item) => item.at).sort((a, b) => Date.parse(a.at as string) - Date.parse(b.at as string));
  const undated = items.filter((item) => !item.at);
  const ordered = [...dated, ...undated];

  if (options.payments && (row.payment_status ?? 'pending') === 'pending') {
    const days = Math.max(0, Math.floor((now - Date.parse(row.created_at)) / DAY_MS));
    const overdue = row.payment_method === 'po' && days >= OVERDUE_DAYS;
    ordered.push({
      key: 'waiting',
      label: 'Payment not received yet',
      at: null,
      tone: 'waiting',
      detail: days === 0 ? 'Waiting since today' : days === 1 ? 'Waiting 1 day' : `Waiting ${days} days${overdue ? ' (overdue)' : ''}`
    });
  }
  return ordered;
};

export const describeWhen = (iso: string | null): string => (iso ? formatShortDate(iso) : '');
