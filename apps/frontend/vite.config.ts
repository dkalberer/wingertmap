import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'mui': ['@mui/material', '@mui/icons-material'],
          'maplibre': ['maplibre-gl', 'react-map-gl/maplibre', 'maplibre-gl-draw'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
  },
})
