import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/bardolino': {
        target: 'https://stazioni5.soluzionimeteo.it',
        changeOrigin: true,
        rewrite: () => '/leganavalegarda/homepage/blocks/current/updater.php?interval=11',
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
