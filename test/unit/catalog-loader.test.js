import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRuntime, createCatalogSession } from '../../js/services/catalog-loader.ts';
import { setupDom } from '../helpers/dom.js';

const fullIndexPayload = {
  anime: [
    { id: 'full-entry', title: 'Full Entry', detailPath: 'data/anime.detail/full-entry.json' }
  ]
};
const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const createRuntimeHarness = (overrides = {}) => {
  const events = [];
  const applied = [];
  const state = {
    animeData: [],
  };
  const session = createCatalogSession();
  const runtime = createCatalogRuntime({
    dataSources: {
      full: 'data/anime.full.index.json'
    },
    fullCatalogTimeoutMs: 1000,
    session,
    getCurrentAnimeData: () => state.animeData,
    emitAppEvent: (name, detail = {}) => events.push({ name, ...detail }),
    emitCatalogEvent: (type, detail = {}) => events.push({ name: 'catalog', type, ...detail }),
    getPerformanceNow: () => 0,
    fetchFn: async () => jsonResponse(null),
    loadEmbeddedData: async () => false,
    applyCatalogPayload: async (payload, options) => {
      applied.push({ payload, options });
      session.markFullLoaded(Boolean(options.isFull));
    },
    catalogCache: {
      getFullCatalog: async () => null,
      putFullCatalog: async () => false
    },
    getLogger: () => null,
    ...overrides
  });

  return { runtime, session, state, events, applied };
};

test('Catalog runtime loadInitialData applies the full index directly', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  const { runtime, events, applied } = createRuntimeHarness({
    fetchFn: async (path) => jsonResponse(path === 'data/anime.full.index.json' ? fullIndexPayload : null)
  });

  const loaded = await runtime.loadInitialData();

  assert.equal(loaded, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].options.isFull, true);
  assert.equal(events.some((event) => event.type === 'network-full-loaded'), true);
  assert.equal(events.some((event) => event.name === 'rekonime:data-load-end' && event.status === 'ok'), true);
});

test('Catalog runtime loadInitialData falls back to cached full index when network fails', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  let cacheRead = false;
  const { runtime } = createRuntimeHarness({
    fetchFn: async () => jsonResponse(null),
    catalogCache: {
      getFullCatalog: async () => {
        cacheRead = true;
        return fullIndexPayload;
      },
      putFullCatalog: async () => false
    }
  });

  const loaded = await runtime.loadInitialData();

  assert.equal(loaded, true);
  assert.equal(cacheRead, true);
});

test('Catalog runtime loadFullCatalog uses embedded fallback after network and cache miss', async () => {
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

test('Catalog runtime caches a successful network full catalog', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  let cachedPayload = null;
  const { runtime, session, events, applied } = createRuntimeHarness({
    fetchFn: async (path) => jsonResponse(path === 'data/anime.full.index.json' ? fullIndexPayload : null),
    catalogCache: {
      getFullCatalog: async () => null,
      putFullCatalog: async (payload) => {
        cachedPayload = payload;
        return true;
      }
    }
  });

  const loaded = await runtime.loadFullCatalog();

  assert.equal(loaded, true);
  assert.deepEqual(applied[0].payload, fullIndexPayload);
  assert.deepEqual(cachedPayload, fullIndexPayload);
  assert.equal(session.snapshot().isLoadingFull, false);
  assert.deepEqual(
    events.filter((event) => event.name === 'catalog').map((event) => event.type),
    ['network-full-loaded', 'cache-write-ok']
  );
});

test('Catalog runtime uses cached full catalog before embedded fallback', async () => {
  setupDom(undefined, { url: 'https://example.com/' });
  let embeddedCalled = false;
  const { runtime, events, applied } = createRuntimeHarness({
    catalogCache: {
      getFullCatalog: async () => fullIndexPayload,
      putFullCatalog: async () => {
        throw new Error('cached fallback should not write network cache');
      }
    },
    loadEmbeddedData: async () => {
      embeddedCalled = true;
      return false;
    }
  });

  const loaded = await runtime.loadFullCatalog();

  assert.equal(loaded, true);
  assert.equal(embeddedCalled, false);
  assert.deepEqual(applied[0].payload, fullIndexPayload);
  assert.deepEqual(
    events.filter((event) => event.name === 'catalog').map((event) => event.type),
    ['indexeddb-full-hit', 'indexeddb-full-used']
  );
});
