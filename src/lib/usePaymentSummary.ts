import { useCallback, useEffect, useState } from 'react';
import { fetchPaymentSummary, type PaymentSummary, type PaymentTable } from './registrationPayments';
import { useLatestRequest } from './useLatestRequest';

// Totals for a whole registration table. Loads once `enabled` is true; call `reload` after a change.
export const usePaymentSummary = (table: PaymentTable, enabled: boolean) => {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const startRequest = useLatestRequest();

  const reload = useCallback(async () => {
    const isCurrent = startRequest();
    try {
      const result = await fetchPaymentSummary(table);
      if (!isCurrent()) return;
      setSummary(result);
      setFailed(false);
    } catch (err) {
      console.error('Error loading payment summary:', err);
      if (isCurrent()) setFailed(true);
    }
  }, [table, startRequest]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { summary, failed, reload };
};
