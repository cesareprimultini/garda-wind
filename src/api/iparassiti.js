/**
 * iparassiti.com — Davis Vantage Pro2 stations at Torbole and Malcesine.
 * WeeWX Belchertown skin JSON format, no auth required.
 *
 * Torbole   (45.878°N, 10.891°E, 73m)  — 2-min update interval
 * Malcesine (45.764°N, 10.810°E, 35m)  — 5-min update interval
 *             (Fraglia Vela hardware — same physical station as MeteoProject endpoint)
 *
 * WeeWX JSON structure (current.* fields):
 *   windSpeed.raw   — m/s instantaneous
 *   windGust.raw    — m/s gust
 *   windDir.raw     — degrees
 *   outTemp.raw     — °C
 *   barometer.raw   — hPa
 *   outHumidity.raw — %
 *   dateTime.raw    — Unix timestamp (seconds)
 *
 * Wind unit: WeeWX defaults to m/s internally; .unit field may say "m/s" or "km/h".
 * We convert to knots (× 1.944 for m/s, ÷ 1.852 for km/h).
 */

const MS_TO_KN  = 1.94384;
const KMH_TO_KN = 1 / 1.852;

function getRaw(field) {
  if (field == null) return null;
  const v = typeof field === 'object' ? field.raw : field;
  return v != null ? parseFloat(v) : null;
}

function getUnit(field) {
  if (field == null) return null;
  return typeof field === 'object' ? (field.unit ?? null) : null;
}

function toKnots(value, unit) {
  if (value == null || isNaN(value)) return null;
  if (unit === 'km/h' || unit === 'kph') return value * KMH_TO_KN;
  // default: assume m/s
  return value * MS_TO_KN;
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

  const rawSpeed = getRaw(curr.windSpeed);
  const rawGust  = getRaw(curr.windGust);
  const speedUnit = getUnit(curr.windSpeed);

  const ts = getRaw(curr.dateTime);

  return {
    time:        ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
    windSpeedKn: toKnots(rawSpeed, speedUnit),
    windGustKn:  toKnots(rawGust,  speedUnit),
    windDir:     getRaw(curr.windDir),
    temp:        getRaw(curr.outTemp),
    mslp:        getRaw(curr.barometer),
    humidity:    getRaw(curr.outHumidity),
    source:      `iparassiti ${loc}`,
  };
}
