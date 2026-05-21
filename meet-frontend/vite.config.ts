import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    allowedHosts: [
      'meet.livekit.phuket-tourist.com',
      'localhost',
      '.phuket-tourist.com',
    ],
    proxy: {
      '/api/': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('livekit-client') || id.includes('@livekit/components-react')) return 'livekit';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor';
          if (id.includes('node_modules/react/')) return 'vendor';
        },
      },
    },
  },
}));
