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
import { createDetailMedia } from './detail-media.ts';
import { createDetailReviewsAdapter } from './detail-reviews.ts';
import { renderDetailErrorState } from './detail-error-state.ts';

const normalizeDetailKey = (animeId) => String(animeId ?? '').trim();

const createDetailExperience = (app) => {
  const media = createDetailMedia({
    escapeAttr: app.escapeAttr.bind(app),
    shouldEmbedTrailers: app.shouldEmbedTrailers.bind(app),
    shouldAutoplayTrailers: app.shouldAutoplayTrailers.bind(app)
  });
  const reviews = createDetailReviewsAdapter({
    getCurrentAnimeId: () => app.currentAnimeId,
    getLogger: app.getLogger.bind(app),
    loadReviewsService: app.loadReviewsService.bind(app),
    renderSynopsis: app.renderSynopsis.bind(app),
    updateMetaForAnime: app.updateMetaForAnime.bind(app)
  });
  const getDetailElements = () => {
    const modal = document.getElementById('detail-modal');
    return {
      modal,
      content: document.getElementById('detail-content'),
      modalContent: modal?.querySelector('.modal-content') || null
    };
  };
  const renderContent = (anime, synopsis = '') => renderDetailContent(anime, {
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
    renderTrailerSection: media.render,
    renderReviewsLoading,
    renderSimilarAnimeSection: app.renderSimilarAnimeSection.bind(app),
    renderWatchlistControls: app.renderWatchlistControls.bind(app)
  });

  const isCached = (animeId) => {
    const key = normalizeDetailKey(animeId);
    if (!key) return false;
    return app.detailCache.has(key);
  };

  const getCached = (animeId) => {
    const key = normalizeDetailKey(animeId);
    if (!key) return '';
    const entry = app.detailCache.get(key);
    if (!entry) return '';
    app.detailCache.delete(key);
    app.detailCache.set(key, entry);
    return entry;
  };

  const cache = (animeId, html) => {
    const key = normalizeDetailKey(animeId);
    if (!key || !html) return;
    if (app.detailCache.has(key)) {
      app.detailCache.delete(key);
    }
    while (app.detailCache.size >= app.detailCacheMaxSize) {
      const firstKey = app.detailCache.keys().next().value;
      if (firstKey) {
        app.detailCache.delete(firstKey);
      } else {
        break;
      }
    }
    app.detailCache.set(key, html);
  };

  const syncWithUrl = ({ updateUrl = true } = {}) => {
    const animeId = app.getAnimeIdFromUrl();
    if (animeId) {
      if (app.currentAnimeId !== animeId) {
        open(animeId, { updateUrl });
      }
      return;
    }

    if (app.currentAnimeId) {
      close({ updateUrl });
    }
  };

  const refreshTrailerSection = () => {
    media.refresh({
      currentAnimeId: app.currentAnimeId,
      animeData: app.animeData
    });
  };

  const loadCommunityReviews = async (anime, fallbackSynopsis = '') => {
    return reviews.load(anime, fallbackSynopsis);
  };

  const close = ({ updateUrl = true } = {}) => {
    app.setModalVisibility('detail-modal', false);
    media.cleanup();
    app.currentAnimeId = null;

    if (updateUrl) {
      app.updateUrlForAnime(null);
    }
    app.updateMetaForFilters();
  };

  const handleDeepLink = async (animeId) => {
    const { modal, content } = getDetailElements();

    if (!modal || !content) return false;

    setHTML(content, renderDetailSkeleton());
    app.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });

    let anime = app.animeData.find(anime => anime?.id === animeId) || null;

    if (!anime && !app.isFullDataLoaded) {
      const fullLoaded = await app.loadFullCatalog();
      if (fullLoaded) {
        anime = app.animeData.find(entry => entry?.id === animeId) || null;
      }
    }

    if (anime) {
      open(animeId, { updateUrl: false, skipModalOpen: true });
      return true;
    }

    setHTML(content, renderDetailErrorState({ reason: 'deepLink' }));
    return false;
  };

  const open = (animeId, { updateUrl = true, skipModalOpen = false } = {}) => {
    const renderStart = app.getPerformanceNow();
    media.cleanup();

    const { modal, content, modalContent } = getDetailElements();

    if (!modal || !content) return;

    const cachedDetail = getCached(animeId);
    const hasCachedDetail = Boolean(cachedDetail);
    const reportModalOpened = (detail = {}) => {
      app.emitAppEvent('rekonime:modal-opened', {
        animeId,
        durationMs: Math.round(app.getPerformanceNow() - renderStart),
        cached: hasCachedDetail,
        ...detail
      });
    };

    if (hasCachedDetail) {
      setHTML(content, cachedDetail);
    } else if (!skipModalOpen) {
      setHTML(content, renderDetailSkeleton());
    }
    if (!skipModalOpen) {
      app.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });
    }

    let anime = app.animeData.find(entry => entry?.id === animeId) || null;
    if (!anime) {
      const key = app.normalizeBookmarkId(animeId);
      const cached = key ? app.getWatchlistSnapshot(key) : null;
      if (cached) {
        anime = cached;
      }
    }
    if (!anime) {
      if (updateUrl) {
        app.updateUrlForAnime(null, { replace: true });
      }
      app.resetMetaToDefault();
      setHTML(content, renderDetailErrorState({ reason: 'catalog' }));
      reportModalOpened({ status: 'not_found' });
      return;
    }

    app.currentAnimeId = anime.id;

    if (updateUrl) {
      app.updateUrlForAnime(anime.id);
    }

    if (!app.hasFullAnimeDetail(anime)) {
      app.loadAnimeDetailChunk(anime.id).then((detailAnime) => {
        if (!detailAnime || app.currentAnimeId !== anime.id) return;
        open(anime.id, { updateUrl: false, skipModalOpen: true });
      });
    }

    const synopsis = app.getSynopsisForAnime(anime);
    if (hasCachedDetail) {
      app.updateWatchlistControls(anime.id);
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      content.scrollTop = 0;
      app.updateMetaForAnime(anime, synopsis);
      media.setup(modalContent);
      loadCommunityReviews(anime, synopsis);
      app.updatePrefetchObserving();
      reportModalOpened({ status: 'ok' });
      return;
    }

    setHTML(content, renderContent(anime, synopsis));

    cache(anime.id, content.innerHTML);
    app.updateWatchlistControls(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    app.updateMetaForAnime(anime, synopsis);
    media.setup(modalContent);

    loadCommunityReviews(anime, synopsis);
    app.updatePrefetchObserving();
    reportModalOpened({ status: 'ok' });
  };

  return {
    isCached,
    getCached,
    cache,
    syncWithUrl,
    refreshTrailerSection,
    toggleTrailerPlayback: media.toggle,
    loadCommunityReviews,
    open,
    close,
    handleDeepLink
  };
};

export { createDetailExperience };
