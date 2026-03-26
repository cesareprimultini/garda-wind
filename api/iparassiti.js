/**
 * Vercel proxy for iparassiti.com WeeWX weather station JSON.
 * Two Davis Vantage Pro2 stations, no auth required.
 *
 *   torbole   — 45.878°N 10.891°E, alt 73m  — updates every 2 min
 *   malcesine — 45.764°N 10.810°E, alt 35m  — updates every 5 min
 *               (Fraglia Vela, same hardware as MeteoProject endpoint)
 *
 * Usage: /api/iparassiti?loc=torbole | /api/iparassiti?loc=malcesine
 */

const URLS = {
  torbole:   'https://www.iparassiti.com/ane/torbole/json/weewx_data.json',
  malcesine: 'https://www.iparassiti.com/ane/malcesine/json/weewx_data.json',
};

export default async function handler(req, res) {
  const { loc } = req.query;
  const url = URLS[loc];

  if (!url) {
    return res.status(400).json({ error: 'Unknown loc — use torbole or malcesine' });
  }

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'GardaWind/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`iparassiti upstream HTTP ${resp.status}`);

    const data = await resp.json();

    // torbole updates every 2 min, malcesine every 5 min
    const maxAge = loc === 'torbole' ? 60 : 120;
    res.setHeader('Cache-Control', `s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
