import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRuntime } from '../../js/services/catalog-loader.js';
import { setupDom } from '../helpers/dom.js';

const fullPayload = {
  generatedAt: '2026-05-18T00:00:00.000Z',
  anime: [
    {
      id: 'full-entry',
      title: 'Full Entry',
      genres: [],
      themes: [],
      episodes: [],
      stats: {}
    }
  ]
};

const createFullCatalogHarness = (overrides = {}) => {
  const catalogEvents = [];
  let cachedPayload = null;
  let appliedPayload = null;
  let isFullDataLoaded = false;
  let loadingFullCatalog = false;
  let fullCatalogPromise = null;
  let fullCatalogScheduleHandle = null;
  let fullCatalogInteractionCaptured = false;

  const runtime = createCatalogRuntime({
    features: { parallelLoading: false },
    dataSources: { full: 'data/anime.full.index.json' },
    getPerformanceNow: () => 0,
    getApiClient: () => ({ getJson: async () => null }),
    getCurrentAnimeData: () => [],
    isFullDataLoaded: () => isFullDataLoaded,
    setFullDataLoaded: (value) => { isFullDataLoaded = value; },
    setLoadingFullCatalog: (value) => { loadingFullCatalog = value; },
    getFullCatalogPromise: () => fullCatalogPromise,
    setFullCatalogPromise: (promise) => { fullCatalogPromise = promise; },
    getFullCatalogScheduleHandle: () => fullCatalogScheduleHandle,
    setFullCatalogScheduleHandle: (handle) => { fullCatalogScheduleHandle = handle; },
    getFullCatalogInteractionCaptured: () => fullCatalogInteractionCaptured,
    setFullCatalogInteractionCaptured: (value) => { fullCatalogInteractionCaptured = value; },
    teardownFullCatalogInteractionTriggers: () => {},
    emitAppEvent: () => {},
    emitCatalogEvent: (type, detail = {}) => catalogEvents.push({ type, ...detail }),
    applyCatalogPayload: async (payload, options) => {
      appliedPayload = { payload, options };
      isFullDataLoaded = Boolean(options.isFull);
    },
    loadEmbeddedData: async () => {
      throw new Error('embedded fallback should not be used');
    },
    catalogCache: {
      getFullCatalog: async () => null,
      putFullCatalog: async (payload) => {
        cachedPayload = payload;
        return true;
      }
    },
    getLogger: () => null,
    ...overrides
  });

  return {
    runtime,
    catalogEvents,
    get cachedPayload() { return cachedPayload; },
    get appliedPayload() { return appliedPayload; },
    get loadingFullCatalog() { return loadingFullCatalog; }
  };
};

test('Catalog runtime caches a successful network full catalog', async () => {
  setupDom(undefined, { url: 'https://example.com/' });

  const harness = createFullCatalogHarness({
    getApiClient: () => ({
      getJson: async (path) => (path === 'data/anime.full.index.json' ? fullPayload : null)
    })
  });

  const loaded = await harness.runtime.loadFullCatalog();

  assert.equal(loaded, true);
  assert.deepEqual(harness.appliedPayload.payload, fullPayload);
  assert.equal(harness.appliedPayload.options.isFull, true);
  assert.deepEqual(harness.cachedPayload, fullPayload);
  assert.equal(harness.loadingFullCatalog, false);
  assert.deepEqual(
    harness.catalogEvents.map((event) => event.type),
    ['network-full-loaded', 'cache-write-ok']
  );
});

test('Catalog runtime uses cached full catalog before embedded fallback', async () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let embeddedCalled = false;
  const harness = createFullCatalogHarness({
    catalogCache: {
      getFullCatalog: async () => fullPayload,
      putFullCatalog: async () => {
        throw new Error('cached fallback should not write network cache');
      }
    },
    loadEmbeddedData: async () => {
      embeddedCalled = true;
      return false;
    }
  });

  const loaded = await harness.runtime.loadFullCatalog();

  assert.equal(loaded, true);
  assert.equal(embeddedCalled, false);
  assert.deepEqual(harness.appliedPayload.payload, fullPayload);
  assert.equal(harness.appliedPayload.options.isFull, true);
  assert.deepEqual(
    harness.catalogEvents.map((event) => event.type),
    ['indexeddb-full-hit', 'indexeddb-full-used']
  );
});
