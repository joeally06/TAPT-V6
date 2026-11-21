import { useEffect, useState } from 'react';

// The value, but only after it has stopped changing for `delayMs`. Used so typing in a search box asks the
// server once the person pauses, not on every keystroke.
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
