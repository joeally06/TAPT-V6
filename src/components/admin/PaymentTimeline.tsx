import React from 'react';
import type { TimelineItem } from '../../lib/registrationEmails';

const DOT_CLASSES: Record<TimelineItem['tone'], string> = {
  done: 'bg-green-600',
  failed: 'bg-red-600',
  waiting: 'bg-gray-300'
};

const formatWhen = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

// What has happened to a registration, oldest first. Failures say "failed" in words, not only in color.
export const PaymentTimeline: React.FC<{ items: TimelineItem[]; loading?: boolean }> = ({ items, loading = false }) => (
  <div aria-busy={loading}>
    <ol aria-label="History" className="relative space-y-3 border-l-2 border-gray-200 pl-4 text-sm">
      {items.map((item) => (
        <li key={item.key} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT_CLASSES[item.tone]}`}
          />
          <p className={item.tone === 'waiting' ? 'text-gray-500' : 'font-medium text-gray-900'}>{item.label}</p>
          {item.at && <p className="text-xs text-gray-500">{formatWhen(item.at)}</p>}
          {item.detail && (
            <p className={`text-xs ${item.tone === 'failed' ? 'text-red-700' : 'text-gray-500'}`}>{item.detail}</p>
          )}
        </li>
      ))}
    </ol>
    {loading && <p className="mt-2 text-xs text-gray-500">Loading email history…</p>}
  </div>
);

export default PaymentTimeline;
