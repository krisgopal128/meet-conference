import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    https: fs.existsSync('/tmp/cert.pem') ? {
      key: fs.readFileSync('/tmp/key.pem'),
      cert: fs.readFileSync('/tmp/cert.pem'),
    } : undefined,
    allowedHosts: [
      'meet.livekit.phuket-tourist.com',
      'localhost',
      '.phuket-tourist.com',
      '192.168.0.207',
    ],
    proxy: {
      '/api/': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/livekit': {
        target: 'http://localhost:7880',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/livekit/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    // Target modern browsers — fewer polyfills, smaller output
    target: 'es2020',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // LiveKit core — large but needed for room
          if (id.includes('livekit-client') || id.includes('@livekit/components-react')) return 'livekit';
          // Track processors + TensorFlow.js — only loaded when blur is toggled
          if (id.includes('@livekit/track-processors')) return 'blur-processor';
          // Excalidraw — 2MB+, only loaded when whiteboard is opened
          if (id.includes('@excalidraw')) return 'excalidraw';
          // React core + router — stable, caches well
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor';
          if (id.includes('node_modules/react/')) return 'vendor';
          // Virtual list — moderate size, used in participant grid
          if (id.includes('@tanstack/react-virtual')) return 'tanstack-virtual';
          // Date utilities — shared across multiple pages
          if (id.includes('node_modules/date-fns')) return 'date-fns';
        },
      },
    },
  },
}));
