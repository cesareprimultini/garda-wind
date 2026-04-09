/**
 * Client-side fetcher for historical wind observations.
 *
 * Production: calls /api/observations?station=xxx (Vercel serverless function)
 *   which fetches NDJSON from the data-log branch and returns a JSON array.
 *
 * Development: Vite doesn't run Vercel functions, so we fetch NDJSON directly
 *   from GitHub raw and parse it in the browser.
 *
 * In-memory cache (30 min TTL) prevents redundant fetches on panel re-mounts.
 */

const REPO   = 'cesareprimultini/garda-wind';
const BRANCH = 'data-log';

/** @type {Map<string, { data: object[], fetchedAt: number }>} */
const _cache = new Map();
const TTL_MS = 30 * 60 * 1000;

function parseNdjson(text, stationId) {
  if (!text) return [];
  return text
    .split('\n')
    .filter(line => line.startsWith('{'))
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean)
    .map(r => ({ ...r, station: r.station ?? stationId }));
}

async function fetchDev(stationId) {
  // Try per-station file; fall back to legacy file for torbole
  const paths = [`data/${stationId}.ndjson`];
  if (stationId === 'torbole') paths.push('data/observations.ndjson');

  for (const path of paths) {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (resp.status === 404) continue;
    if (!resp.ok) throw new Error(`GitHub raw HTTP ${resp.status}`);
    const text = await resp.text();
    const rows = parseNdjson(text, stationId);
    if (rows.length) return rows;
  }
  return [];
}

async function fetchProd(stationId) {
  const resp = await fetch(`/api/observations?station=${encodeURIComponent(stationId)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error('unexpected response shape');
  return data;
}

/**
 * Fetch historical observations for a station.
 * Returns an array of rows (oldest-first):
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
    const data = import.meta.env.DEV
      ? await fetchDev(stationId)
      : await fetchProd(stationId);

    _cache.set(stationId, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[observations] ${stationId}: ${err.message}`);
    return [];
  }
}
