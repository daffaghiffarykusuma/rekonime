import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8');
const pages = ['index.html', 'watchlist.html', 'health.html'];
const stylesheets = fs.readdirSync(path.join(rootDir, 'src/styles'))
  .filter(name => name.endsWith('.css'))
  .map(name => `src/styles/${name}`);

test('every page declares the single dark colour scheme before CSS loads', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<meta name="color-scheme" content="dark"\s*\/?>/, `${page} needs a dark color-scheme meta`);
    assert.match(html, /<meta name="theme-color" content="#08080a"\s*\/?>/, `${page} needs the black theme-color`);
    assert.equal(/data-theme=/.test(html), false, `${page} must not carry a theme attribute`);
  }
});

test('stylesheets carry no light or switchable theme rules', () => {
  for (const sheet of stylesheets) {
    const css = read(sheet);
    assert.equal(/data-theme/.test(css), false, `${sheet} must not style a theme attribute`);
    assert.equal(/prefers-color-scheme:\s*light/.test(css), false, `${sheet} must not adapt to a light OS theme`);
  }
  assert.match(read('src/styles/core-ui.css'), /:root \{[^}]*color-scheme: dark;/);
});

test('app code no longer reads or writes a theme preference', () => {
  const sources = ['src/app/main.ts', 'src/app/watchlist-main.ts', 'src/app/app.ts', 'src/app/home-action-commands.ts'];
  for (const source of sources) {
    assert.equal(/ThemeManager|rekonime\.theme|set-theme/.test(read(source)), false, `${source} still references theme switching`);
  }
});
