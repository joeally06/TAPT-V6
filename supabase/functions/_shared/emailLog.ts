/**
 * Registration email history
 * One row per confirmation, payment reminder or receipt email attempt (table registration_email_log).
 * The admin registration pages read it to draw each registration's timeline.
 */

export type RegistrationLogType = 'conference' | 'tech_conference' | 'exhibitor' | 'regional_luncheon';
export type RegistrationEmailKind = 'confirmation' | 'reminder' | 'receipt';

export interface RegistrationEmailLogEntry {
  registrationType: RegistrationLogType;
  registrationId: string;
  kind: RegistrationEmailKind;
  recipient: string | null;
  status: 'sent' | 'failed';
  // Why it failed. Kept short; never include secrets.
  error?: string | null;
  // The admin who triggered it, when known
  sentBy?: string | null;
}

// Minimal shape of the supabase client used here (keeps this file free of a library import).
interface LogClient {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message?: string } | null }>;
  };
}

const MAX_ERROR_LENGTH = 300;

// Turns whatever an email library returned as an error into a short readable line.
export function describeEmailError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error.slice(0, MAX_ERROR_LENGTH);
  const record = error as { message?: unknown; name?: unknown };
  const message = typeof record.message === 'string' ? record.message : '';
  const name = typeof record.name === 'string' ? record.name : '';
  const text = [name, message].filter(Boolean).join(': ');
  return (text || 'Unknown error').slice(0, MAX_ERROR_LENGTH);
}

/**
 * Records one email attempt. Never throws and never blocks the caller: if the table is missing (migration not
 * applied yet) or the insert fails, the problem is only logged to the function console.
 */
export async function logRegistrationEmail(supabaseAdmin: LogClient, entry: RegistrationEmailLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('registration_email_log').insert({
      registration_type: entry.registrationType,
      registration_id: entry.registrationId,
      kind: entry.kind,
      recipient: entry.recipient,
      status: entry.status,
      error: entry.error ? entry.error.slice(0, MAX_ERROR_LENGTH) : null,
      sent_by: entry.sentBy ?? null
    });
    if (error) console.error('⚠️ Could not write the email log:', error.message);
  } catch (error) {
    console.error('⚠️ Could not write the email log:', error);
  }
}
