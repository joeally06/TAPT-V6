import { supabase } from './supabase';

// Registration tables that take payments (the regional luncheon and scholarship tables do not).
export type PaymentTable = 'conference_registrations' | 'tech_conference_registrations' | 'exhibitor_registrations';
export type RegistrationType = 'conference' | 'tech_conference' | 'exhibitor';

const TABLE_BY_TYPE: Record<RegistrationType, PaymentTable> = {
  conference: 'conference_registrations',
  tech_conference: 'tech_conference_registrations',
  exhibitor: 'exhibitor_registrations'
};

// A purchase order still unpaid after this many days counts as overdue (same rule as the dashboard).
export const OVERDUE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PaymentRow {
  payment_method?: string | null;
  payment_status?: string | null;
  payment_completed_at?: string | null;
  total_amount?: number | string | null;
  created_at: string;
}

// ---- Filters ----

export type PaymentFilter = 'all' | 'paid' | 'awaiting' | 'overdue' | 'po' | 'paypal';

export const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'awaiting', label: 'Awaiting payment' },
  { value: 'overdue', label: `Overdue ${OVERDUE_DAYS}+ days` },
  { value: 'po', label: 'Purchase order' },
  { value: 'paypal', label: 'PayPal' }
];

// A registration with no payment status has not been paid, so it counts as awaiting.
const AWAITING_OR = 'payment_status.eq.pending,payment_status.is.null';

export interface PaymentFilterConditions {
  eq: [string, string][];
  or?: string;
  createdBefore?: string;
}

export const getPaymentFilterConditions = (filter: PaymentFilter, now: number = Date.now()): PaymentFilterConditions => {
  switch (filter) {
    case 'paid':
      return { eq: [['payment_status', 'completed']] };
    case 'awaiting':
      return { eq: [], or: AWAITING_OR };
    case 'overdue':
      return {
        eq: [['payment_method', 'po']],
        or: AWAITING_OR,
        createdBefore: new Date(now - OVERDUE_DAYS * DAY_MS).toISOString()
      };
    case 'po':
      return { eq: [['payment_method', 'po']] };
    case 'paypal':
      return { eq: [['payment_method', 'paypal']] };
    default:
      return { eq: [] };
  }
};

// Anything that can be filtered like a supabase query.
interface FilterableQuery<Q> {
  eq(column: string, value: string): Q;
  or(filters: string): Q;
  lt(column: string, value: string): Q;
}

export const applyPaymentFilter = <Q extends FilterableQuery<Q>>(
  query: Q,
  filter: PaymentFilter,
  now: number = Date.now()
): Q => {
  const conditions = getPaymentFilterConditions(filter, now);
  let result = query;
  for (const [column, value] of conditions.eq) result = result.eq(column, value);
  if (conditions.or) result = result.or(conditions.or);
  if (conditions.createdBefore) result = result.lt('created_at', conditions.createdBefore);
  return result;
};

// ---- Search ----

// Characters that would break out of (or confuse) a PostgREST filter string are replaced with spaces.
export const escapeSearchTerm = (term: string): string => term.replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim();

// "first_name.ilike.%term%,last_name.ilike.%term%" for a query's .or(), or null when the term is empty.
export const buildSearchFilter = (term: string, columns: string[]): string | null => {
  const clean = escapeSearchTerm(term);
  if (!clean) return null;
  return columns.map((column) => `${column}.ilike.%${clean}%`).join(',');
};

// ---- Payment state of one registration ----

export type PaymentTone = 'green' | 'amber' | 'red' | 'gray';

export interface PaymentState {
  label: string;
  tone: PaymentTone;
  // Short extra line, for example "Waiting 3 days"
  detail: string | null;
  isPaid: boolean;
  // Same rule as Payment Management: a purchase order that is still pending
  canMarkPaid: boolean;
}

