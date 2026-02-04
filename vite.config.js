import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const stripBlockingStylesheets = () => {
  const noscriptRegex = /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi;
  const stylesheetRegex = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;

  const transformSegment = (segment) => {
    return segment.replace(stylesheetRegex, (match) => {
      if (/data-async-style/i.test(match)) return match;
      if (/fonts\.googleapis\.com/i.test(match)) return match;
      return '';
    });
  };

  return {
    name: 'strip-blocking-stylesheets',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      let output = '';
      let lastIndex = 0;
      let match;

      while ((match = noscriptRegex.exec(html))) {
        output += transformSegment(html.slice(lastIndex, match.index));
        output += match[0];
        lastIndex = match.index + match[0].length;
      }

      output += transformSegment(html.slice(lastIndex));
      return output;
    }
  };
};

export default defineConfig({
  plugins: [
    {
      name: 'strip-upgrade-insecure-requests',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(/upgrade-insecure-requests;?\s*/gi, '');
      }
    },
    stripBlockingStylesheets()
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bookmarks: resolve(__dirname, 'bookmarks.html'),
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
