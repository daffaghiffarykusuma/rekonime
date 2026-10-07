import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogRuntime } from '../../src/features/catalog/catalog-loader.ts';
import { createDetailExperience } from '../../src/features/detail/detail-experience.ts';
import { setupDom } from '../helpers/dom.js';

const createAppHarness = (overrides = {}, dependencyOverrides = {}) => {
  const calls = [];
  const app = {
    animeData: [],
    isFullDataLoaded: false,
    getPerformanceNow: () => 100,
    emitAppEvent: (...args) => calls.push(['emitAppEvent', ...args]),
    getAnimeIdFromUrl: () => '',
    shouldEmbedTrailers: () => true,
    shouldAutoplayTrailers: () => false,
    renderSynopsis: (value) => `<p>${value}</p>`,
    updateMetaForAnime: (...args) => calls.push(['updateMetaForAnime', ...args]),
    updateMetaForFilters: () => calls.push(['updateMetaForFilters']),
    getLogger: () => null,
    getRuntimeCapabilities: () => ({
      setModalVisibility: (...args) => calls.push(['setModalVisibility', ...args])
    }),
    updateUrlForAnime: (...args) => calls.push(['updateUrlForAnime', ...args]),
    resetMetaToDefault: () => calls.push(['resetMetaToDefault']),
    normalizeBookmarkId: (value) => String(value ?? '').trim(),
    getWatchlistSnapshot: () => null,
    loadAnimeDetailChunk: async () => null,
    getSynopsisForAnime: (anime) => anime.synopsis || '',
    sanitizeClassToken: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, ''),
    sanitizeClassList: (...classes) => classes.filter(Boolean).join(' '),
    buildImageSrcset: (cover) => ({ src: cover || '', srcset: '', sizes: '', fallback: '' }),
    sanitizeImageUrl: (value) => value || '',
    escapeAttr: (value) => String(value ?? '').replaceAll('"', '&quot;'),
    escapeHtml: (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;'),
    getImageProxyRuntime: () => ({
      getDimensions: () => ({ width: 150, height: 210 })
    }),
    getImageFallbackAttrs: () => '',
    renderWatchlistControls: () => '<div class="watchlist-controls"></div>',
    updateWatchlistControls: (...args) => calls.push(['updateWatchlistControls', ...args]),
    updatePrefetchObserving: () => calls.push(['updatePrefetchObserving']),
    loadFullCatalog: async () => false,
    ...overrides
  };
  const reviewsService = {
      fetchReviews: async (...args) => {
        calls.push(['fetchReviews', ...args]);
        return { description: 'Remote synopsis', positive: [], neutral: [], negative: [] };
      },
      renderSynopsis: (value) => `<p>${value}</p>`,
      renderReviewsSection: (data) => `<section>${data.error ? 'Error' : 'Reviews'}</section>`,
      initTabSwitching: () => calls.push(['initTabSwitching'])
  };
  const dependencies = {
    cacheMaxSize: 2,
    catalogRuntime: {
      loadFullCatalog: (...args) => app.loadFullCatalog(...args),
      loadAnimeDetailChunk: (...args) => app.loadAnimeDetailChunk(...args)
    },
    loadReviewsService: async () => reviewsService,
    ...dependencyOverrides
  };

  return { app, calls, detail: createDetailExperience(app, dependencies), reviewsService };
};

const mount = () => setupDom('<dialog id="detail-modal"><div class="modal-content"><button id="close-detail">Close</button><div id="detail-content"></div></div></dialog>');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const view = async () => ({
  presentation: await import('../../src/features/detail/detail-presentation.ts'),
  ...await import('../../src/features/detail/detail-media.ts')
});
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const titles = [{ id: 'one', title: 'One', malId: 1 }, { id: 'two', title: 'Two', malId: 2 }];

test('closing during lazy loading cancels the opening, including a later same-title reopen', async () => {
  mount();
  const loading = deferred();
  const { detail, calls } = createAppHarness({ animeData: titles }, { loadView: () => loading.promise });
  const first = detail.open('one');
  assert.match(document.getElementById('detail-content').textContent, /Loading details/);
  detail.close();
  assert.equal(detail.getCurrentAnimeId(), null);
  const second = detail.open('one');
  loading.resolve(await view());
  assert.equal(await first, false);
  assert.equal(await second, true);
  await tick();
  assert.equal(calls.filter(([name]) => name === 'updateMetaForAnime').length, 2); // initial and reviews
  assert.equal(calls.filter(([name, event]) => event === 'rekonime:modal-opened').length, 1);
});

