/**
 * Lega Navale Garda — Bardolino (45.5775°N, 10.7017°E)
 * Davis Vantage Pro2 hardware, Meteotemplate 19.0 platform.
 * Directly on the lake at the southern end. Updates every ~30 seconds.
 *
 * Accessed via Vercel proxy /api/bardolino (CORS workaround).
 * In local dev, Vite proxies /api/bardolino → upstream directly.
 *
 * Field reference:
 *   T         → temperature (°C)
 *   H         → relative humidity (%)
 *   P         → mean sea level pressure (hPa)  ← real observed lake-level pressure
 *   W         → wind speed (km/h)
 *   G         → wind gust (km/h)
 *   D         → wind direction (°)
 *   R         → rain rate (mm/h)
 *   DateTime  → Unix timestamp (seconds)
 *   offline   → 0 = live, 1 = station down
 */

export async function fetchLegaNavaleGarda() {
  const resp = await fetch('/api/bardolino', { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Bardolino proxy HTTP ${resp.status}`);

  const d = await resp.json();
  if (d.error) throw new Error(`Bardolino upstream: ${d.error}`);
  if (d.offline === 1) throw new Error('Lega Navale station offline');

  const windKmh = parseFloat(d.W) || 0;
  const gustKmh = parseFloat(d.G) || 0;

  return {
    time:       new Date(d.DateTime * 1000).toISOString(),
    temp:       parseFloat(d.T),
    humidity:   parseFloat(d.H),
    mslp:       parseFloat(d.P),         // hPa — real observed lake pressure
    windSpeedKn: windKmh / 1.852,        // km/h → knots
    windGustKn:  gustKmh / 1.852,
    windDir:    parseFloat(d.D),
    rainRate:   parseFloat(d.R) || 0,
    source:     'Lega Navale Garda',
  };
}
