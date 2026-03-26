/**
 * ARPAV Veneto — real-time weather station data.
 *
 * Station: Peschiera del Garda - Dolci (codseqst 300005960)
 *   45.424°N, 10.687°E, 100m — south tip of Lake Garda
 *   Replaces unreliable MeteoNetwork VNT259 for this location.
 *
 * Response format (meteo_meteogrammi_tabella):
 *   data[] where each item has:
 *     tipo        — sensor type key (VVENTO10M, DVENTO10M, TARIA2M, PRESS, UMID2M)
 *     valore      — numeric string value
 *     dataora     — ISO datetime of reading (solar/local time, no timezone suffix)
 *     aggiornamento — ISO datetime of last update
 *     unitnm      — unit string (m/s, gradi, °C, hPa, %)
 *
 * Items are sorted oldest-first; we need the newest entry per sensor type.
 */

const MS_TO_KN = 1.94384;

function parseFmt(val) {
  if (val == null || val === '' || val === '>>') return null;
  // Remove thousands separator comma if present
  const v = parseFloat(String(val).replace(',', ''));
  return isNaN(v) ? null : v;
}

/**
 * Fetch current conditions from an ARPAV station.
 *
 * @param {number|string} codseqst  — ARPAV sequential station code
 * @param {string}        stationName — human-readable name for source field
 * @returns {Promise<{ time, windSpeedKn, windGustKn, windDir, temp, mslp, humidity, source }>}
 */
export async function fetchARPAV(codseqst, stationName = 'ARPAV') {
  const resp = await fetch(`/api/arpav?codseqst=${codseqst}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`ARPAV proxy HTTP ${resp.status} for codseqst ${codseqst}`);

  const json = await resp.json();
  const items = json?.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`ARPAV ${codseqst}: no data`);
  }

  // Group by tipo — keep the entry with the latest dataora per sensor
  const latest = {};
  for (const item of items) {
    const tipo = item.tipo;
    if (!tipo) continue;
    const prev = latest[tipo];
    if (!prev || item.dataora > prev.dataora) {
      latest[tipo] = item;
    }
  }

  // Wind speed: VVENTO10M in m/s → knots
  const windSpeedMs = parseFmt(latest['VVENTO10M']?.valore);
  const windDir     = parseFmt(latest['DVENTO10M']?.valore);
  const temp        = parseFmt(latest['TARIA2M']?.valore);
  const mslp        = parseFmt(latest['PRESS']?.valore);
  const humidity    = parseFmt(latest['UMID2M']?.valore);

  // Use the most recent timestamp across all sensors
  const timestamps = Object.values(latest)
    .map(e => e.dataora)
    .filter(Boolean)
    .sort();
  const latestTs = timestamps[timestamps.length - 1] ?? null;

  if (windSpeedMs === null) throw new Error(`ARPAV ${codseqst}: no wind reading`);

  return {
    time:        latestTs ? new Date(latestTs).toISOString() : new Date().toISOString(),
    windSpeedKn: windSpeedMs * MS_TO_KN,
    windGustKn:  null,  // ARPAV tabella doesn't expose max gust separately
    windDir,
    temp,
    mslp,
    humidity,
    source: stationName,
  };
}