test('only the latest opening renders after shared loading, and failed loading can be retried', async () => {
  mount();
  const loading = deferred();
  let attempts = 0;
  const { detail } = createAppHarness({ animeData: titles }, {
    loadView: () => ++attempts === 1 ? loading.promise : view()
  });
  const first = detail.open('one');
  const second = detail.open('two');
  loading.reject(new Error('offline'));
  await Promise.all([first, second]);
  assert.ok(document.querySelector('[data-action="retry-detail"]'));
  assert.equal(await detail.retry(), true);
  assert.equal(attempts, 2);
  assert.equal(detail.getCurrentAnimeId(), 'two');
  assert.match(document.getElementById('detail-content').textContent, /Two/);
});

test('retry preserves a deep-link request after catalog loading fails', async () => {
  mount();
  let attempts = 0;
  const { app, detail, calls } = createAppHarness({ loadFullCatalog: async () => {
    if (++attempts === 1) throw new Error('offline');
    app.animeData = titles;
    return true;
  } });
  assert.equal(await detail.open('one', { deepLink: true, updateUrl: false }), false);
  assert.equal(await detail.retry(), true);
  assert.equal(attempts, 2);
  assert.equal(calls.some(([name]) => name === 'updateUrlForAnime'), false);
});

test('URL synchronization owns deep-link loading and close cancels catalog completion', async () => {
  mount();
  const loading = deferred();
  const entered = deferred();
  const { app, detail, calls } = createAppHarness({
    getAnimeIdFromUrl: () => 'one',
    loadFullCatalog: () => { entered.resolve(); return loading.promise; }
  });
  const pending = detail.syncWithUrl({ updateUrl: false });
  await entered.promise;
  app.getAnimeIdFromUrl = () => '';
  detail.syncWithUrl({ updateUrl: false });
  app.animeData = titles;
  loading.resolve(true);
  assert.equal(await pending, false);
  assert.equal(detail.getCurrentAnimeId(), null);
  assert.equal(calls.some(([name]) => name === 'updateMetaForAnime'), false);
  assert.equal(calls.some(([name]) => name === 'updateUrlForAnime'), false);
  app.getAnimeIdFromUrl = () => 'one';
  assert.equal(await detail.syncWithUrl({ updateUrl: false }), true);
});

test('cache reuse, eviction, and invalidation are observable through opening titles', async () => {
  mount();
  const animeData = [...titles, { id: 'three', title: 'Three' }];
  const { detail, calls } = createAppHarness({ animeData });
  for (const id of ['one', 'two', 'one', 'three', 'two']) await detail.open(id);
  const cached = () => calls.filter(([, event]) => event === 'rekonime:modal-opened').map(([, , value]) => value.cached);
  assert.deepEqual(cached(), [false, false, true, false, false]);
  detail.invalidate('two');
  await detail.open('two');
  assert.equal(cached().at(-1), false);
  detail.invalidate();
  await detail.open('three');
  assert.equal(cached().at(-1), false);
});

for (const failure of [false, true]) {
  test(`old same-title reviews cannot update a reopened session (${failure ? 'failure' : 'success'})`, async () => {
    mount();
    const pending = deferred();
    const { detail, reviewsService, calls } = createAppHarness({ animeData: titles });
    await detail.open('one');
    await tick();
    reviewsService.fetchReviews = () => pending.promise;
    const old = detail.refreshCommunityReviews();
    await Promise.resolve();
    detail.close();
    reviewsService.fetchReviews = async () => ({ description: 'Current synopsis' });
    await detail.open('one');
    await tick();
    const before = calls.length;
    if (failure) pending.reject(new Error('stale failure'));
    else pending.resolve({ description: 'Stale synopsis' });
    assert.deepEqual(await old, { status: 'stale' });
    assert.match(document.getElementById('synopsis-section').textContent, /Current synopsis/);
    assert.equal(calls.length, before);
  });
}

test('newest review retry wins within one session', async () => {
  mount();
  const { detail, reviewsService } = createAppHarness({ animeData: titles });
  await detail.open('one');
  await tick();
  const first = deferred(), second = deferred();
  let requests = 0;
  reviewsService.fetchReviews = () => ++requests === 1 ? first.promise : second.promise;
  const old = detail.refreshCommunityReviews();
  await Promise.resolve();
  const current = detail.refreshCommunityReviews();
  await Promise.resolve();
  second.resolve({ description: 'Newest' });
  assert.deepEqual(await current, { status: 'loaded' });
  first.resolve({ description: 'Old' });
  assert.deepEqual(await old, { status: 'stale' });
  assert.match(document.getElementById('synopsis-section').textContent, /Newest/);
});

