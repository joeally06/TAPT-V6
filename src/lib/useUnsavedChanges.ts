import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, type Blocker, type BlockerFunction } from 'react-router-dom';

export interface UnsavedChanges {
  // The person changed something on the page
  markDirty: () => void;
  // Everything on the page is saved, or was just loaded from the server
  markClean: () => void;
  setDirty: (dirty: boolean) => void;
  // Pass to <UnsavedChangesDialog>
  blocker: Blocker;
}

// Warns before a person leaves a page with changes they have not saved: moving to another page in the site (menu
// link, Back button) is held until they choose, and closing or reloading the tab shows the browser's own warning.
// The flag lives in a ref so a page can clear it and navigate in the same moment without being held up.
// Needs the app's data router (see App.tsx).
export const useUnsavedChanges = (): UnsavedChanges => {
  const dirty = useRef(false);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => dirty.current && currentLocation.pathname !== nextLocation.pathname,
    []
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      event.preventDefault();
      // Some browsers only show the warning when this is set
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);
  const markClean = useCallback(() => {
    dirty.current = false;
  }, []);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  return { markDirty, markClean, setDirty, blocker };
};
