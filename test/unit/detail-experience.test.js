import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailExperience } from '../../js/detail-experience.ts';
import { setupDom } from '../helpers/dom.js';

const createAppHarness = (overrides = {}, dependencyOverrides = {}) => {
  const calls = [];
  const app = {
    detailCache: new Map(),
    detailCacheMaxSize: 2,
    currentAnimeId: null,
    animeData: [],
    isFullDataLoaded: false,
    getPerformanceNow: () => 100,
    emitAppEvent: (...args) => calls.push(['emitAppEvent', ...args]),
    getAnimeIdFromUrl: () => '',
    showAnimeDetail: (...args) => calls.push(['showAnimeDetail', ...args]),
    closeDetailModal: (...args) => calls.push(['closeDetailModal', ...args]),
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
    hasFullAnimeDetail: () => true,
    loadAnimeDetailChunk: async () => null,
    getSynopsisForAnime: (anime) => anime.synopsis || '',
    renderFranchiseHubSection: () => '',
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
    renderSimilarAnimeSection: () => '<div class="similar-empty"></div>',
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
    catalogRuntime: {
      loadFullCatalog: (...args) => app.loadFullCatalog(...args),
      loadAnimeDetailChunk: (...args) => app.loadAnimeDetailChunk(...args)
    },
    loadReviewsService: async () => reviewsService,
    ...dependencyOverrides
  };

  return { app, calls, detail: createDetailExperience(app, dependencies), reviewsService };
};

test('Detail Experience cache evicts least recently used detail markup', () => {
  const { app, detail } = createAppHarness();

  detail.cache('one', '<p>One</p>');
  detail.cache('two', '<p>Two</p>');
  assert.equal(detail.getCached('one'), '<p>One</p>');
  detail.cache('three', '<p>Three</p>');

  assert.equal(app.detailCache.has('two'), false);
  assert.equal(app.detailCache.has('one'), true);
  assert.equal(app.detailCache.has('three'), true);
});

test('Detail Experience opens and renders a title lifecycle', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="detail-content"></div>
  `);
  const { app, detail, calls } = createAppHarness({
    animeData: [{
      id: 'show-1',
      title: 'Show One',
      cover: 'https://example.test/show.jpg',
      genres: ['Drama'],
      themes: ['School'],
      type: 'TV',
      year: 2024,
      synopsis: 'Local synopsis',
      episodes: [{ score: 80 }],
      stats: { retentionScore: 82, threeEpisodeHook: 77, churnRisk: { score: 18 }, worthFinishing: 91 },
      communityScore: 8.2
    }]
  });

  detail.open('show-1', { updateUrl: false });

  assert.equal(app.currentAnimeId, 'show-1');
  assert.match(document.getElementById('detail-content').innerHTML, /Show One/);
  assert.equal(app.detailCache.has('show-1'), true);
  assert.equal(calls.some(([name]) => name === 'updateWatchlistControls'), true);
  assert.deepEqual(calls.at(-1), ['emitAppEvent', 'rekonime:modal-opened', {
    animeId: 'show-1',
    durationMs: 0,
    cached: false,
    status: 'ok'
  }]);
});

test('Detail Experience syncs URL anime state to open or close actions', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="detail-content"></div>
  `);
  const { app, detail } = createAppHarness({
    currentAnimeId: 'current',
    getAnimeIdFromUrl: () => 'next',
    animeData: [{ id: 'next', title: 'Next' }]
  });

  detail.syncWithUrl({ updateUrl: false });
  assert.equal(app.currentAnimeId, 'next');

  const closeHarness = createAppHarness({ currentAnimeId: 'current' });
  closeHarness.detail.syncWithUrl({ updateUrl: true });
  assert.equal(closeHarness.app.currentAnimeId, null);
  assert.deepEqual(closeHarness.calls.find(([name]) => name === 'updateUrlForAnime'), ['updateUrlForAnime', null]);
});

