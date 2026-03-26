/**
 * /api/snapshot — Observation vs model comparison for data logging.
 *
 * Fetches in parallel:
 *   - Meteotrentino T0193 (Torbole) current wind observation
 *   - AROME 1.3km forecast for Torbole at the current hour
 *   - Bolzano + Ghedi pressure (for ΔP)
 *
 * Returns a single compact JSON row intended to be appended to
 * data/observations.ndjson by the GitHub Actions log-observation workflow.
 *
 * Response schema:
 * {
 *   ts,                  // ISO timestamp (start of current hour, UTC)
 *   actual_wind_kn,      // T0193 observed wind (knots) or null
 *   actual_gust_kn,      // T0193 observed gust (knots) or null
 *   actual_dir,          // T0193 wind direction (degrees) or null
 *   actual_temp,         // T0193 temperature (°C) or null
 *   actual_time,         // ISO timestamp of the observation reading
 *   arome_wind_kn,       // AROME forecast wind for current hour (knots) or null
 *   arome_gust_kn,       // AROME forecast gust for current hour (knots) or null
 *   arome_dir,           // AROME forecast wind direction (degrees) or null
 *   dp_hpa,              // Bolzano − Ghedi ΔP (hPa) or null
 *   regime,              // 'peler' | 'ora' | 'variable' | null
 *   ens_agreement,       // null (ensemble not fetched here — keep snapshot lean)
 * }
 */

const MT_BASE    = 'https://dati.meteotrentino.it/service.asmx/datiRealtimeUnaStazione';
const OM_BASE    = 'https://api.open-meteo.com/v1/meteofrance';

// Torbole coordinates
const LAT = 45.8689;
const LON = 10.8734;

// Bolzano + Ghedi coordinates for ΔP
const BOLZANO = { lat: 46.4983, lon: 11.3548 };
const GHEDI   = { lat: 45.4083, lon: 10.2671 };

const MS_TO_KN = 1.94384;

function mt(raw) {
  if (raw === '' || raw == null) return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

function detectRegime(dp) {
  if (dp === null) return null;
  if (dp < -1.5) return 'peler';
  if (dp > 1.5)  return 'ora';
  return 'variable';
}

async function fetchMT() {
  const url = `${MT_BASE}?stazione=T0193&h=1`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'GardaWind-Logger/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`MT HTTP ${resp.status}`);
  const geojson = await resp.json();
  const features = geojson?.features ?? [];
  if (!features.length) throw new Error('MT: no features');

  // Parse all, find most recent with wind data
  const readings = features
    .map(f => {
      const p = f?.properties;
      if (!p) return null;
      return {
        time:        p.datetime ?? null,
        windSpeedKn: mt(p['vvmed(m/s)']) !== null ? mt(p['vvmed(m/s)']) * MS_TO_KN : null,
        windGustKn:  mt(p['vvmax(m/s)']) !== null ? mt(p['vvmax(m/s)']) * MS_TO_KN : null,
        windDir:     mt(p['dvmed(gN)']),
        temp:        mt(p['ta(°C)']),
      };
    })
    .filter(r => r && r.time && r.windSpeedKn !== null)
    .reverse(); // newest first

  return readings[0] ?? null;
}

async function fetchArome() {
  const params = new URLSearchParams({
    latitude:  LAT,
    longitude: LON,
    hourly:    'wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    wind_speed_unit: 'kn',
    timezone:  'UTC',
    forecast_days: '1',
  });
  const resp = await fetch(`${OM_BASE}?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`AROME HTTP ${resp.status}`);
  const data = await resp.json();

  const h = data?.hourly;
  if (!h?.time) throw new Error('AROME: no hourly data');

  // Find the entry closest to now
  const now = Date.now();
  let nearest = null;
  let minDiff = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const diff = Math.abs(new Date(h.time[i] + 'Z').getTime() - now);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = {
        wind_kn:  h.wind_speed_10m?.[i]     ?? null,
        gust_kn:  h.wind_gusts_10m?.[i]     ?? null,
        dir:      h.wind_direction_10m?.[i]  ?? null,
      };
    }
  }
  return nearest;
}

async function fetchDeltaP() {
  const fetchNode = async ({ lat, lon }) => {
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: 'pressure_msl',
      timezone: 'UTC',
      forecast_days: '1',
    });
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`DP node HTTP ${resp.status}`);
    const data = await resp.json();
    const h = data?.hourly;
    if (!h?.time) return null;
    // Most recent past or current hour
    const now = Date.now();
    let val = null, minDiff = Infinity;
    for (let i = 0; i < h.time.length; i++) {
      const diff = Math.abs(new Date(h.time[i] + ':00Z').getTime() - now);
      if (diff < minDiff) { minDiff = diff; val = h.pressure_msl?.[i] ?? null; }
    }
    return val;
  };

  const [bolzano, ghedi] = await Promise.all([fetchNode(BOLZANO), fetchNode(GHEDI)]);
  if (bolzano === null || ghedi === null) return null;
  return parseFloat((bolzano - ghedi).toFixed(2));
}

export default async function handler(req, res) {
  // Hour-slot timestamp (start of current UTC hour)
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const ts = now.toISOString().substring(0, 16) + 'Z';

  const [mtResult, aromeResult, dpResult] = await Promise.allSettled([
    fetchMT(),
    fetchArome(),
    fetchDeltaP(),
  ]);

  const obs   = mtResult.status    === 'fulfilled' ? mtResult.value    : null;
  const arome = aromeResult.status === 'fulfilled' ? aromeResult.value : null;
  const dp    = dpResult.status    === 'fulfilled' ? dpResult.value    : null;

  const row = {
    ts,
    actual_wind_kn:  obs?.windSpeedKn ?? null,
    actual_gust_kn:  obs?.windGustKn  ?? null,
    actual_dir:      obs?.windDir     ?? null,
    actual_temp:     obs?.temp        ?? null,
    actual_time:     obs?.time        ?? null,
    arome_wind_kn:   arome?.wind_kn   ?? null,
    arome_gust_kn:   arome?.gust_kn   ?? null,
    arome_dir:       arome?.dir       ?? null,
    dp_hpa:          dp,
    regime:          detectRegime(dp),
    ens_agreement:   null,
  };

  // No caching — logger always needs fresh data
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(row);
}