// One date format for everything on these pages, for example "Mar 5, 2026".
export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// supabase-js returns database errors as plain objects, not Error instances, so read `message` from either.
export const getErrorMessage = (err: unknown, fallback: string = 'Unknown error'): string => {
  const message = (err as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
};

const wholeDaysSince = (iso: string, now: number): number => {
  const then = Date.parse(iso);
  return Number.isNaN(then) ? 0 : Math.max(0, Math.floor((now - then) / DAY_MS));
};

const describeWaiting = (days: number): string =>
  days === 0 ? 'Waiting since today' : days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`;

export const getPaymentState = (row: PaymentRow, now: number = Date.now()): PaymentState => {
  const status = row.payment_status ?? 'pending';

  if (status === 'completed') {
    return {
      label: 'Paid',
      tone: 'green',
      detail: row.payment_completed_at ? `Paid ${formatShortDate(row.payment_completed_at)}` : null,
      isPaid: true,
      canMarkPaid: false
    };
  }
  if (status === 'failed') {
    return { label: 'Payment failed', tone: 'red', detail: null, isPaid: false, canMarkPaid: false };
  }
  if (status === 'refunded') {
    return { label: 'Refunded', tone: 'gray', detail: null, isPaid: false, canMarkPaid: false };
  }
  if (status === 'pending') {
    const days = wholeDaysSince(row.created_at, now);
    const isPo = row.payment_method === 'po';
    if (isPo && days >= OVERDUE_DAYS) {
      return { label: `Unpaid · ${days} days`, tone: 'red', detail: describeWaiting(days), isPaid: false, canMarkPaid: true };
    }
    return { label: 'Awaiting payment', tone: 'amber', detail: describeWaiting(days), isPaid: false, canMarkPaid: isPo };
  }
  return { label: status, tone: 'gray', detail: null, isPaid: false, canMarkPaid: false };
};

// ---- Summary of a whole table ----

export interface PaymentSummary {
  registered: number;
  paid: number;
  awaiting: number;
  collected: number;
  outstanding: number;
  overdue: number;
}

// total_amount can be null (exhibitors) or a numeric string
const toAmount = (value: unknown): number => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const summarizePaymentRows = (rows: PaymentRow[], now: number = Date.now()): PaymentSummary => {
  const summary: PaymentSummary = { registered: rows.length, paid: 0, awaiting: 0, collected: 0, outstanding: 0, overdue: 0 };
  const overdueBefore = now - OVERDUE_DAYS * DAY_MS;

  for (const row of rows) {
    const status = row.payment_status ?? 'pending';
    const amount = toAmount(row.total_amount);
    if (status === 'completed') {
      summary.paid++;
      summary.collected += amount;
    } else if (status === 'pending') {
      summary.awaiting++;
      summary.outstanding += amount;
      if (row.payment_method === 'po' && Date.parse(row.created_at) < overdueBefore) summary.overdue++;
    }
  }
  summary.collected = roundMoney(summary.collected);
  summary.outstanding = roundMoney(summary.outstanding);
  return summary;
};

// Reads the payment columns of a whole table (in pages, so the 1000-row default cannot cut it short).
export const fetchPaymentSummary = async (table: PaymentTable): Promise<PaymentSummary> => {
  const pageSize = 1000;
  const rows: PaymentRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('payment_method, payment_status, total_amount, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as PaymentRow[]));
    if (!data || data.length < pageSize) break;
  }
  return summarizePaymentRows(rows);
};

// ---- Mark paid ----

// Shown when someone else already paid the registration (or the page is out of date).
export const NOT_AWAITING_PAYMENT_MESSAGE =
  'This registration is no longer awaiting payment. Refresh the page to see its current status.';

export interface MarkPaidResult {
  // False when the payment was recorded but the receipt email could not be sent
  receiptSent: boolean;
}

// Records the payment, then emails the receipt. Same steps as the Payment Management page.
export const markRegistrationPaid = async (type: RegistrationType, registrationId: string): Promise<MarkPaidResult> => {
  // Only a row that is still awaiting payment is updated, and the update must hit exactly that row. This stops a
  // second admin (or a stale pop-up) from paying twice and sending a second receipt, and it stops a receipt being
  // sent for a row the database refused to change.
  const { data: updated, error: updateError } = await supabase
    .from(TABLE_BY_TYPE[type])
    .update({
      payment_status: 'completed',
      payment_completed_at: new Date().toISOString()
    })
    .eq('id', registrationId)
    .or(AWAITING_OR)
    .select('id');

  if (updateError) throw updateError;
  if (!updated || updated.length === 0) {
    throw new Error(NOT_AWAITING_PAYMENT_MESSAGE);
  }

  // Wait a moment for the database to commit before the receipt function reads the row
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const { data, error: emailError } = await supabase.functions.invoke('send-payment-receipt', {
      body: { registrationId, registrationType: type }
    });
    if (emailError) throw emailError;
    if (data && !data.success) throw new Error(data.error || 'Email send failed');
    return { receiptSent: true };
  } catch (emailError) {
    // The payment itself is recorded; only the receipt failed
    console.error('Failed to send payment receipt email:', emailError);
    return { receiptSent: false };
  }
};
