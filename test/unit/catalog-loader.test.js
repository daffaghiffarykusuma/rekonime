import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRuntime } from '../../js/services/catalog-loader.js';
import { setupDom } from '../helpers/dom.js';

const previewPayload = {
  anime: [
    { id: 'preview-entry', title: 'Preview Entry' }
  ]
};

const createRuntimeHarness = (overrides = {}) => {
  const events = [];
  const applied = [];
  const state = {
    animeData: [],
    isFullDataLoaded: false,
    fullCatalogInteractionCaptured: false,
    fullCatalogScheduleHandle: null,
    fullCatalogPromise: null,
    loadingFullCatalog: false
  };
  const runtime = createCatalogRuntime({
    features: { parallelLoading: false },
    dataSources: {
      preview: 'data/anime.preview.json',
      full: 'data/anime.full.json'
    },
    fullCatalogTimeoutMs: 1000,
    getCurrentAnimeData: () => state.animeData,
    isFullDataLoaded: () => state.isFullDataLoaded,
    setFullDataLoaded: (value) => { state.isFullDataLoaded = value; },
    setLoadingFullCatalog: (value) => { state.loadingFullCatalog = value; },
    getFullCatalogPromise: () => state.fullCatalogPromise,
    setFullCatalogPromise: (promise) => { state.fullCatalogPromise = promise; },
    getFullCatalogScheduleHandle: () => state.fullCatalogScheduleHandle,
    setFullCatalogScheduleHandle: (handle) => { state.fullCatalogScheduleHandle = handle; },
    getFullCatalogInteractionCaptured: () => state.fullCatalogInteractionCaptured,
    setFullCatalogInteractionCaptured: (value) => { state.fullCatalogInteractionCaptured = value; },
    emitAppEvent: (name, detail = {}) => events.push({ name, ...detail }),
    emitCatalogEvent: (type, detail = {}) => events.push({ name: 'catalog', type, ...detail }),
    getPerformanceNow: () => 0,
    getApiClient: () => ({
      getJson: async () => null
    }),
    loadEmbeddedData: async () => false,
    applyCatalogPayload: async (payload, options) => {
      applied.push({ payload, options });
      state.isFullDataLoaded = Boolean(options.isFull);
    },
    catalogCache: {
      getFullCatalog: async () => null,
      putFullCatalog: async () => false
    },
    getLogger: () => null,
    ...overrides
  });

  return { runtime, state, events, applied };
};

test('CatalogLoader loadInitialData applies preview catalog and emits observability', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  const { runtime, events, applied } = createRuntimeHarness({
    getApiClient: () => ({
      getJson: async (path) => (path === 'data/anime.preview.json' ? previewPayload : null)
    })
  });

  const loaded = await runtime.loadInitialData();

  assert.equal(loaded, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].options.isFull, false);
  assert.equal(events.some((event) => event.type === 'preview-network-loaded'), true);
  assert.equal(events.some((event) => event.name === 'rekonime:data-load-end' && event.status === 'ok'), true);
});

test('CatalogLoader loadInitialData falls through to full load when preview fails', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  let fullLoadCalled = false;
  const { runtime } = createRuntimeHarness({
    getApiClient: () => ({ getJson: async () => null }),
    catalogCache: {
      getFullCatalog: async () => {
        fullLoadCalled = true;
        return previewPayload;
      },
      putFullCatalog: async () => false
    }
  });

  const loaded = await runtime.loadInitialData();

  assert.equal(loaded, true);
  assert.equal(fullLoadCalled, true);
});

test('CatalogLoader loadFullCatalog uses embedded fallback after network and cache miss', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  const { state, runtime, events, applied } = createRuntimeHarness({
    loadEmbeddedData: async () => {
      state.animeData = [{ id: 'embedded-entry', title: 'Embedded Entry' }];
      return true;
    }
  });

  const loaded = await runtime.loadFullCatalog();

  assert.equal(loaded, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].payload.anime[0].id, 'embedded-entry');
  assert.equal(applied[0].options.isFull, true);
  assert.equal(events.some((event) => event.type === 'indexeddb-full-miss'), true);
  assert.equal(events.some((event) => event.type === 'embedded-fallback-used'), true);
});
