/**
 * Vercel proxy for MeteoProject — Fraglia Vela Malcesine station.
 * Upstream: http://stazioni.meteoproject.it/dati/rapidjson.php?loc=malcesine
 * Format: pipe-delimited text, updates every ~5 minutes.
 *
 * Cache: s-maxage=120 (2 min) — slightly below station update interval.
 * Vercel CDN coalesces simultaneous requests; all users share one cached copy.
 */
export default async function handler(req, res) {
  const url = 'http://stazioni.meteoproject.it/dati/rapidjson.php?loc=malcesine';

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream HTTP ${upstream.status}` });
    }

    const text = await upstream.text();
    if (!text || !text.includes('|')) {
      return res.status(502).json({ error: 'Invalid upstream response' });
    }

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Upstream timeout' });
    }
    return res.status(502).json({ error: err.message });
  }
}
