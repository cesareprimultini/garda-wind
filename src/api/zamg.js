/**
 * GeoSphere Austria TAWES API — 10-minute surface observations
 * https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min
 *
 * Station used:
 *   11320 — Innsbruck Universität (47.26°N 11.384°E, 578m)
 *
 * Parameters:
 *   PRED  — Mean sea level pressure (hPa)
 *   P     — Station pressure (hPa)
 *   FF    — Wind speed (m/s)
 *   DD    — Wind direction (°)
 *   FFX   — Wind gust speed (m/s)
 *   TL    — Air temperature (°C)
 */

const TAWES_BASE = '/api/zamg';
const INNSBRUCK_STATION = '11320';
const PARAMS = 'PRED,P,FF,DD,FFX,TL';

/**
 * Extract a parameter value from the TAWES feature properties.
 * GeoSphere returns a GeoJSON FeatureCollection; properties may nest values.
 */
function extractParam(properties, key) {
  const raw = properties?.[key];
  if (raw === null || raw === undefined) return null;
  // Some versions wrap: { value: X, unit: '...' }
  if (typeof raw === 'object' && 'value' in raw) return raw.value ?? null;
  return typeof raw === 'number' ? raw : null;
}

/**
 * Fetch current conditions from GeoSphere Austria TAWES for Innsbruck.
 * @returns {Promise<{ time: string, mslp: number|null, windSpeedMs: number|null, windDir: number|null, gustMs: number|null, temp: number|null } | null>}
 */
export async function fetchZAMGInnsbruck() {
  const params = new URLSearchParams({
    station_ids: INNSBRUCK_STATION,
    parameters:  PARAMS,
  });

  const url = `${TAWES_BASE}?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'GardaWind/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`ZAMG TAWES HTTP ${resp.status}`);

  const json = await resp.json();

  // GeoJSON FeatureCollection
  const feature = json?.features?.[0];
  if (!feature) throw new Error('ZAMG TAWES: no features in response');

  const props = feature.properties ?? {};

  // Datetime may be at top-level or in properties
  const time = props.datetime ?? json?.timestamps?.[0] ?? new Date().toISOString();

  return {
    time,
    mslp:       extractParam(props, 'PRED'),
    windSpeedMs: extractParam(props, 'FF'),
    windDir:    extractParam(props, 'DD'),
    gustMs:     extractParam(props, 'FFX'),
    temp:       extractParam(props, 'TL'),
  };
}
