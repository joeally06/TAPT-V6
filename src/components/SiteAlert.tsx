import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import {
  alertSignature,
  fetchSiteAlert,
  isAlertActive,
  isInternalAlertLink,
  type SiteAlertConfig,
  type SiteAlertLevel
} from '../lib/siteAlert';

const DISMISS_KEY = 'tapt-site-alert-dismissed';

const LEVEL_STYLES: Record<
  SiteAlertLevel,
  { bar: string; Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  info: { bar: 'bg-tapt-blue text-white', Icon: Info, label: 'Notice' },
  urgent: { bar: 'bg-red-700 text-white', Icon: AlertCircle, label: 'Urgent notice' },
  success: { bar: 'bg-green-800 text-white', Icon: CheckCircle, label: 'Good news' }
};

const LINK_CLASS =
  'inline-flex items-center whitespace-nowrap rounded-md bg-white px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-100';

interface SiteAlertBarProps {
  alert: SiteAlertConfig;
  onDismiss?: () => void;
}

// The bar itself. Also used for the preview in Site Settings.
export const SiteAlertBar: React.FC<SiteAlertBarProps> = ({ alert, onDismiss }) => {
  const { bar, Icon, label } = LEVEL_STYLES[alert.level];
  const hasLink = alert.linkUrl !== '' && alert.linkText !== '';

  return (
    <div role={alert.level === 'urgent' ? 'alert' : 'status'} className={bar}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 break-words font-medium">
          <span className="sr-only">{label}: </span>
          {alert.message}
        </p>
        {hasLink &&
          (isInternalAlertLink(alert.linkUrl) ? (
            <Link to={alert.linkUrl} className={LINK_CLASS}>
              {alert.linkText}
            </Link>
          ) : (
            <a href={alert.linkUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              {alert.linkText}
            </a>
          ))}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="flex-shrink-0 rounded p-1 hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

// Fixed bar above the navbar on every public page. Its height is published as --alert-h
// so the navbar (top) and the page (body padding-top) move down by the same amount.
export const SiteAlert: React.FC = () => {
  const { pathname } = useLocation();
  const [alert, setAlert] = useState<SiteAlertConfig | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAlert().then((result) => {
      if (!cancelled) setAlert(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible =
    !pathname.startsWith('/admin') &&
    alert !== null &&
    isAlertActive(alert) &&
    dismissed !== alertSignature(alert);

  useEffect(() => {
    const root = document.documentElement;
    const element = barRef.current;
    if (!visible || !element) {
      root.style.removeProperty('--alert-h');
      return;
    }
    const update = () => root.style.setProperty('--alert-h', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--alert-h');
    };
  }, [visible]);

  if (!visible || !alert) return null;

  const handleDismiss = () => {
    const signature = alertSignature(alert);
    try {
      localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // Private browsing or blocked storage: hide it for this visit only.
    }
    setDismissed(signature);
  };

  return (
    <div ref={barRef} className="fixed inset-x-0 top-0 z-[60]">
      <SiteAlertBar alert={alert} onDismiss={handleDismiss} />
    </div>
  );
};

export default SiteAlert;
