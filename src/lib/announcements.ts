export type AnnouncementCategory = 'event' | 'deadline' | 'safety' | 'general';

export const ANNOUNCEMENT_CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'event', label: 'Event' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'safety', label: 'Safety' }
];

// Announcements saved before categories existed have none; they show as General.
export const getAnnouncementCategory = (value: string | null | undefined): AnnouncementCategory =>
  ANNOUNCEMENT_CATEGORIES.some((c) => c.value === value) ? (value as AnnouncementCategory) : 'general';

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
