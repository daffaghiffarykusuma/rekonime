// @ts-nocheck

const createDetailExperiencePort = (app) => {
  const port = {
    get detailCache() {
      return app.detailCache;
    },
    get detailCacheMaxSize() {
      return app.detailCacheMaxSize;
    },
    get currentAnimeId() {
      return app.currentAnimeId;
    },
    set currentAnimeId(value) {
      app.currentAnimeId = value;
    },
    get animeData() {
      return app.animeData;
    },
    get isFullDataLoaded() {
      return app.isFullDataLoaded;
    },
    get trailerCleanup() {
      return app.trailerCleanup;
    },
    set trailerCleanup(value) {
      app.trailerCleanup = value;
    },
    closeDetailModal: (...args) => app.closeDetailModal(...args),
    emitAppEvent: (...args) => app.emitAppEvent(...args),
    escapeAttr: (...args) => app.escapeAttr(...args),
    escapeHtml: (...args) => app.escapeHtml(...args),
    getAnimeIdFromUrl: (...args) => app.getAnimeIdFromUrl(...args),
    getCardDecisionData: (...args) => app.getCardDecisionData(...args),
    getEpisodeCount: (...args) => app.getEpisodeCount(...args),
    getImageDimensions: (...args) => app.getImageDimensions(...args),
    getImageFallbackAttrs: (...args) => app.getImageFallbackAttrs(...args),
    getLogger: (...args) => app.getLogger(...args),
    getPerformanceNow: (...args) => app.getPerformanceNow(...args),
    getSynopsisForAnime: (...args) => app.getSynopsisForAnime(...args),
    getWatchlistSnapshot: (...args) => app.getWatchlistSnapshot(...args),
    hasFullAnimeDetail: (...args) => app.hasFullAnimeDetail(...args),
    loadAnimeDetailChunk: (...args) => app.loadAnimeDetailChunk(...args),
    loadFullCatalog: (...args) => app.loadFullCatalog(...args),
    loadReviewsService: (...args) => app.loadReviewsService(...args),
    normalizeBookmarkId: (...args) => app.normalizeBookmarkId(...args),
    renderDetailSkeleton: (...args) => app.renderDetailSkeleton(...args),
    renderFranchiseHubSection: (...args) => app.renderFranchiseHubSection(...args),
    renderReviewsLoading: (...args) => app.renderReviewsLoading(...args),
    renderSimilarAnimeSection: (...args) => app.renderSimilarAnimeSection(...args),
    renderSynopsis: (...args) => app.renderSynopsis(...args),
    renderSynopsisLoading: (...args) => app.renderSynopsisLoading(...args),
    renderTrailerSection: (...args) => app.renderTrailerSection(...args),
    renderWatchlistControls: (...args) => app.renderWatchlistControls(...args),
    sanitizeClassList: (...args) => app.sanitizeClassList(...args),
    sanitizeImageUrl: (...args) => app.sanitizeImageUrl(...args),
    setModalVisibility: (...args) => app.setModalVisibility(...args),
    setupTrailerAutoplay: (...args) => app.setupTrailerAutoplay(...args),
    showAnimeDetail: (...args) => app.showAnimeDetail(...args),
    stopTrailerPlayback: (...args) => app.stopTrailerPlayback(...args),
    teardownTrailerObserver: (...args) => app.teardownTrailerObserver(...args),
    teardownTrailerScrollListener: (...args) => app.teardownTrailerScrollListener(...args),
    updateMetaForAnime: (...args) => app.updateMetaForAnime(...args),
    updateMetaForFilters: (...args) => app.updateMetaForFilters(...args),
    updatePrefetchObserving: (...args) => app.updatePrefetchObserving(...args),
    updateUrlForAnime: (...args) => app.updateUrlForAnime(...args),
    updateWatchlistControls: (...args) => app.updateWatchlistControls(...args),
    buildImageSrcset: (...args) => app.buildImageSrcset(...args),
    resetMetaToDefault: (...args) => app.resetMetaToDefault(...args)
  };

  return port;
};

export { createDetailExperiencePort };
