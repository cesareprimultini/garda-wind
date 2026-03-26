import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllData } from '../api/openmeteo.js';
import { transformData } from '../api/transform.js';
import { saveToCache, loadFromCache, loadStaleCache, clearStaleCache } from '../api/cache.js';

/**
 * Primary data hook — manages fetch lifecycle, caching, and model fallback
 * @param {string} stationId
 * @param {string} modelId
 * @returns {{ data, loading, error, lastUpdated, activeModel, refresh, isRefreshing }}
 */
export function useWeatherData(stationId, modelId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeModel, setActiveModel] = useState(modelId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const abortRef = useRef(null);

  const fetchData = useCallback(async (opts = {}) => {
    const { background = false } = opts;

    if (!background) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    // Cancel any ongoing request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    try {
      const {
        stationRaw,
        bolzanoRaw,
        ghediRaw,
        trentoRaw,
        veronaRaw,
        innsbruckRaw,
        bolzanoEnsemble,
        ghediEnsemble,
        dwdGhediObs,
        dwdInnsbruckObs,
        zamgInnsbruckObs,
        usedModelId,
      } = await fetchAllData(stationId, modelId);

      const transformed = transformData(stationRaw, bolzanoRaw, ghediRaw, {
        trentoRaw,
        veronaRaw,
        innsbruckRaw,
        bolzanoEnsemble,
        ghediEnsemble,
        dwdGhediObs,
        dwdInnsbruckObs,
        zamgInnsbruckObs,
      });

      saveToCache(stationId, modelId, {
        transformed,
        usedModelId,
      });

      setData(transformed);
      setActiveModel(usedModelId);
      setLastUpdated(new Date());
      setError(null);
      setIsOffline(false);
    } catch (err) {
      console.error('[useWeatherData] Fetch failed:', err);

      // On background refresh failure, keep existing data
      if (background && data) {
        setError(null); // don't show error if we have data
      } else {
        // Try stale cache as last resort
        const stale = loadStaleCache(stationId, modelId);
        if (stale) {
          setData(stale.data.transformed);
          setActiveModel(stale.data.usedModelId || modelId);
          setLastUpdated(new Date(stale.timestamp));
          setIsOffline(true);
          setError('Using cached data — network unavailable');
        } else {
          setError(err.message || 'Failed to load weather data');
          setData(null);
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [stationId, modelId]);

  // On mount or station/model change: show cache instantly, debounce network fetch.
  // 600ms debounce means rapid station-switching fires only ONE API call
  // (for the station the user settles on), never a burst of 7 simultaneous calls.
  useEffect(() => {
    clearStaleCache();

    const cached = loadFromCache(stationId, modelId);
    if (cached) {
      setData(cached.data.transformed);
      setActiveModel(cached.data.usedModelId || modelId);
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
    }

    const timer = setTimeout(() => {
      fetchData({ background: !!cached });
    }, 600);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [stationId, modelId]);

  const refresh = useCallback(() => {
    fetchData({ background: !!data });
  }, [fetchData, data]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    activeModel,
    refresh,
    isRefreshing,
    isOffline,
  };
}
