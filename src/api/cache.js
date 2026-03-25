import { CACHE_TTL_MS, CACHE_STALE_MS } from '../utils/constants.js';

const CACHE_PREFIX = 'garda_wind_';

/**
 * Save weather data to localStorage cache
 * @param {string} stationId
 * @param {string} modelId
 * @param {object} data
 */
export function saveToCache(stationId, modelId, data) {
  const key = `${CACHE_PREFIX}${stationId}_${modelId}`;
  try {
    const entry = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    // localStorage might be full or unavailable
    console.warn('[Cache] Failed to save:', err);
  }
}

/**
 * Load weather data from cache if it's less than 10 minutes old
 * @param {string} stationId
 * @param {string} modelId
 * @returns {{ data: object, timestamp: number } | null}
 */
export function loadFromCache(stationId, modelId) {
  const key = `${CACHE_PREFIX}${stationId}_${modelId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.timestamp || !entry.data) return null;
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) return null; // too old
    return entry;
  } catch {
    return null;
  }
}

/**
 * Load stale cache (up to CACHE_STALE_MS old) — used as fallback when offline
 * @param {string} stationId
 * @param {string} modelId
 * @returns {{ data: object, timestamp: number } | null}
 */
export function loadStaleCache(stationId, modelId) {
  const key = `${CACHE_PREFIX}${stationId}_${modelId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.timestamp || !entry.data) return null;
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_STALE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

/**
 * Remove all cache entries older than CACHE_STALE_MS
 */
export function clearStaleCache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    const now = Date.now();
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const entry = JSON.parse(raw);
        if (!entry?.timestamp || now - entry.timestamp > CACHE_STALE_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn('[Cache] clearStaleCache failed:', err);
  }
}
