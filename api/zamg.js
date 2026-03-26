/**
 * Vercel proxy for GeoSphere Austria TAWES API (Innsbruck station).
 * Caches 10 minutes on Vercel edge — shared globally across all users.
 */

const TAWES_BASE = 'https://dataset.api.hub.geosphere.at/v1/station/current/tawes-v1-10min';

export default async function handler(req, res) {
  const { station_ids = '11320', parameters = 'PRED,P,FF,DD,FFX,TL' } = req.query;

  const url = `${TAWES_BASE}?station_ids=${encodeURIComponent(station_ids)}&parameters=${encodeURIComponent(parameters)}`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) throw new Error(`ZAMG TAWES HTTP ${resp.status}`);

    const data = await resp.json();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
