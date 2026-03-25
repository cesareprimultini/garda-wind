import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
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
