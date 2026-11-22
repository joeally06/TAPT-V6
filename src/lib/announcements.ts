export type AnnouncementCategory = 'general' | 'event' | 'deadline' | 'safety' | 'regulations' | 'industry';

// News is part of announcements, so its categories (regulations, industry) are here too.
export const ANNOUNCEMENT_CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'event', label: 'Event' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'safety', label: 'Safety' },
  { value: 'regulations', label: 'Regulations' },
  { value: 'industry', label: 'Industry News' }
];

// Colours of the category pill on cards and lists
export const ANNOUNCEMENT_CATEGORY_CLASSES: Record<AnnouncementCategory, string> = {
  general: 'bg-gray-100 text-gray-700',
  event: 'bg-blue-100 text-blue-800',
  deadline: 'bg-amber-100 text-amber-900',
  safety: 'bg-red-100 text-red-800',
  regulations: 'bg-purple-100 text-purple-800',
  industry: 'bg-teal-100 text-teal-800'
};

// News used its own category names before it became part of announcements; rows not converted yet still read well.
const LEGACY_CATEGORIES = new Map<string, AnnouncementCategory>([
  ['announcements', 'general'],
  ['events', 'event']
]);

// Announcements saved before categories existed have none; they show as General.
export const getAnnouncementCategory = (value: string | null | undefined): AnnouncementCategory => {
  if (ANNOUNCEMENT_CATEGORIES.some((c) => c.value === value)) return value as AnnouncementCategory;
  return (value && LEGACY_CATEGORIES.get(value)) || 'general';
};

// The News page filter: 'all' or one category
export const matchesAnnouncementCategory = (itemCategory: string | null | undefined, filter: string): boolean =>
  filter === 'all' || getAnnouncementCategory(itemCategory) === filter;

export const getAnnouncementCategoryLabel = (value: string | null | undefined): string =>
  ANNOUNCEMENT_CATEGORIES.find((c) => c.value === getAnnouncementCategory(value))?.label ?? 'General';

// Attachments are uploaded to Supabase storage; do not link to anything else.
export const isTrustedAttachmentUrl = (url: string | null | undefined): url is string => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const getAttachmentLabel = (mimeType: string | null | undefined): string => {
  if (!mimeType) return 'File';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('word')) return 'Word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
  if (mimeType === 'text/plain') return 'Text';
  return 'File';
};

export interface SchedulableItem {
  status: string;
  created_at: string;
  publish_at?: string | null;
  expires_at?: string | null;
  is_pinned?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The date shown to visitors: when it went live, not when it was first saved as a draft.
export const effectiveDate = (item: Pick<SchedulableItem, 'created_at' | 'publish_at'>): string =>
  item.publish_at || item.created_at;

export const isNewlyPosted = (
  item: Pick<SchedulableItem, 'created_at' | 'publish_at'>,
  now: number = Date.now()
): boolean => {
  const age = now - Date.parse(effectiveDate(item));
  return age >= 0 && age < 7 * DAY_MS;
};

// Pinned item first, then newest first.
export const sortForHome = <T extends SchedulableItem>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    return Date.parse(effectiveDate(b)) - Date.parse(effectiveDate(a));
  });

export type AnnouncementStatus = 'draft' | 'scheduled' | 'live' | 'expired';

export const getAnnouncementStatus = (
  item: Pick<SchedulableItem, 'status' | 'publish_at' | 'expires_at'>,
  now: number = Date.now()
): AnnouncementStatus => {
  if (item.status !== 'published') return 'draft';
  if (item.publish_at && Date.parse(item.publish_at) > now) return 'scheduled';
  if (item.expires_at && Date.parse(item.expires_at) <= now) return 'expired';
  return 'live';
};

// ---- the editor's Status control: Draft / Scheduled / Published ----

export type PublishMode = 'draft' | 'scheduled' | 'published';

