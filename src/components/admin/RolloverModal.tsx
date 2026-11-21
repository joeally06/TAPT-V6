import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  ROLLOVER_FORMS,
  fetchRolloverCounts,
  type RolloverCounts,
  type RolloverType
} from '../../lib/rollover';

export interface RolloverField {
  id: string;
  label: string;
  type: 'text' | 'date';
  value: string;
  onChange: (value: string) => void;
}

interface RolloverModalProps {
  isOpen: boolean;
  type: RolloverType;
  title: string;
  fields: RolloverField[];
  // Extra sentence for forms with something the admin must check first
  note?: string;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const CONFIRM_PHRASE = 'ROLLOVER';

// Confirmation step for the yearly rollover: shows exactly how many rows will be archived, asks for the new
// cycle's name and dates, and needs the word ROLLOVER typed before the button works.
export const RolloverModal: React.FC<RolloverModalProps> = ({ isOpen, type, title, fields, note, submitting, onConfirm, onClose }) => {
  const form = ROLLOVER_FORMS[type];
  const [counts, setCounts] = useState<RolloverCounts | null>(null);
  const [countError, setCountError] = useState(false);
  const [phrase, setPhrase] = useState('');
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Count the rows each time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setCounts(null);
    setCountError(false);
    setPhrase('');
    fetchRolloverCounts(type)
      .then((result) => {
        if (!cancelled) setCounts(result);
      })
      .catch((error) => {
        console.error('Could not count rows for rollover:', error);
        if (!cancelled) setCountError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, type]);

  // Focus moves into the dialog when it opens and goes back to the button that opened it when it closes
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstFieldRef.current?.focus();
    return () => opener?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
        return;
      }
      // Keep Tab inside the dialog
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const canConfirm = phrase.trim().toUpperCase() === CONFIRM_PHRASE && !submitting;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rollover-title"
        className="bg-white rounded-lg p-8 max-w-md w-full max-h-full overflow-y-auto"
      >
        <h2 id="rollover-title" className="text-xl font-bold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-gray-600 mb-4">
          This archives everything submitted so far and starts a new cycle. Last year&apos;s settings are kept and can be
          activated again from the list on this page.
        </p>

        <div role="status" className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          {counts && (
            <>
              <p className="font-semibold">
                {counts.rows} {form.rowsLabel}
                {form.relatedLabel && ` and ${counts.related} ${form.relatedLabel}`} will be archived
                and removed from the live list.
              </p>
              <p className="mt-1">They stay available under Archives.</p>
            </>
          )}
          {!counts && !countError && <p>Counting current {form.rowsLabel}…</p>}
          {countError && (
            <p>
              <AlertCircle className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
              Could not count the current {form.rowsLabel}. The rollover still archives all of them.
            </p>
          )}
          <p className="mt-2">
            <a
              href={form.exportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-tapt-blue underline hover:text-tapt-navy"
            >
              Open the {form.rowsLabel} list in a new tab to export a copy first
            </a>
          </p>
        </div>

        {note && <p className="mb-4 text-sm text-gray-700">{note}</p>}

        <div className="space-y-4 mb-6">
          {fields.map((field, index) => (
            <div key={field.id}>
              <label htmlFor={`rollover-${field.id}`} className="block text-sm font-medium text-gray-700">
                {field.label}
              </label>
              <input
                ref={index === 0 ? firstFieldRef : undefined}
                id={`rollover-${field.id}`}
                type={field.type}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                disabled={submitting}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary disabled:bg-gray-100"
              />
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label htmlFor="rollover-confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Type {CONFIRM_PHRASE} to confirm
          </label>
          <input
            id="rollover-confirm"
            type="text"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            disabled={submitting}
            autoComplete="off"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary disabled:bg-gray-100"
            placeholder={CONFIRM_PHRASE}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Rolling Over...
              </>
            ) : (
              'Confirm Rollover'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolloverModal;
