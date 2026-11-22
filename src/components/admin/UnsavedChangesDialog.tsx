import React, { useRef } from 'react';
import type { Blocker } from 'react-router-dom';
import { useDialogFocus } from '../../lib/useDialogFocus';

// "Leave without saving?" Shown while the router is holding a move away from a page with unsaved changes.
// Keep editing is the default (focused first, and Escape does the same).
export const UnsavedChangesDialog: React.FC<{ blocker: Blocker }> = ({ blocker }) => {
  const open = blocker.state === 'blocked';
  const ref = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const keepEditing = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };
  const leave = () => {
    if (blocker.state === 'blocked') blocker.proceed();
  };

  useDialogFocus(open, ref, keepEditing, { initialFocusRef: keepRef });
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-text"
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl outline-none"
      >
        <h2 id="unsaved-changes-title" className="mb-2 text-lg font-bold text-gray-900">
          Leave without saving?
        </h2>
        <p id="unsaved-changes-text" className="text-sm text-gray-700">
          You changed something on this page and have not saved it. If you leave now, those changes are lost.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={leave}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Leave without saving
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={keepEditing}
            className="rounded-md bg-tapt-navy px-4 py-2 text-sm font-medium text-white hover:bg-tapt-navy/90"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesDialog;
