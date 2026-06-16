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
  return {
    state: {
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
      }
    },
    cache: {
      get store() {
        return app.detailCache;
      },
      get maxSize() {
        return app.detailCacheMaxSize;
      }
    },
    clock: {
      now: app.getPerformanceNow.bind(app)
    },
    events: {
      emit: app.emitAppEvent.bind(app)
    },
    routing: {
      getAnimeIdFromUrl: app.getAnimeIdFromUrl.bind(app),
      openAnime: app.showAnimeDetail.bind(app),
      closeDetail: app.closeDetailModal.bind(app),
      updateAnimeUrl: app.updateUrlForAnime.bind(app)
    },
    modal: {
      getDetailElements: () => {
        const modal = document.getElementById('detail-modal');
        return {
          modal,
          content: document.getElementById('detail-content'),
          modalContent: modal ? modal.querySelector('.modal-content') : null
        };
      },
      setVisible: (isOpen, options = {}) => app.setModalVisibility('detail-modal', isOpen, options)
    },
    catalog: {
      findAnime: (animeId) => app.animeData.find(anime => anime?.id === animeId) || null,
      findSnapshot: (animeId) => {
        const key = app.normalizeBookmarkId(animeId);
        return key ? app.getWatchlistSnapshot(key) : null;
      },
      hasFullDetail: app.hasFullAnimeDetail.bind(app),
      loadDetailChunk: app.loadAnimeDetailChunk.bind(app),
      loadFull: app.loadFullCatalog.bind(app),
      getSynopsis: app.getSynopsisForAnime.bind(app)
    },
    presentation: {
      renderSkeleton: app.renderDetailSkeleton.bind(app),
      renderError: renderDetailErrorState,
      renderContent: (anime, { synopsis = '' } = {}) => renderDetailContent(anime, {
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
      })
    },
    media: {
      cleanup: detailMedia.cleanup,
      refresh: detailMedia.refresh,
      setup: detailMedia.setup,
      stop: detailMedia.stop
    },
    reviews: {
      load: detailReviews.load
    },
    metadata: {
      forAnime: app.updateMetaForAnime.bind(app),
      forFilters: app.updateMetaForFilters.bind(app),
      reset: app.resetMetaToDefault.bind(app)
    },
    watchlist: {
      updateControls: app.updateWatchlistControls.bind(app)
    },
    prefetch: {
      updateObserving: app.updatePrefetchObserving.bind(app)
    }
  };
};

export { createDetailExperiencePort };
