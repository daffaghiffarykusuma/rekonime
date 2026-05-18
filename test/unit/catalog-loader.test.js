import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogLoader } from '../../js/services/catalog-loader.js';
import { setupDom } from '../helpers/dom.js';

const previewPayload = {
  anime: [
    { id: 'preview-entry', title: 'Preview Entry' }
  ]
};

const createAppHarness = (overrides = {}) => {
  const events = [];
  const applied = [];
  const app = {
    features: { parallelLoading: false },
    dataSources: {
      preview: 'data/anime.preview.json',
      full: 'data/anime.full.json'
    },
    animeData: [],
    isFullDataLoaded: false,
    fullCatalogTimeoutMs: 1000,
    fullCatalogInteractionCaptured: false,
    fullCatalogInteractionListeners: [],
    fullCatalogScheduleHandle: null,
    fullCatalogPromise: null,
    loadingFullCatalog: false,
    addPreloadHints: () => {},
    emitAppEvent: (name, detail = {}) => events.push({ name, ...detail }),
    emitCatalogEvent: (type, detail = {}) => events.push({ name: 'catalog', type, ...detail }),
    getPerformanceNow: () => 0,
    fetchCatalog: async () => null,
    loadEmbeddedData: async () => false,
    applyCatalogPayload: async (payload, options) => {
      applied.push({ payload, options });
      app.isFullDataLoaded = Boolean(options.isFull);
    },
    loadFullCatalog: (options) => CatalogLoader.loadFullCatalog(app, options),
    loadCachedFullCatalog: async () => null,
    cacheFullCatalog: async () => false,
    teardownFullCatalogInteractionTriggers: () => {},
    cancelIdleTask: () => {},
    getLogger: () => null,
    ...overrides
  };

  return { app, events, applied };
};

test('CatalogLoader loadInitialData applies preview catalog and emits observability', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  const { app, events, applied } = createAppHarness({
    fetchCatalog: async (path) => (path === 'data/anime.preview.json' ? previewPayload : null)
  });

  const loaded = await CatalogLoader.loadInitialData(app);

  assert.equal(loaded, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].options.isFull, false);
  assert.equal(events.some((event) => event.type === 'preview-network-loaded'), true);
  assert.equal(events.some((event) => event.name === 'rekonime:data-load-end' && event.status === 'ok'), true);
});

test('CatalogLoader loadInitialData falls through to full load when preview fails', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  let fullLoadCalled = false;
  const { app } = createAppHarness({
    loadFullCatalog: async () => {
      fullLoadCalled = true;
      return true;
    }
  });

  const loaded = await CatalogLoader.loadInitialData(app);

  assert.equal(loaded, true);
  assert.equal(fullLoadCalled, true);
});

test('CatalogLoader loadFullCatalog uses embedded fallback after network and cache miss', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  const { app, events, applied } = createAppHarness({
    loadEmbeddedData: async () => {
      app.animeData = [{ id: 'embedded-entry', title: 'Embedded Entry' }];
      return true;
    }
  });

  const loaded = await CatalogLoader.loadFullCatalog(app);

  assert.equal(loaded, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].payload.anime[0].id, 'embedded-entry');
  assert.equal(applied[0].options.isFull, true);
  assert.equal(events.some((event) => event.type === 'indexeddb-full-miss'), false);
  assert.equal(events.some((event) => event.type === 'embedded-fallback-used'), true);
});
