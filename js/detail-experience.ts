// @ts-nocheck
import {
  setHTML
} from './security/trusted-types.js';
import {
  renderDetailContent,
  renderDetailSkeleton,
  renderReviewsLoading,
  renderSynopsisLoading
} from './detail-presentation.ts';
import { createDetailMediaAdapter } from './detail-media.ts';
import { createDetailReviewsAdapter } from './detail-reviews.ts';
import { renderDetailErrorState } from './detail-error-state.ts';

const normalizeDetailKey = (animeId) => String(animeId ?? '').trim();

const createDetailExperience = (app) => {
  const media = createDetailMediaAdapter(app);
  const reviews = createDetailReviewsAdapter({
    getCurrentAnimeId: () => app.currentAnimeId,
    getLogger: app.getLogger.bind(app),
    loadReviewsService: app.loadReviewsService.bind(app),
    renderSynopsis: app.renderSynopsis.bind(app),
    updateMetaForAnime: app.updateMetaForAnime.bind(app)
  });
  const port = {
    state: {
      get currentAnimeId() { return app.currentAnimeId; },
      set currentAnimeId(value) { app.currentAnimeId = value; },
      get animeData() { return app.animeData; },
      get isFullDataLoaded() { return app.isFullDataLoaded; }
    },
    cache: {
      get store() { return app.detailCache; },
      get maxSize() { return app.detailCacheMaxSize; }
    },
    clock: { now: app.getPerformanceNow.bind(app) },
    events: { emit: app.emitAppEvent.bind(app) },
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
          modalContent: modal?.querySelector('.modal-content') || null
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
      renderSkeleton: renderDetailSkeleton,
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
        renderSynopsisLoading,
        renderFranchiseHubSection: app.renderFranchiseHubSection.bind(app),
        renderTrailerSection: app.renderTrailerSection.bind(app),
        renderReviewsLoading,
        renderSimilarAnimeSection: app.renderSimilarAnimeSection.bind(app),
        renderWatchlistControls: app.renderWatchlistControls.bind(app)
      })
    },
    media,
    reviews: { load: reviews.load },
    metadata: {
      forAnime: app.updateMetaForAnime.bind(app),
      forFilters: app.updateMetaForFilters.bind(app),
      reset: app.resetMetaToDefault.bind(app)
    },
    watchlist: { updateControls: app.updateWatchlistControls.bind(app) },
    prefetch: { updateObserving: app.updatePrefetchObserving.bind(app) }
  };

  const isCached = (animeId) => {
    const key = normalizeDetailKey(animeId);
    if (!key) return false;
    return port.cache.store.has(key);
  };

  const getCached = (animeId) => {
    const key = normalizeDetailKey(animeId);
    if (!key) return '';
    const entry = port.cache.store.get(key);
    if (!entry) return '';
    port.cache.store.delete(key);
    port.cache.store.set(key, entry);
    return entry;
  };

  const cache = (animeId, html) => {
    const key = normalizeDetailKey(animeId);
    if (!key || !html) return;
    if (port.cache.store.has(key)) {
      port.cache.store.delete(key);
    }
    while (port.cache.store.size >= port.cache.maxSize) {
      const firstKey = port.cache.store.keys().next().value;
      if (firstKey) {
        port.cache.store.delete(firstKey);
      } else {
        break;
      }
    }
    port.cache.store.set(key, html);
  };

  const syncWithUrl = ({ updateUrl = true } = {}) => {
    const animeId = port.routing.getAnimeIdFromUrl();
    if (animeId) {
      if (port.state.currentAnimeId !== animeId) {
        port.routing.openAnime(animeId, { updateUrl });
      }
      return;
    }

    if (port.state.currentAnimeId) {
      port.routing.closeDetail({ updateUrl });
    }
  };

  const refreshTrailerSection = () => {
    port.media.refresh({
      currentAnimeId: port.state.currentAnimeId,
      animeData: port.state.animeData
    });
  };

  const loadCommunityReviews = async (anime, fallbackSynopsis = '') => {
    return port.reviews.load(anime, fallbackSynopsis);
  };

  const close = ({ updateUrl = true } = {}) => {
    port.modal.setVisible(false);
    port.media.cleanup();
    port.state.currentAnimeId = null;

    if (updateUrl) {
      port.routing.updateAnimeUrl(null);
    }
    port.metadata.forFilters();
  };

  const handleDeepLink = async (animeId) => {
    const { modal, content } = port.modal.getDetailElements();

    if (!modal || !content) return false;

    setHTML(content, port.presentation.renderSkeleton());
    port.modal.setVisible(true, { initialFocusSelector: '#close-detail' });

    let anime = port.catalog.findAnime(animeId);

    if (!anime && !port.state.isFullDataLoaded) {
      const fullLoaded = await port.catalog.loadFull();
      if (fullLoaded) {
        anime = port.catalog.findAnime(animeId);
      }
    }

    if (anime) {
      port.routing.openAnime(animeId, { updateUrl: false, skipModalOpen: true });
      return true;
    }

    setHTML(content, port.presentation.renderError({ reason: 'deepLink' }));
    return false;
  };

  const open = (animeId, { updateUrl = true, skipModalOpen = false } = {}) => {
    const renderStart = port.clock.now();
    port.media.stop();

    const { modal, content, modalContent } = port.modal.getDetailElements();

    if (!modal || !content) return;

    const cachedDetail = getCached(animeId);
    const hasCachedDetail = Boolean(cachedDetail);
    const reportModalOpened = (detail = {}) => {
      port.events.emit('rekonime:modal-opened', {
        animeId,
        durationMs: Math.round(port.clock.now() - renderStart),
        cached: hasCachedDetail,
        ...detail
      });
    };

    if (hasCachedDetail) {
      setHTML(content, cachedDetail);
    } else if (!skipModalOpen) {
      setHTML(content, port.presentation.renderSkeleton());
    }
    if (!skipModalOpen) {
      port.modal.setVisible(true, { initialFocusSelector: '#close-detail' });
    }

    let anime = port.catalog.findAnime(animeId);
    if (!anime) {
      const cached = port.catalog.findSnapshot(animeId);
      if (cached) {
        anime = cached;
      }
    }
    if (!anime) {
      if (updateUrl) {
        port.routing.updateAnimeUrl(null, { replace: true });
      }
      port.metadata.reset();
      setHTML(content, port.presentation.renderError({ reason: 'catalog' }));
      reportModalOpened({ status: 'not_found' });
      return;
    }

    port.state.currentAnimeId = anime.id;

    if (updateUrl) {
      port.routing.updateAnimeUrl(anime.id);
    }

    if (!port.catalog.hasFullDetail(anime)) {
      port.catalog.loadDetailChunk(anime.id).then((detailAnime) => {
        if (!detailAnime || port.state.currentAnimeId !== anime.id) return;
        port.routing.openAnime(anime.id, { updateUrl: false, skipModalOpen: true });
      });
    }

    const synopsis = port.catalog.getSynopsis(anime);
    if (hasCachedDetail) {
      port.watchlist.updateControls(anime.id);
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      content.scrollTop = 0;
      port.metadata.forAnime(anime, synopsis);
      port.media.setup(modalContent);
      loadCommunityReviews(anime, synopsis);
      port.prefetch.updateObserving();
      reportModalOpened({ status: 'ok' });
      return;
    }

    setHTML(content, port.presentation.renderContent(anime, { synopsis }));

    cache(anime.id, content.innerHTML);
    port.watchlist.updateControls(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    port.metadata.forAnime(anime, synopsis);
    port.media.setup(modalContent);

    loadCommunityReviews(anime, synopsis);
    port.prefetch.updateObserving();
    reportModalOpened({ status: 'ok' });
  };

  return {
    isCached,
    getCached,
    cache,
    syncWithUrl,
    refreshTrailerSection,
    loadCommunityReviews,
    open,
    close,
    handleDeepLink
  };
};

export { createDetailExperience };
