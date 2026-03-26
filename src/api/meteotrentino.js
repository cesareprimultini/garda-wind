/**
 * Meteotrentino live station data — Torbole (T0193) and Riva del Garda (T0298).
 *
 * Endpoint: datiRealtimeUnaStazione — free, no auth, 5-min updates.
 * Returns a GeoJSON FeatureCollection; each Feature = one 5-min observation.
 * Requesting h=6 gives ~72 features covering the last 6 hours.
 *
 * Field reference (per feature.properties):
 *   vvmed  (m/s)  — average wind speed
 *   vvmax  (m/s)  — max wind speed (gust equivalent)
 *   dvmed  (°)    — mean wind direction (degrees from North)
 *   ta     (°C)   — air temperature
 *   press  (hPa)  — mean sea level pressure
 *   datetime      — ISO 8601, Europe/Rome offset (e.g. "2026-03-26T10:40:00+01")
 */

const MS_TO_KN = 1.94384;

/**
 * Parse a single Meteotrentino GeoJSON feature into a normalised reading.
 */
function parseFeature(feature) {
  const p = feature?.properties;
  if (!p) return null;

  const windSpeedMs = parseFloat(p.vvmed) || null;
  const windGustMs  = parseFloat(p.vvmax) || null;

  return {
    time:        p.datetime ?? null,
    windSpeedKn: windSpeedMs !== null ? windSpeedMs * MS_TO_KN : null,
    windGustKn:  windGustMs  !== null ? windGustMs  * MS_TO_KN : null,
    windDir:     parseFloat(p.dvmed) || null,
    temp:        parseFloat(p.ta)    ?? null,
    mslp:        parseFloat(p.press) ?? null,
    humidity:    parseFloat(p.umid)  ?? null,
  };
}

/**
 * Fetch live + recent history for a Meteotrentino station.
 *
 * @param {string} stazione  — 'T0193' (Torbole) | 'T0298' (Riva del Garda)
 * @param {number} [hours=6] — hours of history (max 168)
 * @returns {Promise<{ latest: object|null, history: object[] }>}
 *   latest  — most recent reading
 *   history — all readings, newest first, normalised
 */
export async function fetchMeteotrentino(stazione, hours = 6) {
  const url = `/api/meteotrentino?stazione=${encodeURIComponent(stazione)}&h=${hours}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`Meteotrentino proxy HTTP ${resp.status} for ${stazione}`);

  const geojson = await resp.json();
  const features = geojson?.features ?? [];

  if (features.length === 0) throw new Error(`Meteotrentino ${stazione}: no features`);

  // Features arrive oldest-first; reverse to newest-first
  const readings = features
    .map(parseFeature)
    .filter(r => r !== null && r.time !== null)
    .reverse(); // newest first

  const latest = readings[0] ?? null;
  if (!latest) throw new Error(`Meteotrentino ${stazione}: no valid readings`);

  return {
    latest: { ...latest, source: `Meteotrentino ${stazione}` },
    history: readings.map(r => ({ ...r, source: `Meteotrentino ${stazione}` })),
  };
}
