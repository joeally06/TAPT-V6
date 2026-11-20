import { getSiteSetting } from './siteSettings';

export type SiteAlertLevel = 'info' | 'urgent' | 'success';

export interface SiteAlertConfig {
  enabled: boolean;
  level: SiteAlertLevel;
  message: string;
  linkText: string;
  linkUrl: string;
  startsAt: string | null;
  endsAt: string | null;
}

export const SITE_ALERT_KEY = 'site_alert';
export const SITE_ALERT_MAX_MESSAGE = 200;

export const EMPTY_SITE_ALERT: SiteAlertConfig = {
  enabled: false,
  level: 'info',
  message: '',
  linkText: '',
  linkUrl: '',
  startsAt: null,
  endsAt: null
};

const LEVELS: SiteAlertLevel[] = ['info', 'urgent', 'success'];

// Internal paths ("/events") use the router; anything else must be http(s).
export const isInternalAlertLink = (url: string): boolean =>
  url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');

export const isSafeAlertLink = (url: string): boolean => {
  if (isInternalAlertLink(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const asDateString = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

// Turns whatever is stored in site_settings into a safe config, or null when there is nothing usable.
export const parseSiteAlert = (raw: unknown): SiteAlertConfig | null => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (!message) return null;

  const linkUrl = typeof record.linkUrl === 'string' ? record.linkUrl.trim() : '';

  return {
    enabled: record.enabled === true,
    level: LEVELS.includes(record.level as SiteAlertLevel) ? (record.level as SiteAlertLevel) : 'info',
    message: message.slice(0, SITE_ALERT_MAX_MESSAGE),
    linkText: typeof record.linkText === 'string' ? record.linkText.trim() : '',
    linkUrl: isSafeAlertLink(linkUrl) ? linkUrl : '',
    startsAt: asDateString(record.startsAt),
    endsAt: asDateString(record.endsAt)
  };
};

export const isAlertActive = (alert: SiteAlertConfig, now: number = Date.now()): boolean => {
  if (!alert.enabled || !alert.message) return false;
  if (alert.startsAt && Date.parse(alert.startsAt) > now) return false;
  if (alert.endsAt && Date.parse(alert.endsAt) <= now) return false;
  return true;
};

// Identifies one version of an alert, so a visitor's "dismiss" ends when the admin changes it.
export const alertSignature = (alert: SiteAlertConfig): string => {
  const text = `${alert.level}|${alert.message}|${alert.linkText}|${alert.linkUrl}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return String(hash);
};

export const fetchSiteAlert = async (): Promise<SiteAlertConfig | null> =>
  parseSiteAlert(await getSiteSetting(SITE_ALERT_KEY));
