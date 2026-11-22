import { supabase } from './supabase';
import { chunk, ID_CHUNK } from './registrationExport';
import { markRegistrationPaid, type MarkPaidResult, type PaymentTable, type RegistrationType } from './registrationPayments';

// One run records at most this many payments (each one sends a receipt email and takes about a second)
export const MAX_BULK_MARK_PAID = 50;

const TABLE_BY_TYPE: Record<RegistrationType, PaymentTable> = {
  conference: 'conference_registrations',
  tech_conference: 'tech_conference_registrations',
  exhibitor: 'exhibitor_registrations'
};

const SELECT_BY_TYPE: Record<RegistrationType, string> = {
  conference: 'id, first_name, last_name, email, po_number, total_amount, payment_method, payment_status',
  tech_conference: 'id, first_name, last_name, email, po_number, total_amount, payment_method, payment_status',
  exhibitor: 'id, first_name, last_name, business_name, email, po_number, total_amount, payment_method, payment_status'
};

export interface BulkPaymentRow {
  id: string;
  name: string;
  email: string;
  po_number: string | null;
  amount: number;
  payment_method: string | null;
  payment_status: string | null;
}

// A purchase order that is still awaiting payment (a row with no status counts as awaiting, like everywhere else).
export const isBulkPayable = (row: Pick<BulkPaymentRow, 'payment_method' | 'payment_status'>): boolean =>
  row.payment_method === 'po' && (row.payment_status === 'pending' || row.payment_status === null || row.payment_status === undefined);

const toAmount = (value: unknown): number => {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

interface RawPaymentRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  email?: string | null;
  po_number?: string | null;
  total_amount?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
}

export const toBulkRow = (type: RegistrationType, raw: RawPaymentRow): BulkPaymentRow => ({
  id: raw.id,
  name:
    (type === 'exhibitor' && raw.business_name) ||
    `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim() ||
    'Registration',
  email: raw.email ?? '',
  po_number: raw.po_number ?? null,
  amount: toAmount(raw.total_amount),
  payment_method: raw.payment_method ?? null,
  payment_status: raw.payment_status ?? null
});

// Loads the ticked rows (they can be on pages that are not showing) so the dialog can say what will happen.
export const fetchBulkPaymentRows = async (type: RegistrationType, ids: string[]): Promise<BulkPaymentRow[]> => {
  const rows: BulkPaymentRow[] = [];
  for (const part of chunk(ids, ID_CHUNK)) {
    const { data, error } = await supabase.from(TABLE_BY_TYPE[type]).select(SELECT_BY_TYPE[type]).in('id', part);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as RawPaymentRow[]).map((raw) => toBulkRow(type, raw)));
  }
  return rows;
};

export interface BulkPaymentPlan {
  eligible: BulkPaymentRow[];
  skipped: BulkPaymentRow[];
  // Eligible rows beyond the per-run limit; they stay ticked for the next run
  overLimit: BulkPaymentRow[];
  total: number;
}

export const planBulkMarkPaid = (rows: BulkPaymentRow[], limit: number = MAX_BULK_MARK_PAID): BulkPaymentPlan => {
  const payable = rows.filter(isBulkPayable);
  const eligible = payable.slice(0, limit);
  const total = Math.round(eligible.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  return {
    eligible,
    skipped: rows.filter((row) => !isBulkPayable(row)),
    overLimit: payable.slice(limit),
    total
  };
};

export interface BulkPayResult {
  id: string;
  name: string;
  status: 'paid' | 'paid_no_receipt' | 'failed';
  message?: string;
}

// Records the payments one at a time (each sends its receipt), so one failure never stops the rest.
export const runBulkMarkPaid = async (
  type: RegistrationType,
  rows: BulkPaymentRow[],
  onProgress?: (done: number, total: number) => void,
  markPaid: (type: RegistrationType, id: string) => Promise<MarkPaidResult> = markRegistrationPaid
): Promise<BulkPayResult[]> => {
  const results: BulkPayResult[] = [];
  onProgress?.(0, rows.length);
  for (const row of rows) {
    try {
      const { receiptSent } = await markPaid(type, row.id);
      results.push({
        id: row.id,
        name: row.name,
        status: receiptSent ? 'paid' : 'paid_no_receipt',
        message: receiptSent ? undefined : 'Payment recorded, but the receipt email could not be sent. Contact them directly.'
      });
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message;
      results.push({ id: row.id, name: row.name, status: 'failed', message: typeof message === 'string' && message ? message : 'Unknown error' });
    }
    onProgress?.(results.length, rows.length);
  }
  return results;
};
