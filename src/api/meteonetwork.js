/**
 * MeteoNetwork API — real station data for Lake Garda.
 *
 * Uses /data-realtime/{station_code} (real hardware measurements).
 * Falls back to null for stations with no known code — those show model data.
 *
 * All calls go through /api/meteonetwork (Vercel proxy, token server-side).
 *
 * Station endpoint field units (per swagger Realtime schema):
 *   wind_speed          → km/h
 *   wind_gust           → km/h
 *   wind_direction      → cardinal text ("S", "SSE")
 *   wind_direction_degree → degrees (44.5)
 *   temperature         → °C
 *   rh                  → % humidity
 *   smlp                → hPa
 */

// In-memory cache: key = station code, value = { data, fetchedAt }
// Prevents burst calls when switching stations quickly (per-session).
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — matches Vercel edge cache

async function fetchStationData(code) {
  const cached = _cache.get(code);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const resp = await fetch(`/api/meteonetwork?station=${encodeURIComponent(code)}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (resp.status === 204 || resp.status === 503) return null;
  if (!resp.ok) throw new Error(`MeteoNetwork proxy HTTP ${resp.status}`);

  const data = await resp.json();
  if (data.error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const windKmh = parseFloat(row.wind_speed)  || 0;
  const gustKmh = parseFloat(row.wind_gust)   || 0;

  const result = {
    temp:            parseFloat(row.temperature)        ?? null,
    humidity:        parseFloat(row.rh)                 ?? null,
    mslp:            parseFloat(row.smlp)               ?? null,
    windSpeedKn:     windKmh / 1.852,
    windGustKn:      gustKmh > 0 ? gustKmh / 1.852 : null,
    windDir:         parseFloat(row.wind_direction_degree) ?? null, // degrees
    windDirCardinal: row.wind_direction                  ?? null,   // "S", "SSE"
    stationCode:     row.station_code                   ?? code,
    stationName:     row.name                           ?? null,
    observationTime: row.observation_time_utc           ?? null,
    source:          'MeteoNetwork',
  };

  _cache.set(code, { data: result, fetchedAt: Date.now() });
  return result;
}

/**
 * Fetch live data for a list of stations.
 * Only fetches stations that have a known MeteoNetwork station code.
 * Stations with mnCode: null return null (app falls back to model data).
 *
 * @param {Array<{ id: string, mnCode: string|null }>} stations
 * @returns {Promise<Record<string, object|null>>}
 */
export async function fetchMeteoNetworkAll(stations) {
  const map = {};
  for (const s of stations) {
    if (!s.mnCode) {
      map[s.id] = null; // no real station — show model data
      continue;
    }
    try {
      map[s.id] = await fetchStationData(s.mnCode);
    } catch {
      map[s.id] = null;
    }
  }
  return map;
}
