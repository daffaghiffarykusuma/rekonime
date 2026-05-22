import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailExperience } from '../../js/detail-experience.js';
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
    getAnimeIdFromUrl: () => '',
    showAnimeDetail: (...args) => calls.push(['showAnimeDetail', ...args]),
    closeDetailModal: (...args) => calls.push(['closeDetailModal', ...args]),
    stopTrailerPlayback: () => calls.push(['stopTrailerPlayback']),
    teardownTrailerObserver: () => calls.push(['teardownTrailerObserver']),
    teardownTrailerScrollListener: () => calls.push(['teardownTrailerScrollListener']),
    renderTrailerSection: () => '',
    setupTrailerAutoplay: () => calls.push(['setupTrailerAutoplay']),
    renderSynopsis: (value) => `<p>${value}</p>`,
    loadReviewsService: async () => ({
      fetchReviews: async () => ({ description: 'remote synopsis', positive: [], neutral: [], negative: [] }),
      renderSynopsis: (value) => `<p>${value}</p>`,
      renderReviewsSection: () => '<section class="reviews">Reviews</section>',
      initTabSwitching: () => calls.push(['initTabSwitching'])
    }),
    updateMetaForAnime: (...args) => calls.push(['updateMetaForAnime', ...args]),
    updateMetaForFilters: () => calls.push(['updateMetaForFilters']),
    getLogger: () => null,
    setModalVisibility: (...args) => calls.push(['setModalVisibility', ...args]),
    updateUrlForAnime: (...args) => calls.push(['updateUrlForAnime', ...args]),
    renderDetailSkeleton: () => '<div class="skeleton"></div>',
    loadFullCatalog: async () => false,
    ...overrides
  };

  return { app, calls, detail: createDetailExperience(app) };
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

test('Detail Experience syncs URL anime state to open or close actions', () => {
  const { app, detail, calls } = createAppHarness({
    currentAnimeId: 'current',
    getAnimeIdFromUrl: () => 'next'
  });

  detail.syncWithUrl({ updateUrl: false });
  assert.deepEqual(calls[0], ['showAnimeDetail', 'next', { updateUrl: false }]);

  calls.length = 0;
  app.currentAnimeId = 'current';
  app.getAnimeIdFromUrl = () => '';
  detail.syncWithUrl({ updateUrl: true });
  assert.deepEqual(calls[0], ['closeDetailModal', { updateUrl: true }]);
});

test('Detail Experience ignores stale review responses after the active anime changes', async () => {
  setupDom(`
    <div id="synopsis-section"></div>
    <div id="community-reviews-section"></div>
  `);
  const { detail, calls } = createAppHarness({
    currentAnimeId: 'other'
  });

  await detail.loadCommunityReviews({ id: 'anime-a', malId: 1, title: 'Anime A' }, 'fallback');

  assert.equal(document.getElementById('community-reviews-section').innerHTML, '');
  assert.equal(calls.some(([name]) => name === 'initTabSwitching'), false);
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
