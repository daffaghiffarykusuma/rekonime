import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailExperiencePort } from '../../js/detail-experience-port.ts';

test('Detail Experience port exposes a narrow adapter surface over App Shell', () => {
  const calls = [];
  const app = {
    detailCache: new Map(),
    detailCacheMaxSize: 2,
    currentAnimeId: '',
    animeData: [],
    isFullDataLoaded: false,
    trailerCleanup: null,
    closeDetailModal: (...args) => calls.push(['closeDetailModal', ...args]),
    emitAppEvent: (...args) => calls.push(['emitAppEvent', ...args]),
    escapeAttr: (value) => String(value),
    escapeHtml: (value) => String(value),
    getAnimeIdFromUrl: () => '',
    getEpisodeCount: () => 0,
    getImageDimensions: () => ({}),
    getImageFallbackAttrs: () => '',
    getLogger: () => null,
    getPerformanceNow: () => 1,
    getSynopsisForAnime: () => '',
    getWatchlistSnapshot: () => null,
    hasFullAnimeDetail: () => true,
    loadAnimeDetailChunk: async () => null,
    loadFullCatalog: async () => true,
    loadReviewsService: async () => ({}),
    normalizeBookmarkId: (value) => String(value),
    renderDetailSkeleton: () => '',
    renderFranchiseHubSection: () => '',
    renderReviewsLoading: () => '',
    renderSimilarAnimeSection: () => '',
    renderSynopsis: () => '',
    renderSynopsisLoading: () => '',
    renderTrailerSection: () => '',
    renderWatchlistControls: () => '',
    sanitizeClassList: (...classes) => classes.join(' '),
    sanitizeImageUrl: (value) => value,
    setModalVisibility: () => {},
    setupTrailerAutoplay: () => {},
    showAnimeDetail: () => {},
    stopTrailerPlayback: () => {},
    teardownTrailerObserver: () => {},
    teardownTrailerScrollListener: () => {},
    updateMetaForAnime: () => {},
    updateMetaForFilters: () => {},
    updatePrefetchObserving: () => {},
    updateUrlForAnime: () => {},
    updateWatchlistControls: () => {},
    buildImageSrcset: () => ({}),
    resetMetaToDefault: () => {}
  };

  const port = createDetailExperiencePort(app);
  port.state.currentAnimeId = 'show-1';
  port.events.emit('event', { id: 'show-1' });

  assert.equal(app.currentAnimeId, 'show-1');
  assert.deepEqual(Object.keys(port).sort(), [
    'cache',
    'catalog',
    'clock',
    'events',
    'media',
    'metadata',
    'modal',
    'prefetch',
    'presentation',
    'reviews',
    'routing',
    'state',
    'watchlist'
  ]);
  assert.equal(port.cache.store, app.detailCache);
  assert.equal(typeof port.presentation.renderContent, 'function');
  assert.equal(typeof port.presentation.renderError, 'function');
  assert.equal(typeof port.media.refresh, 'function');
  assert.equal(typeof port.reviews.load, 'function');
  assert.equal('renderDetailContent' in port, false);
  assert.equal('loadDetailReviews' in port, false);
  assert.deepEqual(calls, [['emitAppEvent', 'event', { id: 'show-1' }]]);
});
