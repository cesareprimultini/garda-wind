/**
 * iparassiti.com — Davis Vantage Pro2 stations at Torbole and Malcesine.
 * WeeWX Belchertown v5 skin JSON, no auth required.
 *
 * Torbole   (45.878°N, 10.891°E, 73m)  — archive_interval ~2 min
 * Malcesine (45.764°N, 10.810°E, 35m)  — archive_interval ~5 min
 *             (Fraglia Vela hardware — same physical station as MeteoProject endpoint)
 *
 * Actual current block fields (confirmed from live API):
 *   epoch              — Unix timestamp seconds (string)
 *   windspeed          — "4.5 m/s" (string with unit, always m/s)
 *   windGust_formatted — "13.4" (numeric string, m/s)
 *   winddir_formatted  — "0" (numeric string, degrees)
 *   barometer_formatted — "996.0" (numeric string, hPa)
 *   outTemp_formatted  — "13.0" (numeric string, °C)
 *   outHumidity        — "26%" (string with %, need to strip)
 */

const MS_TO_KN = 1.94384;

/** Parse "4.5 m/s" → 4.5 */
function parseValueStr(str) {
  if (!str || typeof str !== 'string') return null;
  const v = parseFloat(str);
  return isNaN(v) ? null : v;
}

/** Parse numeric-only formatted field */
function parseFmt(val) {
  if (val == null) return null;
  const v = parseFloat(val);
  return isNaN(v) ? null : v;
}

/**
 * Fetch current conditions from an iparassiti.com station.
 *
 * @param {'torbole'|'malcesine'} loc
 * @returns {Promise<{ time, windSpeedKn, windGustKn, windDir, temp, mslp, humidity, source }>}
 */
export async function fetchIparassiti(loc) {
  const resp = await fetch(`/api/iparassiti?loc=${loc}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`iparassiti proxy HTTP ${resp.status} for ${loc}`);

  const json = await resp.json();
  const curr = json?.current;
  if (!curr) throw new Error(`iparassiti ${loc}: missing current block`);

  const epoch = parseFmt(curr.epoch ?? curr.datetime_raw);
  const windSpeedMs = parseValueStr(curr.windspeed);     // "4.5 m/s"
  const windGustMs  = parseFmt(curr.windGust_formatted); // "13.4"
  const windDir     = parseFmt(curr.winddir_formatted);  // "0"
  const mslp        = parseFmt(curr.barometer_formatted);
  const temp        = parseFmt(curr.outTemp_formatted);
  // "26%" → strip % and parse
  const humStr      = typeof curr.outHumidity === 'string' ? curr.outHumidity.replace('%', '') : curr.outHumidity;
  const humidity    = parseFmt(humStr);

  return {
    time:        epoch ? new Date(epoch * 1000).toISOString() : new Date().toISOString(),
    windSpeedKn: windSpeedMs !== null ? windSpeedMs * MS_TO_KN : null,
    windGustKn:  windGustMs  !== null ? windGustMs  * MS_TO_KN : null,
    windDir,
    temp,
    mslp,
    humidity,
    source: `iparassiti ${loc}`,
  };
}
