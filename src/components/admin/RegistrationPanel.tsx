import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { WIDE_SCREEN_QUERY, useMediaQuery } from '../../lib/useMediaQuery';

interface RegistrationPanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  // First in the panel: the payment status and history
  top?: React.ReactNode;
  // Email buttons, shown under `top`
  actions?: React.ReactNode;
  // The full details
  children: React.ReactNode;
}

// The details of one registration. On a wide screen it sits beside the list in the page's right-hand column (the
// page puts it inside <RegistrationSplit>), so the list stays usable. On a narrower screen there is no room beside
// the list, so it slides in over it as a dialog.
// Either way: focus moves in when it opens, Escape closes it, and focus returns to the row that opened it.
export const RegistrationPanel: React.FC<RegistrationPanelProps> = ({
  open,
  title,
  subtitle,
  onClose,
  top,
  actions,
  children
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery(WIDE_SCREEN_QUERY);
  useDialogFocus(open, panelRef, onClose, { trapFocus: !wide });

  if (!open) return null;

  const content = (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id="registration-panel-title" className="truncate text-base font-semibold text-gray-900">
            {title}
          </h2>
          {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded p-1 text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Tells a screen reader that the panel now shows someone else (focus stays on the row that was chosen) */}
      <p className="sr-only" role="status">
        Showing details for {title}
      </p>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* Keyed so that a page can key what it passes in (by registration id) without the keys clashing */}
        <React.Fragment key="top">{top}</React.Fragment>
        <React.Fragment key="actions">{actions}</React.Fragment>
        <React.Fragment key="details">{children}</React.Fragment>
      </div>
    </>
  );

  if (wide) {
    return (
      <aside
        ref={panelRef}
        aria-labelledby="registration-panel-title"
        tabIndex={-1}
        className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col rounded-lg border border-gray-200 bg-white shadow-sm outline-none"
      >
        {content}
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-panel-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl outline-none"
      >
        {content}
      </div>
    </div>
  );
};

// A page's list and panel. On a wide screen, while a panel is open, the list takes the left part and the panel a
// fixed column on the right; otherwise the list takes the whole width.
export const RegistrationSplit: React.FC<{ panelOpen: boolean; children: React.ReactNode }> = ({
  panelOpen,
  children
}) => (
  <div className={panelOpen ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_22.5rem] xl:items-start xl:gap-4' : undefined}>{children}</div>
);

// A titled block inside the panel
export const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const id = `panel-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      {children}
    </section>
  );
};

// Label and value pairs, label on the left
export const PanelFields: React.FC<{ fields: { label: string; value: React.ReactNode }[] }> = ({ fields }) => (
  <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
    {fields.map((field) => (
      <React.Fragment key={field.label}>
        <dt className="text-gray-500">{field.label}</dt>
        <dd className="break-words font-medium text-gray-900">{field.value || 'N/A'}</dd>
      </React.Fragment>
    ))}
  </dl>
);

export default RegistrationPanel;
