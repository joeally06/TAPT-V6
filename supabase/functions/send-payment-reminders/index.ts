import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';
import { generatePaymentReminderEmail } from '../_shared/emailTemplates.ts';
import type { PaymentReminderData } from '../_shared/emailTemplates.ts';
import { describeEmailError, logRegistrationEmail } from '../_shared/emailLog.ts';
import { sanitizeUuid } from '../_shared/sanitize.ts';
import { fetchSettings, formatRemittanceAddressPlain } from '../_shared/settings.ts';

/**
 * Send payment reminders for unpaid purchase-order registrations (admin only).
 *
 * POST { registrationType: 'conference' | 'tech_conference' | 'exhibitor', registrationIds: string[] }
 *
 * The server decides who gets an email. A registration is skipped (with a reason) when it is not an unpaid purchase
 * order, has no usable email address or amount, or already had a reminder in the last 24 hours. Amounts, status and the
 * recipient always come from the database. Each attempt is written to registration_email_log.
 */

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

type RegistrationType = 'conference' | 'tech_conference' | 'exhibitor';

const TYPES: Record<RegistrationType, { table: string; eventTable: string }> = {
  conference: { table: 'conference_registrations', eventTable: 'conference_settings' },
  tech_conference: { table: 'tech_conference_registrations', eventTable: 'tech_conference_settings' },
  exhibitor: { table: 'exhibitor_registrations', eventTable: 'exhibitor_settings' }
};

const MAX_IDS = 25;
const COOLDOWN_HOURS = 24;
// Resend allows 10 requests per second per team; stay well under it
const SEND_GAP_MS = 150;

type ResultStatus = 'sent' | 'skipped' | 'failed';
type SkipReason = 'not_found' | 'not_awaiting' | 'not_po' | 'recent' | 'no_email' | 'no_amount';

interface ReminderResult {
  id: string;
  name: string;
  status: ResultStatus;
  reason?: SkipReason | 'send_failed';
  // Readable detail for failures
  message?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "October 1, 2026 - October 3, 2026" (or one date when the event is a single day)
const formatEventDates = (start?: string | null, end?: string | null): string => {
  if (!start) return '';
  const format = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return end && end !== start ? `${format(start)} - ${format(end)}` : format(start);
};

const looksLikeEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = allowedOrigins.some((allowed) => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // The caller must be a signed-in admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json(401, { error: 'Unauthorized' });

    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (roleError || !userData || userData.role !== 'admin') {
      return json(403, { error: 'Admin access required' });
    }

    // Validate the request
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid request body' });
    }

    const registrationType = body?.registrationType as RegistrationType;
    if (!registrationType || !Object.prototype.hasOwnProperty.call(TYPES, registrationType)) {
      return json(400, { error: 'Invalid registration type' });
    }
    const config = TYPES[registrationType];

    if (!Array.isArray(body?.registrationIds) || body.registrationIds.length === 0) {
      return json(400, { error: 'Choose at least one registration' });
    }
    if (body.registrationIds.length > MAX_IDS) {
      return json(400, { error: `Send at most ${MAX_IDS} reminders at a time` });
    }
    const ids: string[] = [];
    for (const raw of body.registrationIds) {
      let id: string;
      try {
        id = sanitizeUuid(raw);
      } catch {
        return json(400, { error: 'Invalid registration id' });
      }
      if (!ids.includes(id)) ids.push(id);
    }

