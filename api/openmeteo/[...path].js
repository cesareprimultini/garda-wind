/**
 * Transparent proxy for api.open-meteo.com with 10-min Vercel edge cache.
 * All users share the cached response — upstream called at most once per 10 min
 * per unique query, regardless of how many clients are hitting the app.
 *
 * Usage: /api/openmeteo/v1/forecast?lat=...&hourly=...
 *        /api/openmeteo/v1/meteofrance?...
 */

export default async function handler(req, res) {
  const segments = req.query.path;
  const pathStr = Array.isArray(segments) ? segments.join('/') : (segments || '');

  const params = new URLSearchParams(req.query);
  params.delete('path');

  const url = `https://api.open-meteo.com/${pathStr}?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`OpenMeteo HTTP ${resp.status}`);

    const data = await resp.json();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
