import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetVersion = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 12);

export default defineConfig({
  plugins: [
    {
      name: 'development-runtime',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          request.url = request.url?.replace(/^\/data\/anime\.full\.index\.json(?=\?|$)/, '/data/anime.full.json');
          next();
        });
      },
      transformIndexHtml(html) {
        return html.replace(/upgrade-insecure-requests;?\s*/gi, '');
      }
    }
  ],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        watchlist: resolve(__dirname, 'watchlist.html')
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          const rawName = assetInfo.name ? String(assetInfo.name) : '';
          const normalized = rawName.replace(/\\/g, '/');
          if (normalized.endsWith('.css')) {
            if (normalized.endsWith('main.css')) {
              return `css/[name]-${assetVersion}[extname]`;
            }
            return 'css/[name][extname]';
          }
          if (normalized.endsWith('favicon.svg')) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  }
});
