import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function stripLazyCSS() {
  return {
    name: 'strip-lazy-css',
    transformIndexHtml(html: string) {
      return html.replace(/<link[^>]*excalidraw[^>]*>/g, '');
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), stripLazyCSS()],
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
    target: 'es2020',
    sourcemap: mode === 'development',
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('livekit-client') || id.includes('@livekit/components-react')) return 'livekit';
          if (id.includes('@livekit/track-processors')) return 'blur-processor';
          if (id.includes('@excalidraw')) return 'excalidraw';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor';
          if (id.includes('node_modules/react/')) return 'vendor';
          if (id.includes('@tanstack/react-virtual')) return 'tanstack-virtual';
          if (id.includes('node_modules/date-fns')) return 'date-fns';
        },
      },
    },
  },
}));
