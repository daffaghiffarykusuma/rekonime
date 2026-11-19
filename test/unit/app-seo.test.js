import test from 'node:test';
import assert from 'node:assert/strict';
import { appSeoMethods } from '../../src/app/app-seo.ts';
import { setupDom } from '../helpers/dom.js';

const createSeoHost = (overrides = {}) => ({
  ...appSeoMethods,
  siteName: 'Rekonime',
  basePageUrl: 'https://rekonime.test/',
  defaultMeta: {
    title: 'Rekonime | Anime dashboard',
    description: 'Find anime worth finishing.',
    image: '/og.png',
    url: ''
  },
  buildCanonicalUrl: (value) => String(value || '').split('#')[0],
  resolveUrl: (value) => (value ? new URL(value, 'https://rekonime.test/').toString() : ''),
  buildUrlForAnime: (id) => `https://rekonime.test/?anime=${encodeURIComponent(id)}`,
  getBaseUrl: () => 'https://rekonime.test/',
  getCachedSynopsis: (key) => (key === 'cached' ? 'Cached synopsis' : ''),
  ...overrides
});

const meta = (selector) => document.querySelector(selector)?.getAttribute('content');

test('anime metadata fills title, social tags, canonical link, and structured data', () => {
  setupDom('<main></main>', { url: 'https://rekonime.test/?anime=show-1' });
  const host = createSeoHost();

  host.updateMetaForAnime({ id: 'show-1', title: 'Show 1', cover: 'https://cdn.test/show-1.jpg', synopsis: '<b>A  long</b>\n story.' });

  assert.equal(document.title, 'Show 1 | Rekonime');
  assert.equal(meta('meta[name="description"]'), 'A long story.');
  assert.equal(meta('meta[property="og:title"]'), 'Show 1 | Rekonime');
  assert.equal(meta('meta[property="og:image"]'), 'https://cdn.test/show-1.jpg');
  assert.equal(meta('meta[property="og:image:alt"]'), 'Show 1');
  assert.equal(meta('meta[name="twitter:card"]'), 'summary_large_image');
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://rekonime.test/?anime=show-1');

  const graph = JSON.parse(document.getElementById('structured-data').textContent)['@graph'];
  assert.equal(graph[0]['@type'], 'WebSite');
  assert.equal(graph[1].name, 'Show 1 | Rekonime');
  assert.equal(graph[1].primaryImageOfPage.url, 'https://cdn.test/show-1.jpg');
});

test('resetting metadata restores the site defaults and reuses existing tags', () => {
  setupDom('<main></main>', { url: 'https://rekonime.test/' });
  const host = createSeoHost();
  host.updateMetaForAnime({ id: 'show-1', title: 'Show 1', synopsis: 'Story' });
  host.updateMetaForAnime(null);

  assert.equal(document.title, 'Rekonime | Anime dashboard');
  assert.equal(meta('meta[property="og:image:alt"]'), 'Rekonime logo');
  assert.equal(document.querySelectorAll('meta[property="og:title"]').length, 1);
  assert.equal(document.querySelectorAll('#structured-data').length, 1);
});

test('meta descriptions are trimmed to 160 characters', () => {
  const host = createSeoHost();
  assert.equal(host.buildMetaDescription(''), '');
  const description = host.buildMetaDescription('word '.repeat(60));
  assert.ok(description.length <= 160);
  assert.ok(description.endsWith('...'));
});

test('synopsis falls back to the cached copy', () => {
  const host = createSeoHost();
  assert.equal(host.getSynopsisForAnime(null), '');
  assert.equal(host.getSynopsisForAnime({ synopsis: ' Own ' }), 'Own');
  assert.equal(host.getSynopsisForAnime({ anilistId: 'cached' }), 'Cached synopsis');
});

test('structured data without an image keeps a summary card', () => {
  setupDom('<main></main>', { url: 'https://rekonime.test/' });
  const host = createSeoHost({ defaultMeta: { title: 'Rekonime', description: '', image: '', url: '' } });
  host.applyMetaTags({ title: 'Plain' });
  host.updateStructuredData({ title: 'Plain', url: 'https://rekonime.test/plain' });

  assert.equal(meta('meta[name="twitter:card"]'), 'summary');
  assert.equal(host.getMetaContent('og:title', true), 'Plain');
  assert.equal(host.getMetaContent('missing'), '');
  const graph = JSON.parse(document.getElementById('structured-data').textContent)['@graph'];
  assert.equal(graph[1].primaryImageOfPage, undefined);
});
