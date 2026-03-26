/**
 * MeteoProject — Fraglia Vela Malcesine station (Davis Vantage Pro2)
 * http://stazioni.meteoproject.it/dati/malcesine/
 *
 * Accessed via Vercel proxy /api/malcesine (CORS workaround).
 * In local dev, Vite proxies /api/malcesine → upstream directly.
 *
 * Pipe-delimited field positions (0-indexed):
 *   0   time HH.MM
 *   1   date DD/MM/YY
 *   2   temperature °C
 *   3   humidity %
 *   5   wind speed km/h (instantaneous)
 *   6   wind gust km/h
 *   7   pressure hPa
 *   44  wind speed km/h (averaged — matches website display)
 *   45  wind direction text ("N", "NE", "SSW" …)
 *   46  wind gust km/h (averaged)
 */

const CARDINAL_DEG = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function cardinalToDeg(str) {
  if (!str) return null;
  const upper = str.trim().toUpperCase();
  return CARDINAL_DEG[upper] ?? null;
}

export async function fetchMalcesineObs() {
  const resp = await fetch('/api/malcesine', { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Malcesine proxy HTTP ${resp.status}`);

  const text = await resp.text();
  if (!text || !text.includes('|')) throw new Error('Malcesine: empty or invalid response');

  const fields = text.split('|');

  const windKmh  = parseFloat(fields[44]) || 0;
  const gustKmh  = parseFloat(fields[46]) || 0;
  const dirText  = fields[45]?.trim() ?? null;

  return {
    time:        fields[0] ? `${fields[1]?.trim()} ${fields[0]?.trim()}` : new Date().toISOString(),
    temp:        parseFloat(fields[2])  || null,
    humidity:    parseFloat(fields[3])  || null,
    mslp:        parseFloat(fields[7])  || null,
    windSpeedKn: windKmh / 1.852,
    windGustKn:  gustKmh > 0 ? gustKmh / 1.852 : null,
    windDir:     cardinalToDeg(dirText),
    windDirCardinal: dirText,
    source:      'Fraglia Vela Malcesine',
  };
}
