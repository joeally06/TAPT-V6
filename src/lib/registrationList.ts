import type React from 'react';

// Class names and small helpers the four registration pages share (Conference, Tech Conference, Exhibitor, Regional
// Luncheon), so their tables look and behave the same.

export const TH_CLASS =
  'border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500';
export const TD_CLASS = 'border-b border-gray-100 px-3 py-2.5 align-middle';

// Short date for a table cell: "Feb 10"
export const formatCellDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// A pill for filters (payment, region)
export const chipClass = (active: boolean): string =>
  `rounded-full border px-2.5 py-1 text-xs font-semibold ${
    active ? 'border-tapt-navy bg-tapt-navy text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

export const paymentMethodLabel = (method: string | null | undefined): string | null =>
  method === 'po' ? 'Purchase order' : method === 'paypal' ? 'PayPal' : null;

// A row's class: ticked rows and the row open in the panel are tinted (and stay tinted under the mouse)
export const rowClass = (ticked: boolean, open: boolean): string =>
  `cursor-pointer ${ticked || open ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'}`;

// The open row also gets a bar on its left edge. It goes on the first cell: a shadow on the row itself is unreliable
// in tables with collapsed borders.
export const openBarClass = (open: boolean): string => (open ? 'shadow-[inset_3px_0_0_0_#2570a4]' : '');

// The full date, for the tooltip on the short date in a row
export const fullDate = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });

// Clicking anywhere on a row opens it. Clicks on the row's own checkbox, links and buttons keep their own meaning.
// The row's name button (data-row-open) takes focus, so closing the panel puts focus back on it.
export const rowClickHandler =
  (open: () => void) =>
  (event: React.MouseEvent<HTMLTableRowElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, label')) return;
    event.currentTarget.querySelector<HTMLElement>('[data-row-open]')?.focus();
    open();
  };
