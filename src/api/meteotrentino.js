/**
 * Meteotrentino live station data — Torbole (T0193) and Riva del Garda (T0298).
 *
 * Endpoint: datiRealtimeUnaStazione — free, no auth, 5-min updates.
 * Returns a GeoJSON FeatureCollection; each Feature = one 5-min observation.
 * Requesting h=6 gives ~72 features covering the last 6 hours.
 *
 * Actual field keys in feature.properties (confirmed from live API):
 *   "vvmed(m/s)"  — avg wind speed (m/s), string, empty string when not recorded
 *   "vvmax(m/s)"  — max wind / gust (m/s)
 *   "dvmed(gN)"   — mean wind direction (degrees from North)
 *   "ta(°C)"      — air temperature (°C)
 *   "press(hPa)"  — mean sea level pressure (hPa)
 *   "umid(%)"     — relative humidity (%)
 *   "datetime"    — ISO 8601 with Rome offset, e.g. "2026-03-26T11:10:00+01"
 *
 * Note: sensors alternate — a given 5-min row may have wind OR temp/pressure
 * but not both. Parse each field independently; empty string → null.
 */

const MS_TO_KN = 1.94384;

function mt(raw) {
  if (raw === '' || raw == null) return null;
  const v = parseFloat(raw);
  return isNaN(v) ? null : v;
}

function parseFeature(feature) {
  const p = feature?.properties;
  if (!p) return null;

  const windSpeedMs = mt(p['vvmed(m/s)']);
  const windGustMs  = mt(p['vvmax(m/s)']);

  return {
    time:        p.datetime ?? null,
    windSpeedKn: windSpeedMs !== null ? windSpeedMs * MS_TO_KN : null,
    windGustKn:  windGustMs  !== null ? windGustMs  * MS_TO_KN : null,
    windDir:     mt(p['dvmed(gN)']),
    temp:        mt(p['ta(°C)']),
    mslp:        mt(p['press(hPa)']),
    humidity:    mt(p['umid(%)']),
  };
}

/**
 * Fetch live + recent history for a Meteotrentino station.
 *
 * @param {string} stazione  — 'T0193' (Torbole) | 'T0298' (Riva del Garda)
 * @param {number} [hours=6] — hours of history (max 168)
 * @returns {Promise<{ latest: object|null, history: object[] }>}
 *   latest  — most recent reading that has wind data
 *   history — all wind-bearing readings, newest first
 */
export async function fetchMeteotrentino(stazione, hours = 6) {
  const url = `/api/meteotrentino?stazione=${encodeURIComponent(stazione)}&h=${hours}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`Meteotrentino proxy HTTP ${resp.status} for ${stazione}`);

  const geojson = await resp.json();
  const features = geojson?.features ?? [];

  if (features.length === 0) throw new Error(`Meteotrentino ${stazione}: no features`);

  const source = `Meteotrentino ${stazione}`;

  // Parse all features (oldest-first from API), then reverse to newest-first
  const all = features
    .map(parseFeature)
    .filter(r => r !== null && r.time !== null)
    .reverse(); // newest first

  // Keep only entries that have wind data for history overlay
  const windReadings = all.filter(r => r.windSpeedKn !== null);

  // For latest: most recent wind reading
  const latest = windReadings[0] ?? null;
  if (!latest) throw new Error(`Meteotrentino ${stazione}: no wind readings`);

  return {
    latest: { ...latest, source },
    history: windReadings.map(r => ({ ...r, source })),
  };
}
