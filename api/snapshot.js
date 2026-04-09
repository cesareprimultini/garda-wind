/**
 * /api/snapshot — Live observation vs AROME model snapshot for data logging.
 *
 * Called by the GitHub Actions log-observation workflow every 30 min for each station.
 * Usage: /api/snapshot?station=torbole|riva|malcesine|bardolino|peschiera
 *
 * Response schema (NDJSON row):
 * {
 *   ts,               // ISO timestamp (start of current UTC hour)
 *   station,          // station id
 *   actual_wind_kn,   // observed wind speed (knots) or null
 *   actual_gust_kn,   // observed gust (knots) or null
 *   actual_dir,       // observed direction (°) or null
 *   actual_temp,      // observed temperature (°C) or null
 *   actual_time,      // ISO timestamp of the observation reading
 *   arome_wind_kn,    // AROME forecast for current hour (knots) or null
 *   arome_gust_kn,
 *   arome_dir,
 *   dp_hpa,           // Bolzano − Ghedi ΔP (hPa) or null
 *   regime,           // 'peler' | 'ora' | 'variable' | null
 * }
 */

const MS_TO_KN = 1.94384;
const KMH_TO_KN = 1 / 1.852;

const MT_BASE = 'https://dati.meteotrentino.it/service.asmx/datiRealtimeUnaStazione';
const OM_BASE = 'https://api.open-meteo.com/v1/meteofrance';

const LEGA_NAVALE_URL =
  'https://stazioni5.soluzionimeteo.it/leganavalegarda/homepage/blocks/current/updater.php?interval=11';

const ARPAV_BASE = 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella';

const IPARASSITI_URLS = {
  malcesine: 'https://www.iparassiti.com/ane/malcesine/json/weewx_data.json',
};

// Bolzano + Ghedi for ΔP (always the same)
const BOLZANO = { lat: 46.4983, lon: 11.3548 };
const GHEDI   = { lat: 45.4083, lon: 10.2671 };

const STATIONS = {
  torbole:   { lat: 45.8689, lon: 10.8734, obs: 'meteotrentino', mtCode: 'T0193' },
  riva:      { lat: 45.8864, lon: 10.8389, obs: 'meteotrentino', mtCode: 'T0298' },
  malcesine: { lat: 45.7609, lon: 10.8118, obs: 'iparassiti',    ipLoc: 'malcesine' },
  bardolino: { lat: 45.5775, lon: 10.7017, obs: 'legaNavale' },
  peschiera: { lat: 45.4394, lon: 10.6926, obs: 'arpav',         arpavCode: 300005960 },
};

