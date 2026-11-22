import React from 'react';
import { Download, Loader2 } from 'lucide-react';

export interface BulkAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface BulkSelectionBarProps {
  count: number;
  exporting: boolean;
  onExport: () => void;
  onClear: () => void;
  // Extra buttons shown before Export selected, for example "Send reminders"
  actions?: BulkAction[];
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25 disabled:opacity-50 focus-visible:ring-white focus-visible:ring-offset-0';

// Appears only while rows are ticked. The live region stays in the page so screen readers announce the change.
export const BulkSelectionBar: React.FC<BulkSelectionBarProps> = ({ count, exporting, onExport, onClear, actions = [] }) => (
  <div aria-live="polite" className="empty:hidden">
    {count > 0 && (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-tapt-navy px-3 py-1.5 text-xs text-white">
        <span className="font-semibold">{count} selected</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {actions.map((action) => (
            <button key={action.key} type="button" onClick={action.onClick} disabled={action.disabled} className={BUTTON_CLASS}>
              {action.icon}
              {action.label}
            </button>
          ))}
          <button type="button" onClick={onExport} disabled={exporting} className={BUTTON_CLASS}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Export selected
          </button>
          <button
            type="button"
            onClick={() => {
              onClear();
              // The bar disappears, so put keyboard focus somewhere useful instead of losing it
              requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-bulk-return-focus]')?.focus());
            }}
            className="rounded-md px-2.5 py-1 font-semibold hover:bg-white/15 focus-visible:ring-white focus-visible:ring-offset-0"
          >
            Clear
          </button>
        </div>
      </div>
    )}
  </div>
);

export default BulkSelectionBar;