test('Detail Experience refreshes trailer behavior through its private media module', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="community-reviews-section"></div>
  `);
  const animeData = [{
    id: 'show-1',
    title: 'Show One',
    trailer: { id: 'abc123' }
  }];
  const { detail } = createAppHarness({
    currentAnimeId: 'show-1',
    animeData
  });

  detail.refreshTrailerSection();

  const iframe = document.querySelector('#detail-trailer iframe');
  assert.equal(iframe?.dataset.paused, '1');
  assert.equal(iframe?.dataset.embedSrc, 'https://www.youtube.com/embed/abc123');
});

test('Detail Experience owns the active review lifecycle and visible outcome', async () => {
  setupDom(`
    <div id="synopsis-section"></div>
    <div id="community-reviews-section"></div>
  `);
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A', synopsis: 'Fallback synopsis' };
  const { detail, calls } = createAppHarness({ currentAnimeId: anime.id, animeData: [anime] });

  const result = await detail.refreshCommunityReviews();

  assert.deepEqual(result, { status: 'loaded' });
  assert.deepEqual(calls[0], ['fetchReviews', 1, 'Anime A']);
  assert.match(document.getElementById('synopsis-section').innerHTML, /Remote synopsis/);
  assert.match(document.getElementById('community-reviews-section').innerHTML, /Reviews/);
  assert.equal(calls.some(([name]) => name === 'initTabSwitching'), true);
  assert.equal(calls.some(([name]) => name === 'updateMetaForAnime'), true);
});

test('Detail Experience ignores a stale review response', async () => {
  setupDom('<div id="synopsis-section"></div><div id="community-reviews-section"></div>');
  let resolveReviews;
  const reviewsService = {
    fetchReviews: () => new Promise(resolve => { resolveReviews = resolve; }),
    renderSynopsis: (value) => `<p>${value}</p>`,
    renderReviewsSection: () => '<section>Reviews</section>',
    initTabSwitching: () => {}
  };
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A' };
  const { app, detail } = createAppHarness(
    { currentAnimeId: anime.id, animeData: [anime] },
    { loadReviewsService: async () => reviewsService }
  );

  const pending = detail.refreshCommunityReviews();
  await Promise.resolve();
  app.currentAnimeId = 'other';
  resolveReviews({ description: 'Remote synopsis', positive: [], neutral: [], negative: [] });

  assert.deepEqual(await pending, { status: 'stale' });
  assert.equal(document.getElementById('community-reviews-section').innerHTML, '');
});

test('Detail Experience ignores a stale review failure', async () => {
  setupDom('<div id="synopsis-section"></div><div id="community-reviews-section"></div>');
  let rejectReviews;
  const reviewsService = {
    fetchReviews: () => new Promise((resolve, reject) => { rejectReviews = reject; }),
    renderSynopsis: (value) => `<p>${value}</p>`,
    renderReviewsSection: () => '<section>Error</section>',
    initTabSwitching: () => {}
  };
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A' };
  const { app, detail } = createAppHarness(
    { currentAnimeId: anime.id, animeData: [anime], getLogger: () => ({ error: () => {} }) },
    { loadReviewsService: async () => reviewsService }
  );

  const pending = detail.refreshCommunityReviews();
  await Promise.resolve();
  app.currentAnimeId = 'other';
  rejectReviews(new Error('provider unavailable'));

  assert.deepEqual(await pending, { status: 'stale' });
  assert.equal(document.getElementById('community-reviews-section').innerHTML, '');
});

test('Detail Experience renders unavailable reviews when MAL id is absent', async () => {
  setupDom('<div id="synopsis-section"></div><div id="community-reviews-section"></div>');
  const anime = { id: 'anime-a', title: 'Anime A', synopsis: 'Fallback synopsis' };
  const { detail } = createAppHarness({ currentAnimeId: anime.id, animeData: [anime] });

  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'unavailable' });
  assert.match(document.getElementById('synopsis-section').innerHTML, /Fallback synopsis/);
  assert.match(document.getElementById('community-reviews-section').innerHTML, /unavailable/);
});

test('Detail Experience owns failed review rendering and retry outcome', async () => {
  setupDom('<div id="synopsis-section"></div><div id="community-reviews-section"></div>');
  const reviewsService = {
    fetchReviews: async () => { throw new Error('provider unavailable'); },
    renderSynopsis: (value) => `<p>${value}</p>`,
    renderReviewsSection: (data) => `<section>${data.error ? 'Error' : 'Reviews'}</section>`,
    initTabSwitching: () => {}
  };
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A' };
  const { detail } = createAppHarness(
    { currentAnimeId: anime.id, animeData: [anime], getLogger: () => ({ error: () => {} }) },
    { loadReviewsService: async () => reviewsService }
  );

  assert.deepEqual(await detail.refreshCommunityReviews(), { status: 'failed' });
  assert.match(document.getElementById('community-reviews-section').innerHTML, /Error/);
});

test('Detail Experience renders missing catalog title markup', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="detail-content"></div>
  `);
  const { detail, calls } = createAppHarness();

  detail.open('missing-title', { updateUrl: true });

  assert.match(document.getElementById('detail-content').innerHTML, /catalog/);
  assert.deepEqual(calls.find(([name]) => name === 'updateUrlForAnime'), [
    'updateUrlForAnime',
    null,
    { replace: true }
  ]);
});

test('Detail Experience deep link loads full catalog before showing a title', async () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="detail-content"></div>
  `);
  const { app, detail, calls } = createAppHarness({
    animeData: [],
    isFullDataLoaded: false,
    loadFullCatalog: async () => {
      app.animeData = [{ id: 'deep-link-title', title: 'Deep Link Title' }];
      return true;
    }
  });

  const loaded = await detail.handleDeepLink('deep-link-title');

  assert.equal(loaded, true);
  assert.equal(app.currentAnimeId, 'deep-link-title');
  assert.match(document.getElementById('detail-content').innerHTML, /Deep Link Title/);
  assert.equal(calls.some(([name]) => name === 'showAnimeDetail'), false);
});
