import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppCatalogRuntime, createCatalogRuntime, createCatalogSession } from '../../js/services/catalog-loader.ts';
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

test('Catalog runtime deduplicates detail enrichment and preserves index fields', async () => {
  let resolveFetch;
  let fetchCount = 0;
  const refreshed = [];
  const response = new Promise((resolve) => { resolveFetch = resolve; });
  const { runtime, state, events } = createRuntimeHarness({
    fetchFn: async () => { fetchCount += 1; return response; },
    onAnimeDetailLoaded: (anime) => refreshed.push(anime)
  });
  state.animeData = [{ id: 'one', title: 'One', cover: 'cover.jpg', custom: 'retained', episodes: [] }];
  const first = runtime.loadAnimeDetailChunk('one');
  const second = runtime.loadAnimeDetailChunk('one');
  // A full-index replacement while fetching must not be overwritten with stale fields.
  state.animeData = [{ ...state.animeData[0], year: 2026 }];
  resolveFetch(jsonResponse({ anime: [{ id: 'one', title: 'One', synopsis: 'Detail synopsis', episodes: [{ episode: 1, score: 4 }] }] }));
  const [left, right] = await Promise.all([first, second]);
  assert.equal(fetchCount, 1);
  assert.equal(left, right);
  assert.equal(left, state.animeData[0]);
  assert.equal(left.title, 'One');
  assert.equal(left.cover, 'cover.jpg');
  assert.equal(left.custom, 'retained');
  assert.equal(left.year, 2026);
  assert.equal(left.synopsis, 'Detail synopsis');
  assert.equal(refreshed.length, 1);
  assert.equal(events.filter((event) => event.type === 'detail-chunk-loaded').length, 1);
  assert.equal(await runtime.loadAnimeDetailChunk('one'), left);
  assert.equal(fetchCount, 1);
  assert.equal(refreshed.length, 1);
});

test('Catalog runtime rejects missing or mismatched detail identity and allows another load', async () => {
  const payloads = [
    { anime: [{ synopsis: 'Missing identity' }] },
    { anime: [{ id: 'other', title: 'Other', episodes: [] }] },
    { anime: [{ id: 'one', title: 'One', synopsis: 'Accepted empty episode list', episodes: [] }] }
  ];
  let fetchCount = 0;
  let refreshCount = 0;
  const { runtime, state } = createRuntimeHarness({
    fetchFn: async () => jsonResponse(payloads[fetchCount++]),
    onAnimeDetailLoaded: () => { refreshCount += 1; }
  });
  const original = { id: 'one', title: 'One', episodes: [] };
  state.animeData = [original];
  assert.equal(await runtime.loadAnimeDetailChunk('one'), null);
  assert.equal(await runtime.loadAnimeDetailChunk('one'), null);
  assert.equal(state.animeData[0], original);
  assert.equal(refreshCount, 0);
  const accepted = await runtime.loadAnimeDetailChunk('one');
  assert.equal(accepted.synopsis, 'Accepted empty episode list');
  assert.equal(await runtime.loadAnimeDetailChunk('one'), accepted);
  assert.equal(fetchCount, 3);
  assert.equal(refreshCount, 1);
});

test('Catalog runtime skips complete records and retries a failed detail fetch', async () => {
  let fetchCount = 0;
  const { runtime, state } = createRuntimeHarness({
    fetchFn: async () => ++fetchCount === 1
      ? jsonResponse(null, 404)
      : jsonResponse({ anime: [{ id: 'one', title: 'One', episodes: [{ episode: 1, score: 4 }] }] }),
    getLogger: () => ({ error() {} })
  });
  const complete = { id: 'complete', episodes: [{ episode: 1, score: 4 }] };
  state.animeData = [complete, { id: 'one', title: 'One' }];
  assert.equal(await runtime.loadAnimeDetailChunk('complete'), complete);
  assert.equal(fetchCount, 0);
  assert.equal(await runtime.loadAnimeDetailChunk('one'), null);
  assert.equal((await runtime.loadAnimeDetailChunk('one')).id, 'one');
  assert.equal(fetchCount, 2);
});

test('App Catalog Runtime applies detail cache and Snapshot effects once', async () => {
  const originalFetch = globalThis.fetch;
  let cacheDeletes = 0;
  let snapshotRefreshes = 0;
  const app = {
    animeData: [{ id: 'one', title: 'One' }],
    getLogger: () => null,
    detailCache: { delete: () => { cacheDeletes += 1; } },
    gridSortedCache: ['old'], gridSortedKey: 'old', gridSortedSource: ['old'],
    refreshWatchlistSnapshotsFromCatalog: (options) => {
      assert.deepEqual(options, { persist: true });
      assert.equal(app.animeData[0].synopsis, 'Enriched');
      snapshotRefreshes += 1;
    },
    emitCatalogEvent() {}
  };
  globalThis.fetch = async () => jsonResponse({ anime: [{ id: 'one', title: 'One', synopsis: 'Enriched', episodes: [] }] });
  try {
    const runtime = createAppCatalogRuntime(app);
    await Promise.all([runtime.loadAnimeDetailChunk('one'), runtime.loadAnimeDetailChunk('one')]);
    await runtime.loadAnimeDetailChunk('one');
    assert.equal(cacheDeletes, 1);
    assert.equal(snapshotRefreshes, 1);
    assert.equal(app.gridSortedCache, null);
    assert.equal(app.gridSortedKey, '');
    assert.equal(app.gridSortedSource, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
