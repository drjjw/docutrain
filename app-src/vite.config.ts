import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/app/',
  // Use default public directory (app-src/public) for Vite dev server
  // Images are copied to app-src/public for development
  // In production, Express serves from /public/
  build: {
    outDir: '../dist/app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3458',
        changeOrigin: true,
        // Increase timeout and body size limits for large file uploads
        timeout: 600000, // 10 minutes
        proxyTimeout: 600000,
      },
      // Proxy public assets from Express server for images not in app-src/public
      '/chat-cover-place.png': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/robot-favicon.png': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
    },
    // Increase max HTTP header size for large multipart uploads
    hmr: {
      overlay: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

