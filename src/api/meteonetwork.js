/**
 * MeteoNetwork API — interpolated realtime data for Lake Garda stations.
 *
 * Uses the /interpolated-realtime endpoint (standard token, no BULK needed).
 * Data comes from a 2.5km grid — the `distance` field shows km to nearest station.
 *
 * All calls go through /api/meteonetwork (Vercel proxy) to keep the token server-side.
 *
 * Field units (from API docs):
 *   wind_speed            → km/h
 *   wind_direction_cardinal → degrees
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

  const windKmh = parseFloat(row.wind_speed)  || 0;
  const gustKmh = parseFloat(row.wind_gust)   || 0;

  return {
    temp:       parseFloat(row.temperature)          ?? null,
    humidity:   parseFloat(row.rh)                   ?? null,
    mslp:       parseFloat(row.smlp)                 ?? null,
    windSpeedKn: windKmh / 1.852,
    windGustKn:  gustKmh > 0 ? gustKmh / 1.852 : null,
    windDir:    parseFloat(row.wind_direction_cardinal) ?? null,
    windDirCardinal: row.wind_direction              ?? null,
    dewPoint:   parseFloat(row.dew_point)            ?? null,
    distance:   parseFloat(row.distance)             ?? null, // km to nearest real station
    source:     'MeteoNetwork',
  };
}

/**
 * Fetch interpolated observed data for all provided stations in parallel.
 * Returns a map of stationId → observed data (or null on failure).
 *
 * @param {Array<{ id: string, lat: number, lon: number }>} stations
 */
export async function fetchMeteoNetworkAll(stations) {
  const results = await Promise.allSettled(
    stations.map(s => fetchInterpolated(s.lat, s.lon).then(d => ({ id: s.id, data: d })))
  );

  const map = {};
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      map[result.value.id] = result.value.data;
    }
  }
  return map;
}