function detectRegime(dp) {
  if (dp == null) return null;
  if (dp < -1.5) return 'peler';
  if (dp > 1.5)  return 'ora';
  return 'variable';
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Live observation fetchers ────────────────────────────────────

async function fetchMeteotrentino(mtCode) {
  const url = `${MT_BASE}?stazione=${encodeURIComponent(mtCode)}&h=1`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'GardaWind-Logger/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`MT HTTP ${resp.status}`);
  const geojson = await resp.json();
  const features = geojson?.features ?? [];
  if (!features.length) throw new Error('MT: no features');

  const readings = features
    .map(f => {
      const p = f?.properties;
      if (!p) return null;
      const speed = numOrNull(p['vvmed(m/s)']);
      const gust  = numOrNull(p['vvmax(m/s)']);
      return {
        time:        p.datetime ?? null,
        windSpeedKn: speed != null ? speed * MS_TO_KN : null,
        windGustKn:  gust  != null ? gust  * MS_TO_KN : null,
        windDir:     numOrNull(p['dvmed(gN)']),
        temp:        numOrNull(p['ta(°C)']),
      };
    })
    .filter(r => r?.time && r.windSpeedKn != null)
    .reverse();

  return readings[0] ?? null;
}

async function fetchIparassiti(ipLoc) {
  const url = IPARASSITI_URLS[ipLoc];
  if (!url) throw new Error(`iparassiti: unknown loc ${ipLoc}`);
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'GardaWind-Logger/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`iparassiti HTTP ${resp.status}`);
  const data = await resp.json();
  const curr = data?.current;
  if (!curr) throw new Error('iparassiti: no current');

  const parseStr = (s) => {
    if (!s) return null;
    const n = parseFloat(s.replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  };

  const speedMs = parseStr(curr.windspeed);
  const gustMs  = numOrNull(curr.windGust_formatted);
  return {
    time:        curr.datetime ?? null,
    windSpeedKn: speedMs != null ? speedMs * MS_TO_KN : null,
    windGustKn:  gustMs  != null ? gustMs  * MS_TO_KN : null,
    windDir:     numOrNull(curr.winddir_formatted),
    temp:        numOrNull(curr.outTemp_formatted),
  };
}

async function fetchLeganavale() {
  const resp = await fetch(LEGA_NAVALE_URL, {
    headers: { 'User-Agent': 'GardaWind-Logger/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`LeganAvale HTTP ${resp.status}`);
  const data = await resp.json();
  const d = data?.[0] ?? data;
  if (!d) throw new Error('LeganAvale: no data');

  const windKmh = parseFloat(d.W) || 0;
  const gustKmh = parseFloat(d.G) || windKmh;
  return {
    time:        d.datetime ?? d.date ?? null,
    windSpeedKn: windKmh * KMH_TO_KN,
    windGustKn:  gustKmh * KMH_TO_KN,
    windDir:     numOrNull(d.D),
    temp:        numOrNull(d.T),
  };
}

async function fetchArpav(arpavCode) {
  const url = `${ARPAV_BASE}?codseqst=${arpavCode}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GardaWind-Logger/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`ARPAV HTTP ${resp.status}`);
  const json = await resp.json();
  const items = json?.data;
  if (!Array.isArray(items) || !items.length) throw new Error('ARPAV: no data');

  // Group by sensor type, keep newest reading per sensor
  const latest = {};
  for (const item of items) {
    const tipo = item.tipo;
    if (!tipo) continue;
    if (!latest[tipo] || item.dataora > latest[tipo].dataora) latest[tipo] = item;
  }

  const speedMs = numOrNull(latest['VVENTO10M']?.valore);
  if (speedMs == null) throw new Error('ARPAV: no wind reading');

  const times = Object.values(latest).map(i => i.dataora).filter(Boolean).sort();
  return {
    time:        times.at(-1) ?? null,
    windSpeedKn: speedMs * MS_TO_KN,
    windGustKn:  null,
    windDir:     numOrNull(latest['DVENTO10M']?.valore),
    temp:        numOrNull(latest['TARIA2M']?.valore),
  };
}

// ── AROME forecast for a lat/lon at the current hour ────────────

async function fetchArome(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
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

  const now = Date.now();
  let nearest = null;
  let minDiff = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const diff = Math.abs(new Date(h.time[i] + 'Z').getTime() - now);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = {
        wind_kn: h.wind_speed_10m?.[i]    ?? null,
        gust_kn: h.wind_gusts_10m?.[i]    ?? null,
        dir:     h.wind_direction_10m?.[i] ?? null,
      };
    }
  }
  return nearest;
}

// ── ΔP (always Bolzano − Ghedi) ─────────────────────────────────

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
    const now = Date.now();
    let val = null, minDiff = Infinity;
    for (let i = 0; i < h.time.length; i++) {
      const diff = Math.abs(new Date(h.time[i] + ':00Z').getTime() - now);
      if (diff < minDiff) { minDiff = diff; val = h.pressure_msl?.[i] ?? null; }
    }
    return val;
  };
  const [b, g] = await Promise.all([fetchNode(BOLZANO), fetchNode(GHEDI)]);
  if (b == null || g == null) return null;
  return parseFloat((b - g).toFixed(2));
}

// ── Handler ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  const stationId = req.query.station ?? 'torbole';
  const cfg = STATIONS[stationId];
  if (!cfg) {
    return res.status(400).json({ error: `Unknown station: ${stationId}` });
  }

  // Current-hour timestamp (UTC)
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const ts = now.toISOString().substring(0, 16) + 'Z';

  // Fetch obs, AROME, ΔP in parallel
  const [obsResult, aromeResult, dpResult] = await Promise.allSettled([
    cfg.obs === 'meteotrentino' ? fetchMeteotrentino(cfg.mtCode) :
    cfg.obs === 'iparassiti'   ? fetchIparassiti(cfg.ipLoc)       :
    cfg.obs === 'legaNavale'   ? fetchLeganavale()                 :
    cfg.obs === 'arpav'        ? fetchArpav(cfg.arpavCode)         :
    Promise.reject(new Error('unknown obs type')),
    fetchArome(cfg.lat, cfg.lon),
    fetchDeltaP(),
  ]);

  const obs   = obsResult.status   === 'fulfilled' ? obsResult.value   : null;
  const arome = aromeResult.status === 'fulfilled' ? aromeResult.value : null;
  const dp    = dpResult.status    === 'fulfilled' ? dpResult.value    : null;

  const row = {
    ts,
    station:        stationId,
    actual_wind_kn: obs?.windSpeedKn ?? null,
    actual_gust_kn: obs?.windGustKn  ?? null,
    actual_dir:     obs?.windDir     ?? null,
    actual_temp:    obs?.temp        ?? null,
    actual_time:    obs?.time        ?? null,
    arome_wind_kn:  arome?.wind_kn   ?? null,
    arome_gust_kn:  arome?.gust_kn   ?? null,
    arome_dir:      arome?.dir       ?? null,
    dp_hpa:         dp,
    regime:         detectRegime(dp),
  };

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(row);
}
