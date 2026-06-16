import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailExperience } from '../../js/detail-experience.ts';
import { createDetailExperiencePort } from '../../js/detail-experience-port.ts';
import { setupDom } from '../helpers/dom.js';

const createAppHarness = (overrides = {}) => {
  const calls = [];
  const app = {
    detailCache: new Map(),
    detailCacheMaxSize: 2,
    currentAnimeId: null,
    animeData: [],
    isFullDataLoaded: false,
    trailerCleanup: null,
    getPerformanceNow: () => 100,
    emitAppEvent: (...args) => calls.push(['emitAppEvent', ...args]),
    getAnimeIdFromUrl: () => '',
    showAnimeDetail: (...args) => calls.push(['showAnimeDetail', ...args]),
    closeDetailModal: (...args) => calls.push(['closeDetailModal', ...args]),
    cleanupDetailMedia: () => calls.push(['cleanupDetailMedia']),
    refreshDetailMedia: (...args) => calls.push(['refreshDetailMedia', ...args]),
    setupDetailMedia: () => calls.push(['setupDetailMedia']),
    stopDetailMedia: () => calls.push(['stopDetailMedia']),
    stopTrailerPlayback: () => calls.push(['stopTrailerPlayback']),
    teardownTrailerObserver: () => calls.push(['teardownTrailerObserver']),
    teardownTrailerScrollListener: () => calls.push(['teardownTrailerScrollListener']),
    setupTrailerAutoplay: (...args) => calls.push(['setupTrailerAutoplay', ...args]),
    renderTrailerSection: () => '<section id="detail-trailer"></section>',
    renderSynopsis: (value) => `<p>${value}</p>`,
    loadReviewsService: async () => ({
      fetchReviews: async (...args) => {
        calls.push(['fetchReviews', ...args]);
        return { description: 'Remote synopsis', reviews: [] };
      },
      renderSynopsis: (value) => `<p>${value}</p>`,
      renderReviews: () => '<p>No reviews</p>'
    }),
    loadDetailReviews: (...args) => calls.push(['loadDetailReviews', ...args]),
    updateMetaForAnime: (...args) => calls.push(['updateMetaForAnime', ...args]),
    updateMetaForFilters: () => calls.push(['updateMetaForFilters']),
    getLogger: () => null,
    setModalVisibility: (...args) => calls.push(['setModalVisibility', ...args]),
    updateUrlForAnime: (...args) => calls.push(['updateUrlForAnime', ...args]),
    resetMetaToDefault: () => calls.push(['resetMetaToDefault']),
    renderDetailSkeleton: () => '<div class="skeleton"></div>',
    renderDetailErrorState: ({ reason }) => `<div class="error-message">${reason}</div>`,
    normalizeBookmarkId: (value) => String(value ?? '').trim(),
    getWatchlistSnapshot: () => null,
    hasFullAnimeDetail: () => true,
    loadAnimeDetailChunk: async () => null,
    getSynopsisForAnime: (anime) => anime.synopsis || '',
    renderSynopsisLoading: () => '<p>Loading synopsis</p>',
    renderFranchiseHubSection: () => '',
    renderReviewsLoading: () => '<p>Loading reviews</p>',
    getEpisodeCount: (anime) => anime.episodes?.length || anime.episodeCount || 0,
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
    getImageDimensions: () => ({ width: 150, height: 210 }),
    getImageFallbackAttrs: () => '',
    renderSimilarAnimeSection: () => '<div class="similar-empty"></div>',
    renderWatchlistControls: () => '<div class="watchlist-controls"></div>',
    renderDetailContent: (anime, { synopsis = '' } = {}) => `
      <h2>${app.escapeHtml(anime.title)}</h2>
      <div id="synopsis-section">${app.renderSynopsis(synopsis)}</div>
      <div id="community-reviews-section">${app.renderReviewsLoading()}</div>
    `,
    updateWatchlistControls: (...args) => calls.push(['updateWatchlistControls', ...args]),
    updatePrefetchObserving: () => calls.push(['updatePrefetchObserving']),
    loadFullCatalog: async () => false,
    ...overrides
  };

  return { app, calls, detail: createDetailExperience(createDetailExperiencePort(app)) };
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
  const { detail, calls } = createAppHarness({
    currentAnimeId: 'current',
    getAnimeIdFromUrl: () => 'next'
  });

  detail.syncWithUrl({ updateUrl: false });
  assert.deepEqual(calls[0], ['showAnimeDetail', 'next', { updateUrl: false }]);

  const closeHarness = createAppHarness({ currentAnimeId: 'current' });
  closeHarness.detail.syncWithUrl({ updateUrl: true });
  assert.deepEqual(closeHarness.calls[0], ['closeDetailModal', { updateUrl: true }]);
});

test('Detail Experience delegates trailer refresh to Detail Media', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <div id="community-reviews-section"></div>
  `);
  const animeData = [{ id: 'show-1', title: 'Show One' }];
  const { detail, calls } = createAppHarness({
    currentAnimeId: 'show-1',
    animeData
  });

  detail.refreshTrailerSection();

  assert.deepEqual(calls.slice(0, 4).map(([name]) => name), [
    'stopTrailerPlayback',
    'teardownTrailerObserver',
    'teardownTrailerScrollListener',
    'setupTrailerAutoplay'
  ]);
  assert.match(document.body.innerHTML, /detail-trailer/);
});

test('Detail Experience delegates community review loading to Detail Reviews', async () => {
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A' };
  const { detail, calls } = createAppHarness();

  await detail.loadCommunityReviews(anime, 'fallback');

  assert.deepEqual(calls[0], ['fetchReviews', 1, 'Anime A']);
});

test('Detail Experience delegates missing catalog title markup to Detail Error State', () => {
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
  assert.deepEqual(calls.at(-1), ['showAnimeDetail', 'deep-link-title', { updateUrl: false, skipModalOpen: true }]);
});
