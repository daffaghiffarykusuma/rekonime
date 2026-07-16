import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');

const extractStylesheets = (html) => [...html.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*>/g)]
  .map(match => match[0]);

const assertBlockingStylesheet = (links, href) => {
  const link = links.find(item => item.includes(`href="${href}"`));
  assert.ok(link, `Expected stylesheet ${href}`);
  assert.equal(link.includes('media="print"'), false, `${href} must not load as print media`);
  assert.equal(link.includes('data-noncritical'), false, `${href} must not be marked noncritical`);
};

test('HTML entrypoints load app CSS before first paint', () => {
  const indexLinks = extractStylesheets(read('index.html'));
  const watchlistLinks = extractStylesheets(read('watchlist.html'));

  assertBlockingStylesheet(indexLinks, '/css/fonts.css');
  assertBlockingStylesheet(indexLinks, '/css/styles.css');
  assertBlockingStylesheet(indexLinks, '/css/mal-watchlist-import.css');
  assertBlockingStylesheet(indexLinks, '/css/themes.css');
  assertBlockingStylesheet(watchlistLinks, '/css/fonts.css');
  assertBlockingStylesheet(watchlistLinks, '/css/watchlist.css');
  assertBlockingStylesheet(watchlistLinks, '/css/mal-watchlist-import.css');
  assertBlockingStylesheet(watchlistLinks, '/css/themes.css');
});

test('HTML entrypoints preload local self-hosted fonts', () => {
  const allHtml = `${read('index.html')}\n${read('watchlist.html')}`;

  assert.match(allHtml, /href="\/fonts\/fraunces-latin-variable\.woff2" as="font" type="font\/woff2"/);
  assert.match(allHtml, /href="\/fonts\/nunito-sans-latin-variable\.woff2" as="font" type="font\/woff2"/);
});

test('font loading does not depend on Google Fonts or delayed markers', () => {
  const files = [
    'index.html',
    'watchlist.html',
    'health.html',
    'vercel.json',
    'tools/copy-static.js',
    'css/fonts.css',
    'css/styles.css',
    'css/watchlist.css',
    'js/main.ts',
    'js/watchlist-main.ts'
  ];
  const combined = files.map(read).join('\n');

  assert.equal(combined.includes('fonts.googleapis.com'), false);
  assert.equal(combined.includes('fonts.gstatic.com'), false);
  assert.equal(combined.includes('data-fonts-ready'), false);
  assert.equal(combined.includes('noncritical-styles'), false);
});