test('review error-render loading cannot overwrite a newer review result', async () => {
  mount();
  const recovery = deferred(), entered = deferred();
  const { detail, reviewsService } = createAppHarness({ animeData: titles, getLogger: () => ({ error() {} }) }, {
    loadReviewsService: async () => {
      if (recovering) { entered.resolve(); return recovery.promise; }
      return reviewsService;
    }
  });
  let recovering = false;
  await detail.open('one');
  await tick();
  reviewsService.fetchReviews = async () => { recovering = true; throw new Error('offline'); };
  const old = detail.refreshCommunityReviews();
  await entered.promise;
  recovering = false;
  reviewsService.fetchReviews = async () => ({ description: 'Recovered' });
  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'loaded' });
  recovery.resolve(reviewsService);
  assert.deepEqual(await old, { status: 'stale' });
  assert.doesNotMatch(document.getElementById('community-reviews-section').textContent, /Error/);
});

test('enrichment renders once, invalidates cached markup, and ignores obsolete same-title work', async () => {
  mount();
  const oldChunk = deferred(), newChunk = deferred();
  let loads = 0;
  const { detail } = createAppHarness({ animeData: titles,
    loadAnimeDetailChunk: () => ++loads === 1 ? oldChunk.promise : newChunk.promise
  });
  await detail.open('one');
  detail.close();
  await detail.open('one');
  newChunk.resolve({ ...titles[0], title: 'Current enriched title' });
  await tick();
  oldChunk.resolve({ ...titles[0], title: 'Obsolete title' });
  await tick();
  assert.match(document.getElementById('detail-content').textContent, /Current enriched title/);
  assert.doesNotMatch(document.getElementById('detail-content').textContent, /Obsolete title/);
  assert.equal(loads, 2, 'rendering enrichment does not start another chunk request');
});

test('real Catalog Runtime enrichment updates the visible session', async () => {
  mount();
  let app, detail, requests = 0;
  const runtime = createCatalogRuntime({
    getCurrentAnimeData: () => app.animeData,
    fetchFn: async () => { requests++; return Response.json({ anime: [{ id: 'one', title: 'Enriched', episodes: [] }] }); },
    onAnimeDetailLoaded: anime => detail.invalidate(anime.id)
  });
  ({ app, detail } = createAppHarness({ animeData: [{ id: 'one', title: 'Index title' }] }, { catalogRuntime: runtime }));
  await detail.open('one');
  await runtime.loadAnimeDetailChunk('one');
  await tick();
  assert.match(document.getElementById('detail-content').textContent, /Enriched/);
  assert.equal(requests, 1);
});

test('snapshot sessions retain media ownership and close cleans up trailer playback', async () => {
  mount();
  const anime = { id: 'saved', title: 'Saved', trailer: { id: 'abc123' } };
  const { detail, app, calls } = createAppHarness({ getWatchlistSnapshot: () => anime });
  await detail.open('saved');
  detail.refreshTrailerSection();
  assert.equal(document.querySelector('#detail-trailer iframe').dataset.embedSrc, 'https://www.youtube.com/embed/abc123');
  detail.close();
  assert.equal(document.querySelector('#detail-trailer iframe').getAttribute('src'), 'about:blank');
  assert.equal(detail.getCurrentAnimeId(), null);
  assert.deepEqual(calls.find(([name]) => name === 'updateMetaForFilters'), ['updateMetaForFilters']);
});

test('missing titles and unavailable or failed reviews retain useful recovery', async () => {
  mount();
  const { detail, calls, reviewsService, app } = createAppHarness({ animeData: [{ id: 'one', title: 'One', synopsis: 'Fallback' }], getLogger: () => ({ error() {} }) });
  await detail.open('missing');
  assert.match(document.getElementById('detail-content').textContent, /not available/);
  assert.deepEqual(calls.find(([name]) => name === 'updateUrlForAnime'), ['updateUrlForAnime', null, { replace: true }]);
  await detail.open('one');
  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'unavailable' });
  assert.match(document.getElementById('synopsis-section').textContent, /Fallback/);
  app.animeData[0].malId = 1;
  reviewsService.fetchReviews = async () => { throw new Error('offline'); };
  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'failed' });
  reviewsService.fetchReviews = async () => ({ description: 'Retried' });
  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'loaded' });
});
