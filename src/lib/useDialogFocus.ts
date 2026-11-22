import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Where Tab should go to stay inside a dialog: 'first', 'last', or null to let the browser move on as usual.
export const trapTabTarget = (
  count: number,
  activeIndex: number,
  shiftKey: boolean
): 'first' | 'last' | null => {
  if (count === 0) return null;
  // Focus outside the dialog (index -1) is pulled back in
  if (activeIndex < 0) return shiftKey ? 'last' : 'first';
  if (shiftKey && activeIndex === 0) return 'last';
  if (!shiftKey && activeIndex === count - 1) return 'first';
  return null;
};

interface DialogFocusOptions {
  // False while an action is running and the dialog must not be dismissed
  escapeCloses?: boolean;
  // Element to focus first; the dialog itself is focused when there is none
  initialFocusRef?: RefObject<HTMLElement | null>;
  // False for a panel beside the page (not a dialog): Tab may leave it, and Escape only counts while focus is inside it
  trapFocus?: boolean;
}

// Dialog behaviour for the admin side panel and dialogs: focus moves in when it opens, Tab stays inside, Escape
// closes, and focus goes back to the button that opened it.
export const useDialogFocus = (
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
  { escapeCloses = true, initialFocusRef, trapFocus = true }: DialogFocusOptions = {}
): void => {
  // A panel beside the list stays open while the user moves to other rows: remember the last row name they used
  const lastRowButton = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lastRowButton.current = null;
    (initialFocusRef?.current ?? containerRef.current)?.focus();
    return () => {
      // The opener may have been replaced by a refreshed list; fall back to the page's usual focus target
      const rowButton = lastRowButton.current;
      const target = rowButton && document.contains(rowButton) ? rowButton : opener;
      if (target && document.contains(target)) target.focus();
      else document.querySelector<HTMLElement>('[data-bulk-return-focus]')?.focus();
    };
    // Focus handling runs when the dialog opens or closes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || trapFocus) return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches?.('[data-row-open]')) lastRowButton.current = target;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [active, trapFocus]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escapeCloses) {
        // A panel beside the page leaves Escape alone while focus is elsewhere on the page, except on a list row's name
        const target = event.target as HTMLElement | null;
        if (!trapFocus && !containerRef.current?.contains(target) && !target?.closest?.('[data-row-open]')) return;
        event.stopPropagation();
        onEscape();
        return;
      }
      if (!trapFocus || event.key !== 'Tab' || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const target = trapTabTarget(focusable.length, activeIndex, event.shiftKey);
      if (target === 'first') {
        event.preventDefault();
        focusable[0].focus();
      } else if (target === 'last') {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, escapeCloses, trapFocus, onEscape, containerRef]);
};
