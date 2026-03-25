/**
 * DWD Open Data — POI station CSV parser
 * https://opendata.dwd.de/weather/weather_reports/poi/{STATION_ID}-BEOB.csv
 *
 * Format: semicolon-delimited, 3 header rows, data newest-first.
 * Decimal separator: European comma (1014,1 → 1014.1).
 * Missing values encoded as "---".
 *
 * Stations used:
 *   16088 — Brescia/Ghedi (45.42°N 10.28°E) — southern ΔP anchor
 *   11120 — Innsbruck airport (47.26°N 11.34°E) — northern gradient node
 */

// Route through /api/dwd proxy to avoid CORS — DWD has no Access-Control-Allow-Origin header
const DWD_POI_BASE = '/api/dwd?station=';

// Column indices (0-based, semicolon-delimited)
const COL_DATE     = 0;
const COL_TIME_UTC = 1;
const COL_TEMP     = 9;
const COL_MSLP     = 35;
const COL_WIND_DIR = 22;
const COL_WIND_SPD = 23;  // km/h

function parseDwdValue(raw) {
  if (!raw || raw.trim() === '---') return null;
  return parseFloat(raw.trim().replace(',', '.'));
}

/**
 * Parse the DWD POI CSV text into an array of observation objects (newest first).
 * @param {string} text
 * @returns {Array<{ time: string, mslp: number|null, temp: number|null, windDir: number|null, windSpeedKmh: number|null }>}
 */
function parseDwdCsv(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const dataLines = lines.slice(3); // skip 3 header rows

  return dataLines.map(line => {
    const cols = line.split(';');
    const dateStr = cols[COL_DATE]?.trim();   // DD.MM.YY
    const timeStr = cols[COL_TIME_UTC]?.trim(); // HH:MM

    let time = null;
    if (dateStr && timeStr) {
      // Convert DD.MM.YY HH:MM UTC → ISO string
      const [day, mon, yr] = dateStr.split('.');
      time = `20${yr}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}T${timeStr}:00Z`;
    }

    return {
      time,
      mslp:        parseDwdValue(cols[COL_MSLP]),
      temp:        parseDwdValue(cols[COL_TEMP]),
      windDir:     parseDwdValue(cols[COL_WIND_DIR]),
      windSpeedKmh: parseDwdValue(cols[COL_WIND_SPD]),
    };
  }).filter(r => r.time !== null);
}

/**
 * Fetch the most recent observation from a DWD POI CSV station.
 * Returns only the latest row with a valid MSLP reading.
 * @param {string} stationId - e.g. '16088'
 * @returns {Promise<{ time: string, mslp: number, temp: number|null, windDir: number|null, windSpeedKmh: number|null } | null>}
 */
export async function fetchDWDObserved(stationId) {
  const url = `${DWD_POI_BASE}${stationId}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`DWD POI HTTP ${resp.status} for station ${stationId}`);

  const text = await resp.text();
  const rows = parseDwdCsv(text);

  // Find most recent row with a valid MSLP
  const latest = rows.find(r => r.mslp !== null);
  return latest ?? null;
}

export const DWD_STATIONS = {
  ghedi:     '16088',   // Brescia/Ghedi — southern ΔP anchor
  innsbruck: '11120',   // Innsbruck airport — northern gradient
};
