/**
 * Vercel proxy for ensemble-api.open-meteo.com with 10-min edge cache.
 *
 * Usage: /api/ensemble?_path=v1/ensemble&lat=...&hourly=...
 */

export default async function handler(req, res) {
  const { _path = 'v1/ensemble', ...rest } = req.query;

  const params = new URLSearchParams(rest);
  const url = `https://ensemble-api.open-meteo.com/${_path}?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`Ensemble HTTP ${resp.status}`);

    const data = await resp.json();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
