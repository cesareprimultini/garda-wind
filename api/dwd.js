/**
 * Vercel serverless proxy for DWD Open Data POI CSV station files.
 * opendata.dwd.de has no CORS headers — browser fetches are blocked.
 *
 * Usage: /api/dwd?station=16088
 */

const DWD_BASE = 'https://opendata.dwd.de/weather/weather_reports/poi';

export default async function handler(req, res) {
  const { station } = req.query;

  if (!station || !/^\d{5}$/.test(station)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }

  try {
    const resp = await fetch(`${DWD_BASE}/${station}-BEOB.csv`, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) throw new Error(`DWD upstream HTTP ${resp.status}`);

    const text = await resp.text();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
