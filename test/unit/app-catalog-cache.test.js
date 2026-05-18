import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.js';
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

const withPatchedApp = async (patches, run) => {
  const originals = new Map();
  Object.keys(patches).forEach((key) => {
    originals.set(key, App[key]);
    App[key] = patches[key];
  });

  const stateKeys = [
    'isFullDataLoaded',
    'loadingFullCatalog',
    'fullCatalogPromise',
    'fullCatalogPreloadPromise',
    'fullCatalogScheduleHandle',
    'fullCatalogInteractionCaptured',
    'fullCatalogInteractionListeners'
  ];
  const state = new Map(stateKeys.map((key) => [key, App[key]]));

  App.isFullDataLoaded = false;
  App.loadingFullCatalog = false;
  App.fullCatalogPromise = null;
  App.fullCatalogPreloadPromise = null;
  App.fullCatalogScheduleHandle = null;
  App.fullCatalogInteractionCaptured = false;
  App.fullCatalogInteractionListeners = [];

  try {
    await run();
  } finally {
    originals.forEach((value, key) => {
      App[key] = value;
    });
    state.forEach((value, key) => {
      App[key] = value;
    });
  }
};

test('App loadFullCatalog caches a successful network full catalog', async () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let cachedPayload = null;
  let appliedPayload = null;
  const catalogEvents = [];

  await withPatchedApp({
    features: { ...App.features, parallelLoading: false },
    emitAppEvent: () => {},
    emitCatalogEvent: (type, detail = {}) => catalogEvents.push({ type, ...detail }),
    getPerformanceNow: () => 0,
    teardownFullCatalogInteractionTriggers: () => {},
    fetchCatalog: async (path) => (path === App.dataSources.full ? fullPayload : null),
    applyCatalogPayload: async (payload, options) => {
      appliedPayload = { payload, options };
      App.isFullDataLoaded = Boolean(options.isFull);
    },
    cacheFullCatalog: async (payload) => {
      cachedPayload = payload;
    },
    loadEmbeddedData: async () => {
      throw new Error('embedded fallback should not be used');
    },
    getLogger: () => null
  }, async () => {
    const loaded = await App.loadFullCatalog();

    assert.equal(loaded, true);
    assert.deepEqual(appliedPayload.payload, fullPayload);
    assert.equal(appliedPayload.options.isFull, true);
    assert.deepEqual(cachedPayload, fullPayload);
    assert.deepEqual(catalogEvents.map((event) => event.type), ['network-full-loaded']);
  });
});

test('App loadFullCatalog uses cached full catalog before embedded fallback', async () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let embeddedCalled = false;
  let appliedPayload = null;
  const catalogEvents = [];

  await withPatchedApp({
    features: { ...App.features, parallelLoading: false },
    emitAppEvent: () => {},
    emitCatalogEvent: (type, detail = {}) => catalogEvents.push({ type, ...detail }),
    getPerformanceNow: () => 0,
    teardownFullCatalogInteractionTriggers: () => {},
    fetchCatalog: async () => null,
    loadCachedFullCatalog: async () => fullPayload,
    applyCatalogPayload: async (payload, options) => {
      appliedPayload = { payload, options };
      App.isFullDataLoaded = Boolean(options.isFull);
    },
    loadEmbeddedData: async () => {
      embeddedCalled = true;
      return false;
    },
    getLogger: () => null
  }, async () => {
    const loaded = await App.loadFullCatalog();

    assert.equal(loaded, true);
    assert.equal(embeddedCalled, false);
    assert.deepEqual(appliedPayload.payload, fullPayload);
    assert.equal(appliedPayload.options.isFull, true);
    assert.deepEqual(catalogEvents.map((event) => event.type), ['indexeddb-full-used']);
  });
});
