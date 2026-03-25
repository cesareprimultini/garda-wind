/**
 * Vercel serverless proxy for MeteoNetwork API.
 * Keeps METEONETWORK_TOKEN server-side — never exposed to the browser.
 *
 * Usage:
 *   /api/meteonetwork?lat=45.87&lon=10.87          → interpolated realtime at coords
 *   /api/meteonetwork?station=abc123               → single station realtime data
 *
 * Set METEONETWORK_TOKEN in Vercel environment variables (no VITE_ prefix).
 */

const BASE = 'https://api.meteonetwork.it/v3';

export default async function handler(req, res) {
  const token = process.env.METEONETWORK_TOKEN;

  if (!token) {
    return res.status(503).json({ error: 'MeteoNetwork token not configured' });
  }

  const { station, lat, lon } = req.query;

  let url;
  if (station) {
    url = `${BASE}/data-realtime/${encodeURIComponent(station)}`;
  } else if (lat && lon) {
    url = `${BASE}/interpolated-realtime?lat=${lat}&lon=${lon}`;
  } else {
    return res.status(400).json({ error: 'Provide station= or lat= and lon=' });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'GardaWind/1.0 (wind sports dashboard for Lake Garda)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.status === 204) return res.status(204).end();
    // 401 = bad token, 429 = rate limited — return 503 so client skips gracefully
    if (resp.status === 401 || resp.status === 429) {
      return res.status(503).json({ error: `MeteoNetwork ${resp.status}` });
    }
    if (!resp.ok) throw new Error(`MeteoNetwork HTTP ${resp.status}`);

    const data = await resp.json();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    // Return 503 (not 502) so client treats it as "unavailable, skip gracefully"
    res.status(503).json({ error: err.message });
  }
}
