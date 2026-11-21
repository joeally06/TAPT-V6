import { supabase } from './supabase';
import type { AdminCounts } from './adminCounts';

// ---- Data returned by the get-dashboard-stats function (the `dashboard` field) ----

export interface ProgramSummary {
  key: string;
  label: string;
  path: string;
  registered: number;
  paid: number;
  awaiting: number;
  collected: number;
  outstanding: number;
  newThisWeek: number;
}

export interface CountOnlyProgram {
  key: string;
  label: string;
  path: string;
  count: number;
}

export interface ClosingItem {
  label: string;
  name: string | null;
  closes_at: string;
  path: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  at: string;
  actor: string | null;
}

export interface DashboardData {
  programs: ProgramSummary[];
  others: CountOnlyProgram[];
  unpaidOverdue: { count: number; amount: number; days: number };
  closing: ClosingItem[];
  activity: ActivityItem[];
}

const asNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asList = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object') : [];

// The function may be an older deployment without this field, or return something unexpected: null then.
export const parseDashboard = (raw: unknown): DashboardData | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const overdue = (data.unpaidOverdue && typeof data.unpaidOverdue === 'object' ? data.unpaidOverdue : {}) as Record<
    string,
    unknown
  >;

  return {
    programs: asList(data.programs).map((p) => ({
      key: asString(p.key),
      label: asString(p.label),
      path: asString(p.path),
      registered: asNumber(p.registered),
      paid: asNumber(p.paid),
      awaiting: asNumber(p.awaiting),
      collected: asNumber(p.collected),
      outstanding: asNumber(p.outstanding),
      newThisWeek: asNumber(p.newThisWeek)
    })),
    others: asList(data.others).map((o) => ({
      key: asString(o.key),
      label: asString(o.label),
      path: asString(o.path),
      count: asNumber(o.count)
    })),
    unpaidOverdue: { count: asNumber(overdue.count), amount: asNumber(overdue.amount), days: asNumber(overdue.days) || 14 },
    closing: asList(data.closing)
      .map((c) => ({
        label: asString(c.label),
        name: typeof c.name === 'string' ? c.name : null,
        closes_at: asString(c.closes_at),
        path: asString(c.path)
      }))
      .filter((c) => c.closes_at !== ''),
    activity: asList(data.activity).map((a) => ({
      id: asString(a.id),
      action: asString(a.action),
      at: asString(a.at),
      actor: typeof a.actor === 'string' ? a.actor : null
    }))
  };
};

// undefined: the deployed function is an older one without the dashboard field. null: it could not be built.
export const fetchDashboard = async (): Promise<DashboardData | null | undefined> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not defined');

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(`${supabaseUrl}/functions/v1/get-dashboard-stats`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch dashboard statistics');
  }

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch dashboard statistics');
  if (result.dashboard === undefined) return undefined;
  return parseDashboard(result.dashboard);
};

// ---- Formatting ----

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });

