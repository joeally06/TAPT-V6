import React from 'react';
import { Download, Loader2 } from 'lucide-react';

interface BulkSelectionBarProps {
  count: number;
  exporting: boolean;
  onExport: () => void;
  onClear: () => void;
}

// Appears only while rows are ticked. The live region stays in the page so screen readers announce the change.
export const BulkSelectionBar: React.FC<BulkSelectionBarProps> = ({ count, exporting, onExport, onClear }) => (
  <div aria-live="polite" className="empty:hidden">
    {count > 0 && (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-tapt-navy px-4 py-2 text-sm text-white">
        <span className="font-semibold">{count} selected</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25 disabled:opacity-50 focus-visible:ring-white focus-visible:ring-offset-0"
          >
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
            className="rounded-md px-3 py-1.5 font-medium hover:bg-white/15 focus-visible:ring-white focus-visible:ring-offset-0"
          >
            Clear
          </button>
        </div>
      </div>
    )}
  </div>
);

export default BulkSelectionBar;
