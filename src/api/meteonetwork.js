/**
 * MeteoNetwork API — interpolated realtime data for Lake Garda stations.
 *
 * Uses the /interpolated-realtime endpoint (standard token, no BULK needed).
 * Data comes from a 2.5km grid — the `distance` field shows km to nearest station.
 *
 * All calls go through /api/meteonetwork (Vercel proxy) to keep the token server-side.
 *
 * Field units (per swagger.yaml schema):
 *   wind_speed            → km/h  (swagger: "Wind Speed (km/h)")
 *   wind_direction        → degrees (live data confirmed: "164" = SSE bearing)
 *   wind_direction_cardinal → cardinal text ("SSE") — docs example is misleading
 *   smlp                  → hPa (sea level pressure)
 *   temperature           → °C
 *   rh                    → % humidity
 */

/**
 * Fetch interpolated realtime data for a single lat/lon location.
 * Returns null if no data or token not configured.
 */
async function fetchInterpolated(lat, lon) {
  const resp = await fetch(`/api/meteonetwork?lat=${lat}&lon=${lon}`, {
    signal: AbortSignal.timeout(8000),
  });

  if (resp.status === 204 || resp.status === 503) return null; // no data or token not set
  if (!resp.ok) throw new Error(`MeteoNetwork proxy HTTP ${resp.status}`);

  const data = await resp.json();
  if (data.error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const windKmh = parseFloat(row.wind_speed) || 0;
  const gustKmh = parseFloat(row.wind_gust) || 0;

  return {
    temp:           parseFloat(row.temperature) ?? null,
    humidity:       parseFloat(row.rh)          ?? null,
    mslp:           parseFloat(row.smlp)        ?? null,
    windSpeedKn:    windKmh / 1.852,                       // km/h → knots
    windGustKn:     gustKmh > 0 ? gustKmh / 1.852 : null,
    windDir:        parseFloat(row.wind_direction) ?? null, // degrees
    windDirCardinal: row.wind_direction_cardinal  ?? null,  // "SSE" etc.
    dewPoint:       parseFloat(row.dew_point)     ?? null,
    distance:       parseFloat(row.distance)      ?? null,  // km to nearest real station
    source:         'MeteoNetwork',
  };
}

/**
 * Fetch interpolated observed data for all provided stations in parallel.
 * Returns a map of stationId → observed data (or null on failure).
 *
 * @param {Array<{ id: string, lat: number, lon: number }>} stations
 */
export async function fetchMeteoNetworkAll(stations) {
  const map = {};
  for (const s of stations) {
    try {
      map[s.id] = await fetchInterpolated(s.lat, s.lon);
    } catch {
      map[s.id] = null;
    }
  }
  return map;
}