export const pluralize = (count: number, singular: string, plural: string = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

// A closing date is the calendar date in its first ten characters (2026-04-30, or 2026-04-30T00:00:00+00:00 as
// the database returns it). That day is the same for every viewer, so build it in the viewer's own time zone
// instead of letting midnight UTC slip back to the evening before.
const parseDeadline = (iso: string): Date => {
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(iso);
};

// Day number and short month for the date badge, from the same date daysUntil uses.
export const deadlineParts = (iso: string): { day: number; month: string } => {
  const date = parseDeadline(iso);
  return { day: date.getDate(), month: date.toLocaleDateString('en-US', { month: 'short' }) };
};

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Whole calendar days from today until the date (0 = today, negative = past).
export const daysUntil = (iso: string, now: number = Date.now()): number =>
  Math.round((startOfDay(parseDeadline(iso)) - startOfDay(new Date(now))) / DAY_MS);

export const describeDaysUntil = (days: number): string =>
  days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

export const relativeTime = (iso: string, now: number = Date.now()): string => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ---- Activity wording ----

const SUBMISSIONS: Record<string, string> = {
  submit_exhibitor_registration: 'New exhibitor registration',
  submit_contact_message: 'New contact message',
  submit_scholarship_nomination: 'New scholarship application'
};

const ADMIN_ACTIONS: Record<string, string> = {
  create_content: 'added content',
  update_content: 'updated content',
  delete_content: 'deleted content',
  update_site_setting: 'changed a site setting',
  create_user: 'created a user',
  delete_user: 'deleted a user',
  assign_admin: 'changed a user role',
  create_hof_member: 'added a Hall of Fame member',
  update_hof_member: 'updated a Hall of Fame member',
  delete_hof_member: 'removed a Hall of Fame member',
  reorder_hof_members: 'reordered Hall of Fame members',
  update_message_status: 'updated a contact message',
  delete_contact_message: 'deleted a contact message',
  delete_resource: 'deleted a resource',
  secure_upload: 'uploaded a file',
  update_scholarship_settings: 'updated scholarship settings',
  update_exhibitor_settings: 'updated exhibitor settings',
  clear_scholarship_settings: 'cleared scholarship settings',
  clear_exhibitor_settings: 'cleared exhibitor settings',
  clear_scholarship_applications: 'cleared scholarship applications',
  clear_exhibitor_registrations: 'cleared exhibitor registrations',
  delete_scholarship_application: 'deleted a scholarship application',
  delete_exhibitor_registration: 'deleted an exhibitor registration',
  delete_hof_nomination: 'deleted a Hall of Fame nomination',
  delete_regional_director_nomination: 'deleted a Regional Director nomination',
  delete_president_nomination: 'deleted a President nomination',
  delete_membership_application: 'deleted a membership application',
  resend_regional_director_nomination_emails: 'resent Regional Director nomination emails',
  resend_president_nomination_emails: 'resent President nomination emails'
};

const STATUS_SUBJECTS: Record<string, string> = {
  scholarship_nomination: 'a scholarship application',
  regional_director_nomination: 'a Regional Director nomination',
  president_nomination: 'a President nomination',
  hof_nomination: 'a Hall of Fame nomination',
  membership: 'a membership application'
};

const STATUS_ACTION = /^update_(scholarship_nomination|regional_director_nomination|president_nomination|hof_nomination|membership)_status_(.+)$/;

const STATUS_VERBS: Record<string, string> = {
  approved: 'approved',
  rejected: 'rejected',
  pending: 'moved back to pending'
};

const humanize = (action: string): string => action.replace(/[_-]/g, ' ').trim().toLowerCase();

// One line for the activity feed, such as "admin@tapt.org approved a Hall of Fame nomination".
export const describeActivity = (action: string, actor: string | null): string => {
  if (SUBMISSIONS[action]) return SUBMISSIONS[action];

  const who = actor ?? 'An admin';
  const status = STATUS_ACTION.exec(action);
  if (status) {
    const verb = STATUS_VERBS[status[2]] ?? `set the status to ${status[2]} for`;
    return `${who} ${verb} ${STATUS_SUBJECTS[status[1]]}`;
  }
  if (ADMIN_ACTIONS[action]) return `${who} ${ADMIN_ACTIONS[action]}`;

  const rollover = /^rollover_(.+)$/.exec(action);
  if (rollover) return `${who} rolled over ${humanize(rollover[1])} for the new year`;

  return `${who}: ${humanize(action)}`;
};

// ---- Needs your attention ----

export type AttentionTone = 'red' | 'amber' | 'blue';

export interface AttentionItem {
  key: string;
  title: string;
  detail?: string;
  path: string;
  linkLabel: string;
  tone: AttentionTone;
}

const CLOSING_SOON_DAYS = 7;

// Only things with something waiting appear. Counts come from the sidebar's shared counts.
export const buildAttentionItems = (
  counts: AdminCounts,
  dashboard: DashboardData | null,
  now: number = Date.now()
): AttentionItem[] => {
  const items: AttentionItem[] = [];

  if (dashboard && dashboard.unpaidOverdue.count > 0) {
    const { count, amount, days } = dashboard.unpaidOverdue;
    items.push({
      key: 'overdue',
      title: `${pluralize(count, 'purchase order')} unpaid for more than ${days} days`,
      detail: `${formatMoney(amount)} outstanding`,
      path: '/admin/payment-management',
      linkLabel: 'Review',
      tone: 'red'
    });
  }

  if (counts.scholarships) {
    items.push({
      key: 'scholarships',
      title: `${pluralize(counts.scholarships, 'scholarship application')} waiting for review`,
      path: '/admin/student-scholarship-applications',
      linkLabel: 'Review',
      tone: 'amber'
    });
  }
  if (counts.hallOfFame) {
    items.push({
      key: 'hall-of-fame',
      title: `${pluralize(counts.hallOfFame, 'Hall of Fame nomination')} waiting for review`,
      path: '/admin/hall-of-fame-nominations',
      linkLabel: 'Review',
      tone: 'amber'
    });
  }
  if (counts.boardNominations) {
    items.push({
      key: 'board-nominations',
      title: `${pluralize(counts.boardNominations, 'board nomination')} waiting for review`,
      detail: 'Regional Director and President',
      path: '/admin/regional-director-nominations',
      linkLabel: 'Review',
      tone: 'amber'
    });
  }
  if (counts.memberships) {
    items.push({
      key: 'memberships',
      title: `${pluralize(counts.memberships, 'membership application')} waiting for review`,
      path: '/admin/memberships',
      linkLabel: 'Review',
      tone: 'amber'
    });
  }

  for (const closing of dashboard?.closing ?? []) {
    const days = daysUntil(closing.closes_at, now);
    if (days < 0 || days > CLOSING_SOON_DAYS) continue;
    items.push({
      key: `closing-${closing.label}-${closing.name ?? ''}-${closing.closes_at}`,
      title: `${closing.label} closes ${describeDaysUntil(days)}`,
      detail: closing.name ?? undefined,
      path: closing.path,
      linkLabel: 'Open',
      tone: 'amber'
    });
  }

  if (counts.messages) {
    items.push({
      key: 'messages',
      title: `${pluralize(counts.messages, 'unread contact message')}`,
      path: '/admin/contact-messages',
      linkLabel: 'Open inbox',
      tone: 'blue'
    });
  }

  return items;
};
