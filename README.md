# GardaWind

Wind & weather dashboard for kitesurfers, windsurfers and wing-foilers on Lake Garda, Italy.

**Live:** https://garda-wind.vercel.app

## Features

- **ΔP Pressure Differential** — Bolzano−Ghedi pressure gradient, the key predictor for Lake Garda wind
- **6 stations** — Torbole, Riva del Garda, Malcesine, Campione, Bardolino, Peschiera
- **3 forecast models** — AROME 1.3km (MeteoFrance), ICON D2 2km (DWD), Best Match
- **Wind regime detection** — Pelér (N→S) and Ora (S→N) with strength estimates
- **Gear recommendations** — kite size and windsurf sail size
- **7-day outlook** with day cards showing max wind, regime, ΔP range
- **Interactive map** — all stations with live wind markers
- **Smart caching** — 10-min background refresh, offline fallback
- **PWA** — installable on iOS and Android
- **Dark nautical UI** — full-screen panel layout, no page scroll

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
```

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS 3
- Recharts, react-leaflet
- Open-Meteo API (free, no key required)
- Vercel (hosting + analytics)

## Data Sources

- **Weather**: [Open-Meteo](https://open-meteo.com/) — AROME 1.3km primary, DWD ICON D2 fallback
- **Pressure nodes**: Bolzano (46.4983°N, 11.3548°E) and Ghedi (45.4083°N, 10.2671°E)
- **ΔP methodology**: profiwetter.ch
- **Meteograms**: Meteotrentino

## Meteorology

`ΔP = P(Bolzano) − P(Ghedi)`

| ΔP | Regime | Estimated Wind |
|---|---|---|
| < −3 hPa | Pelér (N→S) | ~20 kn |
| −1.5 to −3 | Pelér building | 10–20 kn |
| −1.5 to +1.5 | Variable | — |
| +1.5 to +2 | Ora developing | 8–14 kn |
| > +2 hPa | Ora (S→N) | 14+ kn |

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
