/**
 * Client-side fetcher for historical wind observations.
 * Calls /api/observations?station=xxx — served from the data-log git branch.
 *
 * In-memory cache with 30-min TTL prevents redundant fetches on every
 * panel render or station switch. The server also edge-caches for 30 min,
 * so GitHub is hit at most ~twice/hour per edge region.
 */

/** @type {Map<string, { data: object[], fetchedAt: number }>} */
const _cache = new Map();
const TTL_MS = 30 * 60 * 1000; // 30 min

/**
 * Fetch historical observations for a station.
 * Returns an array of rows sorted oldest-first:
 *   { ts, station, actual_wind_kn, actual_gust_kn, actual_dir, actual_temp,
 *     actual_time, arome_wind_kn, arome_gust_kn, dp_hpa, regime }
 *
 * Returns [] on error — the accuracy chart degrades gracefully.
 */
export async function fetchObservations(stationId) {
  if (!stationId) return [];

  const cached = _cache.get(stationId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.data;

  try {
    const resp = await fetch(`/api/observations?station=${encodeURIComponent(stationId)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('unexpected response shape');

    _cache.set(stationId, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[observations] ${stationId}: ${err.message}`);
    return [];
  }
}
