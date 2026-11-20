import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Save } from 'lucide-react';
import { updateSiteSetting } from '../../lib/siteSettings';
import { fromLocalInput, toLocalInput } from '../../lib/datetime';
import {
  EMPTY_SITE_ALERT,
  SITE_ALERT_KEY,
  SITE_ALERT_MAX_MESSAGE,
  fetchSiteAlert,
  isAlertActive,
  isSafeAlertLink,
  type SiteAlertConfig,
  type SiteAlertLevel
} from '../../lib/siteAlert';
import { SiteAlertBar } from '../SiteAlert';

const LEVEL_OPTIONS: { value: SiteAlertLevel; label: string; hint: string }[] = [
  { value: 'info', label: 'Information', hint: 'Blue. Everyday notices.' },
  { value: 'urgent', label: 'Urgent', hint: 'Red. Deadlines and closures.' },
  { value: 'success', label: 'Good news', hint: 'Green. Results and thanks.' }
];

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary';

const describeStatus = (alert: SiteAlertConfig): string => {
  if (!alert.enabled) return 'Off. Visitors do not see it.';
  if (isAlertActive(alert)) return 'On. Visitors see it now.';
  return 'On, but outside its start and end dates. Visitors do not see it.';
};

export const SiteAlertSettings: React.FC = () => {
  const [alert, setAlert] = useState<SiteAlertConfig>(EMPTY_SITE_ALERT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAlert().then((stored) => {
      if (cancelled) return;
      if (stored) setAlert(stored);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (changes: Partial<SiteAlertConfig>) => {
    setAlert((prev) => ({ ...prev, ...changes }));
    setSuccess(null);
  };

  const validate = (): string | null => {
    const message = alert.message.trim();
    const linkUrl = alert.linkUrl.trim();
    if (alert.enabled && !message) return 'Enter a message before turning the alert on.';
    if (message.length > SITE_ALERT_MAX_MESSAGE) return `Keep the message to ${SITE_ALERT_MAX_MESSAGE} characters or fewer.`;
    if (linkUrl && !isSafeAlertLink(linkUrl)) return 'The link must start with / (a page on this site) or https://.';
    if (linkUrl && !alert.linkText.trim()) return 'Enter the text for the link button.';
    if (alert.linkText.trim() && !linkUrl) return 'Enter the link address, or clear the link text.';
    if (alert.startsAt && alert.endsAt && Date.parse(alert.endsAt) <= Date.parse(alert.startsAt)) {
      return 'The end time must be after the start time.';
    }
    return null;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const toSave: SiteAlertConfig = {
      ...alert,
      message: alert.message.trim(),
      linkText: alert.linkText.trim(),
      linkUrl: alert.linkUrl.trim()
    };

    setSaving(true);
    try {
      await updateSiteSetting(SITE_ALERT_KEY, toSave);
      setAlert(toSave);
      setSuccess('Alert saved. Visitors see the change the next time a page loads.');
    } catch (err) {
      console.error('Error saving site alert:', err);
      setError(`Failed to save the alert: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-secondary">Alert Bar</h2>
        <p className="mt-1 text-sm text-gray-600">
          A short notice shown at the top of every public page. Visitors can dismiss it, and it comes back if you
          change the message.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4" role="alert">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4" role="status">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <p className="ml-3 text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            id="alertEnabled"
            checked={alert.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Show the alert bar
        </label>
        <p className="mt-1 text-sm text-gray-600">{describeStatus(alert)}</p>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Type</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LEVEL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-md border p-3 text-sm ${
                alert.level === option.value ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="alertLevel"
                value={option.value}
                checked={alert.level === option.value}
                onChange={() => update({ level: option.value })}
                className="mr-2 text-primary focus:ring-primary"
              />
              <span className="font-medium text-gray-900">{option.label}</span>
              <span className="block pl-6 text-gray-600">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="alertMessage" className="block text-sm font-medium text-gray-700">
          Message
        </label>
        <textarea
          id="alertMessage"
          rows={2}
          maxLength={SITE_ALERT_MAX_MESSAGE}
          value={alert.message}
          onChange={(e) => update({ message: e.target.value })}
          className={INPUT_CLASS}
          placeholder="Conference registration closes Friday, March 6."
        />
        <p className="mt-1 text-xs text-gray-500">
          {alert.message.length} of {SITE_ALERT_MAX_MESSAGE} characters
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="alertLinkText" className="block text-sm font-medium text-gray-700">
            Link button text (optional)
          </label>
          <input
            type="text"
            id="alertLinkText"
            value={alert.linkText}
            onChange={(e) => update({ linkText: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Register now"
          />
        </div>
        <div>
          <label htmlFor="alertLinkUrl" className="block text-sm font-medium text-gray-700">
            Link address (optional)
          </label>
          <input
            type="text"
            id="alertLinkUrl"
            value={alert.linkUrl}
            onChange={(e) => update({ linkUrl: e.target.value })}
            className={INPUT_CLASS}
            placeholder="/conference-registration or https://…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="alertStartsAt" className="block text-sm font-medium text-gray-700">
            Start showing (optional)
          </label>
          <input
            type="datetime-local"
            id="alertStartsAt"
            value={toLocalInput(alert.startsAt)}
            onChange={(e) => update({ startsAt: fromLocalInput(e.target.value) })}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="alertEndsAt" className="block text-sm font-medium text-gray-700">
            Stop showing (optional)
          </label>
          <input
            type="datetime-local"
            id="alertEndsAt"
            value={toLocalInput(alert.endsAt)}
            onChange={(e) => update({ endsAt: fromLocalInput(e.target.value) })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Preview</p>
        <div className="overflow-hidden rounded-md border border-gray-200">
          <SiteAlertBar
            alert={{ ...alert, message: alert.message.trim() || 'Your message appears here.' }}
            onDismiss={() => undefined}
          />
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          <Save className="mr-2 h-5 w-5" />
          {saving ? 'Saving…' : 'Save alert'}
        </button>
      </div>
    </div>
  );
};

export default SiteAlertSettings;
