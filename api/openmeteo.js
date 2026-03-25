/**
 * Vercel proxy for api.open-meteo.com with 10-min edge cache.
 * Shared across all users — upstream called at most once per 10 min per unique query.
 *
 * Usage: /api/openmeteo?_path=v1/forecast&lat=...&hourly=...
 *        /api/openmeteo?_path=v1/meteofrance&...
 */

export default async function handler(req, res) {
  const { _path = 'v1/forecast', ...rest } = req.query;

  const params = new URLSearchParams(rest);
  const url = `https://api.open-meteo.com/${_path}?${params.toString()}`;

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
