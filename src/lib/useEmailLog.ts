import { useCallback, useEffect, useState } from 'react';
import {
  fetchEmailLog,
  fetchLastReminders,
  type EmailLogEntry,
  type EmailRegistrationType
} from './registrationEmails';
import type { RegistrationType } from './registrationPayments';
import { useLatestRequest } from './useLatestRequest';

// The email history of the registration that is open in the side panel.
export const useEmailLog = (type: EmailRegistrationType, registrationId: string | null) => {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const startRequest = useLatestRequest();

  const reload = useCallback(async () => {
    const isCurrent = startRequest();
    if (!registrationId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchEmailLog(type, registrationId);
    if (!isCurrent()) return;
    setEntries(data);
    setLoading(false);
  }, [type, registrationId, startRequest]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { entries, loading, reload };
};

// "Reminded Mar 3" for the rows on the page (id -> ISO time of the last reminder that went out).
export const useLastReminders = (type: RegistrationType, ids: string[]) => {
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const startRequest = useLatestRequest();
  // The effect depends on the ids themselves, not on a new array each render
  const key = ids.join(',');

  const reload = useCallback(async () => {
    const isCurrent = startRequest();
    if (ids.length === 0) {
      setReminders({});
      return;
    }
    const data = await fetchLastReminders(type, ids);
    if (isCurrent()) setReminders(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, key, startRequest]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reminders, reload };
};