    // Who already had a reminder in the last day. If the history cannot be read, send nothing: without it the
    // one-reminder-a-day rule cannot be enforced.
    const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentError } = await supabaseAdmin
      .from('registration_email_log')
      .select('registration_id')
      .eq('registration_type', registrationType)
      .eq('kind', 'reminder')
      .eq('status', 'sent')
      .gte('created_at', since)
      .in('registration_id', ids);
    if (recentError) {
      console.error('Could not read the email history:', recentError);
      return json(500, { error: 'The email history is not available, so no reminders were sent.' });
    }
    const recentlyReminded = new Set<string>((recent ?? []).map((row: { registration_id: string }) => row.registration_id));

    // The registrations
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from(config.table)
      .select('*')
      .in('id', ids);
    if (rowsError) {
      console.error('Could not read the registrations:', rowsError);
      return json(500, { error: 'Could not load the registrations' });
    }
    const byId = new Map<string, any>((rows ?? []).map((row: any) => [row.id, row]));

    // Shared details for every email
    const siteSettings = await fetchSettings(supabaseAdmin);
    const eventCache = new Map<string, any>();
    const loadEvent = async (registration: any) => {
      // A conference registration records its settings row; the other types use the active settings
      const key = registrationType === 'conference' && registration.conference_id ? registration.conference_id : 'active';
      if (eventCache.has(key)) return eventCache.get(key);
      let query = supabaseAdmin.from(config.eventTable).select('name, start_date, end_date, payment_instructions');
      query = key === 'active' ? query.eq('is_active', true) : query.eq('id', key);
      const { data, error } = await query.maybeSingle();
      if (error) console.warn('Could not load the event details:', error.message);
      eventCache.set(key, data ?? null);
      return data ?? null;
    };

    const results: ReminderResult[] = [];
    let sentOne = false;

    for (const id of ids) {
      const registration = byId.get(id);
      const name = registration
        ? (registrationType === 'exhibitor'
            ? registration.business_name || `${registration.first_name ?? ''} ${registration.last_name ?? ''}`.trim()
            : `${registration.first_name ?? ''} ${registration.last_name ?? ''}`.trim()) || 'Registration'
        : 'Unknown registration';

      const skip = (reason: SkipReason) => results.push({ id, name, status: 'skipped', reason });

      if (!registration) { skip('not_found'); continue; }
      const status = registration.payment_status ?? 'pending';
      if (status !== 'pending') { skip('not_awaiting'); continue; }
      if (registration.payment_method !== 'po') { skip('not_po'); continue; }
      if (recentlyReminded.has(id)) { skip('recent'); continue; }

      // Conference and tech registrations send their invoice to the billing contact, so the reminder goes there too
      const recipient = registrationType === 'exhibitor'
        ? registration.email
        : registration.billing_email || registration.email;
      if (!looksLikeEmail(recipient)) { skip('no_email'); continue; }

      const amount = Number(registration.total_amount);
      if (!Number.isFinite(amount) || amount <= 0) { skip('no_amount'); continue; }

      const event = await loadEvent(registration);
      const recipientName = registrationType !== 'exhibitor' && registration.billing_first_name
        ? `${registration.billing_first_name} ${registration.billing_last_name ?? ''}`.trim()
        : `${registration.first_name ?? ''} ${registration.last_name ?? ''}`.trim() || name;

      const emailData: PaymentReminderData = {
        registrationType,
        recipientName,
        registrantName: name,
        organization: registrationType === 'exhibitor' ? registration.business_name : registration.school_district,
        poNumber: registration.po_number || '',
        totalAmount: amount,
        registeredAt: registration.created_at,
        eventName: event?.name || '',
        eventDate: formatEventDates(event?.start_date, event?.end_date),
        paymentInstructions: event?.payment_instructions || '',
        remittanceAddress: formatRemittanceAddressPlain(siteSettings),
        contactEmail: siteSettings.payment_contact_email,
        contactPhone: siteSettings.payment_contact_phone,
        organizationName: siteSettings.site_organization_name
      };

      // Space the sends out so a batch stays under the email service's rate limit
      if (sentOne) await sleep(SEND_GAP_MS);
      sentOne = true;

      let emailResult: { success: boolean; error?: unknown };
      try {
        emailResult = await sendEmail({
          to: recipient.trim(),
          subject: `Payment Reminder${emailData.eventName ? ` - ${emailData.eventName}` : ''}${emailData.poNumber ? ` (PO: ${emailData.poNumber})` : ''}`,
          html: generatePaymentReminderEmail(emailData)
        });
      } catch (error) {
        emailResult = { success: false, error };
      }

      if (emailResult.success) {
        results.push({ id, name, status: 'sent' });
        await logRegistrationEmail(supabaseAdmin, {
          registrationType, registrationId: id, kind: 'reminder', recipient: recipient.trim(), status: 'sent', sentBy: user.id
        });
      } else {
        const message = describeEmailError(emailResult.error);
        console.error('Payment reminder failed for', id, message);
        results.push({ id, name, status: 'failed', reason: 'send_failed', message });
        await logRegistrationEmail(supabaseAdmin, {
          registrationType, registrationId: id, kind: 'reminder', recipient: recipient.trim(), status: 'failed', error: message, sentBy: user.id
        });
      }
    }

    return json(200, {
      success: true,
      results,
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length
    });
  } catch (error) {
    console.error('❌ Error sending payment reminders:', error);
    return json(500, { error: 'Failed to send payment reminders' });
  }
});
