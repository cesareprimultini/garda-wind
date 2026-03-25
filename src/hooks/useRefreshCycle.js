import { useEffect, useRef, useState } from 'react';
import { REFRESH_INTERVAL_MS, CACHE_TTL_MS } from '../utils/constants.js';

/**
 * Hook that manages a 10-minute refresh cycle and visibility-based refresh
 * @param {Function} refreshFn - The function to call to refresh data
 * @param {Date|null} lastUpdated - When data was last fetched
 * @returns {{ isRefreshing: boolean }}
 */
export function useRefreshCycle(refreshFn, lastUpdated) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const refreshFnRef = useRef(refreshFn);

  // Keep ref up to date
  useEffect(() => {
    refreshFnRef.current = refreshFn;
  }, [refreshFn]);

  // 10-minute interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      refreshFnRef.current();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Visibility change: refresh if data is stale when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const age = lastUpdated ? Date.now() - lastUpdated.getTime() : Infinity;
        if (age > CACHE_TTL_MS) {
          refreshFnRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [lastUpdated]);

  return { isRefreshing };
}
