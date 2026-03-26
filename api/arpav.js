/**
 * Vercel serverless proxy for ARPAV Veneto meteorological station data.
 * Free public API, no auth required.
 *
 * Source: Filippo Turetta, ARPAV — CC BY 3.0
 * Endpoint: meteo_meteogrammi_tabella?codseqst=XXX
 *   Returns hourly time-series for all sensors at the station.
 *   Sensor types we use:
 *     VVENTO10M — wind speed (m/s) at 10m
 *     DVENTO10M — wind direction (degrees) at 10m
 *     TARIA2M   — air temperature (°C) at 2m
 *     PRESS     — atmospheric pressure reduced to MSL (hPa)
 *     UMID2M    — relative humidity (%) at 2m
 *
 * Known stations (codseqst):
 *   300005960 — Peschiera del Garda - Dolci (45.424°N, 10.687°E, 100m)
 *
 * Usage: /api/arpav?codseqst=300005960
 */

const BASE = 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella';

export default async function handler(req, res) {
  const { codseqst } = req.query;

  if (!codseqst || !/^\d+$/.test(codseqst)) {
    return res.status(400).json({ error: 'Invalid or missing codseqst' });
  }

  try {
    const url = `${BASE}?codseqst=${codseqst}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GardaWind/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) throw new Error(`ARPAV upstream HTTP ${resp.status}`);

    const data = await resp.json();

    // 5-min cache — ARPAV updates roughly hourly
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
