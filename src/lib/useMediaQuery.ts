import { useCallback, useSyncExternalStore } from 'react';

// True while the browser window matches a CSS media query, for example '(min-width: 1280px)'.
// Used where the page layout must change in code as well as in CSS. False when the browser cannot say.
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );
  const getSnapshot = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

// Tailwind's `xl` breakpoint: wide enough to show a details panel beside a list.
export const WIDE_SCREEN_QUERY = '(min-width: 1280px)';
