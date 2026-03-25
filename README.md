# GardaWind ⚓

Wind & weather dashboard for kitesurfers on Lake Garda, Italy.

## Features

- **ΔP Pressure Differential** — Bolzano−Ghedi pressure gradient, the key predictor for Lake Garda wind
- **6 stations** — Torbole, Riva del Garda, Malcesine, Campione, Bardolino, Peschiera
- **3 forecast models** — AROME 1.3km (MeteoFrance), ICON D2 2km (DWD), Best Match
- **Wind regime detection** — Pelér (N→S) and Ora (S→N) with strength estimates
- **Gear recommendations** — kite size and windsurf sail size
- **7-day outlook** with day cards showing max wind, regime, ΔP range
- **Interactive map** — all stations with live wind markers
- **Smart caching** — 10-min background refresh, offline fallback to cache
- **Dark nautical UI** — non-scrollable panel layout, monospace numbers

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS 3
- Recharts (charts)
- react-leaflet + leaflet (map)
- Open-Meteo API (free, no key required)

## Data Sources

- **Weather**: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
  - Primary: MeteoFrance AROME 1.3km
  - Fallback: DWD ICON D2 2km → Best Match
- **Pressure nodes**: Bolzano (46.4983°N, 11.3548°E) and Ghedi (45.4083°N, 10.2671°E)
- **ΔP methodology**: profiwetter.ch
- **Meteograms**: Meteotrentino

## Meteorology

`ΔP = P(Bolzano) − P(Ghedi)`

| ΔP | Regime | Estimated Wind |
|---|---|---|
| < −3 hPa | Pelér (N→S) | ~20 kn |
| −1.5 to −3 | Pelér building | 10–20 kn |
| −1.5 to +1.5 | Variable/Transitional | — |
| +1.5 to +2 | Ora developing | 8–14 kn |
| > +2 hPa | Good Ora (S→N) | 14+ kn |

## Project Structure

```
src/
  api/           — OpenMeteo fetch + cache + transform
  components/
    cards/       — Hero, ΔP, Kite, Stat cards
    charts/      — Wind, ΔP, Dual pressure charts
    forecast/    — Hourly timeline, Day outlook grid
    layout/      — Header, BottomNav
    shared/      — Compass, RefreshIndicator, Skeleton
  hooks/         — useWeatherData, useRefreshCycle
  utils/         — constants, windPhysics, formatters
  views/         — Dashboard, MapPanel, ForecastPanel
```
