import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin to serve static landing page at root
function landingPagePlugin() {
  return {
    name: 'landing-page-plugin',
    enforce: 'pre', // Run before other plugins
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Skip /app/* routes - let Vite handle those
        if (req.url?.startsWith('/app/')) {
          next();
          return;
        }

        // Strip query strings and hash from URL
        const urlPath = req.url?.split('?')[0].split('#')[0] || req.url || '/';

        // Skip routes that are handled by proxy (let proxy handle them)
        if (urlPath.startsWith('/css/') || 
            urlPath.startsWith('/js/') || 
            urlPath.startsWith('/logos/') ||
            urlPath === '/docutrain-logo.svg' ||
            urlPath === '/docutrain-logo.png' ||
            urlPath === '/docutrain-icon.png' ||
            urlPath === '/chat-cover-place.jpeg' ||
            urlPath === '/chat-cover-place.png' ||
            urlPath === '/robot-favicon.png') {
          next();
          return;
        }

        // Debug logging
        if (urlPath !== '/' && !urlPath.startsWith('/app/')) {
          console.log(`[Landing Plugin] Request: ${urlPath}`);
        }

        // Serve static landing page at root
        if (urlPath === '/' || urlPath === '/index.html') {
          const landingPagePath = path.resolve(__dirname, '../public/index.html');
          console.log(`[Landing Plugin] Serving landing page from: ${landingPagePath}`);
          if (fs.existsSync(landingPagePath)) {
            const html = fs.readFileSync(landingPagePath, 'utf-8');
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
            return;
          } else {
            console.error(`[Landing Plugin] Landing page not found at: ${landingPagePath}`);
          }
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [landingPagePlugin(), react()],
  root: '.',
  base: '/app/',
  // Read .env files from parent directory (project root) instead of app-src/
  envDir: '../',
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
      // Proxy all static assets from public directory to Express server
      '/css': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/js': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/logos': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      // Proxy public assets from Express server for images not in app-src/public
      '/chat-cover-place.jpeg': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/chat-cover-place.png': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/robot-favicon.png': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      // Proxy root-level images and assets
      '/docutrain-logo.svg': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/docutrain-logo.png': {
        target: 'http://localhost:3458',
        changeOrigin: true,
      },
      '/docutrain-icon.png': {
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