// Which of the three buttons an existing announcement starts on. An expired one counts as Published.
export const getPublishMode = (
  item: Pick<SchedulableItem, 'status' | 'publish_at'>,
  now: number = Date.now()
): PublishMode => {
  if (item.status !== 'published') return 'draft';
  if (item.publish_at && Date.parse(item.publish_at) > now) return 'scheduled';
  return 'published';
};

export const getSaveLabel = (mode: PublishMode): string =>
  mode === 'draft' ? 'Save draft' : mode === 'scheduled' ? 'Save and schedule' : 'Save and publish';

const formatMoment = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

// The line under the Status control, for example "Goes live Mar 1, 2026, 8:00 AM and leaves the home page Apr 2, 2026, 12:00 AM."
export const describeSchedule = (
  mode: PublishMode,
  publishAt: string | null | undefined,
  expiresAt: string | null | undefined,
  now: number = Date.now()
): string => {
  const leaves = expiresAt ? ` and leaves the home page ${formatMoment(expiresAt)}.` : '. It stays until you remove it.';
  if (mode === 'draft') return 'Not visible to visitors until you choose Scheduled or Published.';
  if (mode === 'scheduled') {
    if (!publishAt) return 'Choose when it should go live.';
    if (Date.parse(publishAt) <= now) return 'That time has already passed. Pick a time in the future, or choose Published.';
    return `Goes live ${formatMoment(publishAt)}${leaves}`;
  }
  return `Live as soon as you save${leaves}`;
};

export interface AnnouncementSaveInput {
  mode: PublishMode;
  // An Event needs a date and is never pinned
  category?: string | null;
  date?: string | null;
  is_featured: boolean;
  is_pinned: boolean;
  publish_at: string | null;
  expires_at: string | null;
  // Status the announcement had when the editor opened (null for a new one)
  previousStatus: 'draft' | 'published' | null;
}

export interface AnnouncementSaveValues {
  status: 'draft' | 'published';
  featured: boolean;
  is_featured: boolean;
  is_pinned: boolean;
  publish_at: string | null;
  expires_at: string | null;
}

export type AnnouncementSaveResult = { ok: true; values: AnnouncementSaveValues } | { ok: false; error: string };

// Turns what the editor shows into what is saved, or says what is wrong.
export const prepareAnnouncementForSave = (
  input: AnnouncementSaveInput,
  now: number = Date.now()
): AnnouncementSaveResult => {
  const { mode, previousStatus } = input;
  const publishAt = input.publish_at;
  const expiresAt = input.expires_at;
  const isEvent = getAnnouncementCategory(input.category) === 'event';

  if (isEvent && !input.date) return { ok: false, error: 'Choose the date of the event.' };

  if (mode === 'scheduled') {
    if (!publishAt) return { ok: false, error: 'Choose when it should go live, or pick Published to publish now.' };
    if (Date.parse(publishAt) <= now) {
      return { ok: false, error: 'The publish time must be in the future. Pick Published to go live now.' };
    }
  }

  // Published means live now. Going live from a draft or a schedule stamps the moment, so visitors see the day it went
  // live; an announcement that is already live keeps its date.
  let publishOut = publishAt;
  if (mode === 'published') {
    const inFuture = Boolean(publishAt) && Date.parse(publishAt as string) > now;
    if (inFuture || (!publishAt && previousStatus !== 'published')) publishOut = new Date(now).toISOString();
  }

  if (expiresAt) {
    if (publishOut && Date.parse(expiresAt) <= Date.parse(publishOut)) {
      return {
        ok: false,
        error: mode === 'published' ? 'The "Remove on" time must be in the future.' : '"Remove on" must be after "Publish on".'
      };
    }
  }

  // A draft is never on the home page; a pin needs "Show on the home page"
  const featured = mode !== 'draft' && input.is_featured;
  return {
    ok: true,
    values: {
      status: mode === 'draft' ? 'draft' : 'published',
      featured,
      is_featured: featured,
      is_pinned: featured && input.is_pinned && !isEvent,
      publish_at: publishOut,
      expires_at: expiresAt
    }
  };
};
