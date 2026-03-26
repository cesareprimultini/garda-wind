import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/openmeteo': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url, 'http://localhost');
            const p = url.searchParams.get('_path') || 'v1/forecast';
            url.searchParams.delete('_path');
            proxyReq.path = `/${p}?${url.searchParams.toString()}`;
          });
        },
      },
      '/api/ensemble': {
        target: 'https://ensemble-api.open-meteo.com',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const url = new URL(req.url, 'http://localhost');
            const p = url.searchParams.get('_path') || 'v1/ensemble';
            url.searchParams.delete('_path');
            proxyReq.path = `/${p}?${url.searchParams.toString()}`;
          });
        },
      },
      '/api/zamg': {
        target: 'https://dataset.api.hub.geosphere.at',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/zamg', '/v1/station/current/tawes-v1-10min'),
      },
      '/api/dwd': {
        target: 'https://opendata.dwd.de',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const station = url.searchParams.get('station');
          return `/weather/weather_reports/poi/${station}-BEOB.csv`;
        },
      },
      '/api/bardolino': {
        target: 'https://stazioni5.soluzionimeteo.it',
        changeOrigin: true,
        rewrite: () => '/leganavalegarda/homepage/blocks/current/updater.php?interval=11',
      },
      '/api/malcesine': {
        target: 'http://stazioni.meteoproject.it',
        changeOrigin: true,
        rewrite: () => '/dati/rapidjson.php?loc=malcesine',
      },
      '/api/meteotrentino': {
        target: 'https://dati.meteotrentino.it',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const stazione = url.searchParams.get('stazione') || 'T0193';
          const h = url.searchParams.get('h') || '6';
          return `/service.asmx/datiRealtimeUnaStazione?stazione=${stazione}&h=${h}`;
        },
      },
      '/api/iparassiti': {
        target: 'https://www.iparassiti.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const loc = url.searchParams.get('loc') || 'torbole';
          return `/ane/${loc}/json/weewx_data.json`;
        },
      },
      '/api/meteonetwork': {
        target: 'https://api.meteonetwork.it',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const { lat, lon, station } = Object.fromEntries(url.searchParams);
          if (station) return `/v3/data-realtime/${station}`;
          return `/v3/interpolated-realtime?lat=${lat}&lon=${lon}`;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = process.env.METEONETWORK_TOKEN || '';
            if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`);
            proxyReq.setHeader('User-Agent', 'GardaWind/1.0');
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'map': ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
