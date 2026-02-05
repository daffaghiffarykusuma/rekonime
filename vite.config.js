import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    {
      name: 'strip-upgrade-insecure-requests',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(/upgrade-insecure-requests;?\s*/gi, '');
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        watchlist: resolve(__dirname, 'watchlist.html'),
        home: resolve(__dirname, 'home/index.html')
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          const rawName = assetInfo.name ? String(assetInfo.name) : '';
          const normalized = rawName.replace(/\\/g, '/');
          if (normalized.endsWith('.css')) {
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
