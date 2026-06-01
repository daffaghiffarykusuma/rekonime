// @ts-nocheck
import { renderDetailContent } from './detail-presentation.ts';
import { createDetailMediaAdapter } from './detail-media.ts';
import { createDetailReviewsAdapter } from './detail-reviews.ts';
import { renderDetailErrorState } from './detail-error-state.ts';

const createDetailExperiencePort = (app) => {
  const detailMedia = createDetailMediaAdapter(app);
  const detailReviews = createDetailReviewsAdapter({
    getCurrentAnimeId: () => app.currentAnimeId,
    getLogger: app.getLogger.bind(app),
    loadReviewsService: app.loadReviewsService.bind(app),
    renderSynopsis: app.renderSynopsis.bind(app),
    updateMetaForAnime: app.updateMetaForAnime.bind(app)
  });
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
    cleanupDetailMedia: (...args) => detailMedia.cleanup(...args),
    closeDetailModal: (...args) => app.closeDetailModal(...args),
    emitAppEvent: (...args) => app.emitAppEvent(...args),
    escapeAttr: (...args) => app.escapeAttr(...args),
    escapeHtml: (...args) => app.escapeHtml(...args),
    getAnimeIdFromUrl: (...args) => app.getAnimeIdFromUrl(...args),
    getEpisodeCount: (...args) => app.getEpisodeCount(...args),
    getImageDimensions: (...args) => app.getImageDimensions(...args),
    getImageFallbackAttrs: (...args) => app.getImageFallbackAttrs(...args),
    getPerformanceNow: (...args) => app.getPerformanceNow(...args),
    getSynopsisForAnime: (...args) => app.getSynopsisForAnime(...args),
    getWatchlistSnapshot: (...args) => app.getWatchlistSnapshot(...args),
    hasFullAnimeDetail: (...args) => app.hasFullAnimeDetail(...args),
    loadAnimeDetailChunk: (...args) => app.loadAnimeDetailChunk(...args),
    loadFullCatalog: (...args) => app.loadFullCatalog(...args),
    loadDetailReviews: (...args) => detailReviews.load(...args),
    normalizeBookmarkId: (...args) => app.normalizeBookmarkId(...args),
    refreshDetailMedia: (...args) => detailMedia.refresh(...args),
    renderDetailErrorState,
    renderDetailContent: (anime, { synopsis = '' } = {}) => renderDetailContent(anime, {
      synopsis,
      escapeHtml: app.escapeHtml.bind(app),
      escapeAttr: app.escapeAttr.bind(app),
      sanitizeImageUrl: app.sanitizeImageUrl.bind(app),
      sanitizeClassList: app.sanitizeClassList.bind(app),
      buildImageSrcset: app.buildImageSrcset.bind(app),
      getImageDimensions: app.getImageDimensions.bind(app),
      getImageFallbackAttrs: app.getImageFallbackAttrs.bind(app),
      getEpisodeCount: app.getEpisodeCount.bind(app),
      renderSynopsis: app.renderSynopsis.bind(app),
      renderSynopsisLoading: app.renderSynopsisLoading.bind(app),
      renderFranchiseHubSection: app.renderFranchiseHubSection.bind(app),
      renderTrailerSection: app.renderTrailerSection.bind(app),
      renderReviewsLoading: app.renderReviewsLoading.bind(app),
      renderSimilarAnimeSection: app.renderSimilarAnimeSection.bind(app),
      renderWatchlistControls: app.renderWatchlistControls.bind(app)
    }),
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
    setupDetailMedia: (...args) => detailMedia.setup(...args),
    showAnimeDetail: (...args) => app.showAnimeDetail(...args),
    stopDetailMedia: (...args) => detailMedia.stop(...args),
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
