/**
 * Vercel serverless proxy for Meteotrentino datiRealtimeUnaStazione.
 * Free, no auth, returns GeoJSON FeatureCollection with 5-min observations.
 *
 * Usage: /api/meteotrentino?stazione=T0193&h=6
 *   stazione: T0193 (Torbole Belvedere) | T0298 (Riva del Garda)
 *   h: hours of history, max 168 (default 6)
 *
 * Key fields per feature:
 *   vvmed (m/s) — avg wind speed
 *   vvmax (m/s) — max wind / gust
 *   dvmed (°)   — wind direction
 *   ta    (°C)  — air temperature
 *   press (hPa) — MSLP
 *   datetime    — ISO 8601 local time
 */

const BASE = 'https://dati.meteotrentino.it/service.asmx/datiRealtimeUnaStazione';

export default async function handler(req, res) {
  const { stazione = 'T0193', h = '6' } = req.query;

  // Validate station ID (alphanumeric, max 6 chars)
  if (!/^[A-Z0-9]{4,6}$/.test(stazione)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }

  const hNum = Math.min(parseInt(h, 10) || 6, 168);
  const url = `${BASE}?stazione=${encodeURIComponent(stazione)}&h=${hNum}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'GardaWind/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) throw new Error(`Meteotrentino upstream HTTP ${resp.status}`);

    const data = await resp.json();

    // 2-min cache — station updates every 5 min, but we want fresh data fast
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
