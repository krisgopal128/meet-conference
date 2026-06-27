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
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_filename: string, deps: string[]) => {
        return deps.filter((dep) => !dep.includes('excalidraw') && !dep.includes('blur-processor') && !dep.includes('cytoscape') && !dep.includes('katex'));
      },
    },
    rollupOptions: {
      output: {
        // Let Rolldown handle code splitting automatically.
        // WhiteboardLayout already uses dynamic import('@excalidraw/excalidraw'),
        // so excalidraw will be split into its own lazy-loaded chunk.
        advancedChunks: {
          groups: [
            { name: 'vendor', test: /node_modules\/(react|react-dom|scheduler|react-router|@radix-ui|clsx|tailwind-merge)\// },
            { name: 'livekit', test: /node_modules\/(livekit-client|@livekit)\// },
            { name: 'icons', test: /node_modules\/lucide-react\// },
          ],
        },
      },
    },
  },
}));
