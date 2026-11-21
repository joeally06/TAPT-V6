import { useCallback, useRef } from 'react';

// Guards against slow responses arriving out of order. Call it when a request starts; the function it
// returns says whether that request is still the newest one.
//
//   const startRequest = useLatestRequest();
//   const isCurrent = startRequest();
//   const data = await load();
//   if (!isCurrent()) return; // a newer request has started, drop this answer
export const useLatestRequest = () => {
  const counter = useRef(0);
  return useCallback(() => {
    const id = ++counter.current;
    return () => id === counter.current;
  }, []);
};
