/**
 * Vercel serverless proxy for Lega Navale Garda station (Bardolino).
 * Proxies https://stazioni5.soluzionimeteo.it/leganavalegarda/... to avoid CORS.
 * Free tier: 100k invocations/day — no billing risk.
 */

const UPSTREAM =
  'https://stazioni5.soluzionimeteo.it/leganavalegarda/homepage/blocks/current/updater.php?interval=11';

export default async function handler(req, res) {
  try {
    const resp = await fetch(UPSTREAM, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`Upstream HTTP ${resp.status}`);

    const data = await resp.json();

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
