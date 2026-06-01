// @ts-nocheck
import {
  setHTML
} from './security/trusted-types.js';

const normalizeDetailKey = (animeId) => String(animeId ?? '').trim();

const createDetailExperience = (app) => {
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
        app.showAnimeDetail(animeId, { updateUrl });
      }
      return;
    }

    if (app.currentAnimeId) {
      app.closeDetailModal({ updateUrl });
    }
  };

  const refreshTrailerSection = () => {
    app.refreshDetailMedia({
      currentAnimeId: app.currentAnimeId,
      animeData: app.animeData
    });
  };

  const loadCommunityReviews = async (anime, fallbackSynopsis = '') => {
    return app.loadDetailReviews(anime, fallbackSynopsis);
  };

  const close = ({ updateUrl = true } = {}) => {
    app.setModalVisibility('detail-modal', false);
    app.cleanupDetailMedia();
    app.currentAnimeId = null;

    if (updateUrl) {
      app.updateUrlForAnime(null);
    }
    app.updateMetaForFilters();
  };

  const handleDeepLink = async (animeId) => {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');

    if (!modal || !content) return false;

    setHTML(content, app.renderDetailSkeleton());
    app.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });

    let anime = app.animeData.find(a => a.id === animeId);

    if (!anime && !app.isFullDataLoaded) {
      const fullLoaded = await app.loadFullCatalog();
      if (fullLoaded) {
        anime = app.animeData.find(a => a.id === animeId);
      }
    }

    if (anime) {
      app.showAnimeDetail(animeId, { updateUrl: false, skipModalOpen: true });
      return true;
    }

    setHTML(content, app.renderDetailErrorState({ reason: 'deepLink' }));
    return false;
  };

  const open = (animeId, { updateUrl = true, skipModalOpen = false } = {}) => {
    const renderStart = app.getPerformanceNow();
    app.stopDetailMedia();

    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    const modalContent = modal ? modal.querySelector('.modal-content') : null;

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
      setHTML(content, app.renderDetailSkeleton());
    }
    if (!skipModalOpen) {
      app.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });
    }

    let anime = app.animeData.find(a => a.id === animeId);
    if (!anime) {
      const key = app.normalizeBookmarkId(animeId);
      if (key) {
        const cached = app.getWatchlistSnapshot(key);
        if (cached) {
          anime = cached;
        }
      }
    }
    if (!anime) {
      if (updateUrl) {
        app.updateUrlForAnime(null, { replace: true });
      }
      app.resetMetaToDefault();
      setHTML(content, app.renderDetailErrorState({ reason: 'catalog' }));
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
        app.showAnimeDetail(anime.id, { updateUrl: false, skipModalOpen: true });
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
      app.setupDetailMedia(modalContent);
      loadCommunityReviews(anime, synopsis);
      app.updatePrefetchObserving();
      reportModalOpened({ status: 'ok' });
      return;
    }

    setHTML(content, app.renderDetailContent(anime, { synopsis }));

    cache(anime.id, content.innerHTML);
    app.updateWatchlistControls(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    app.updateMetaForAnime(anime, synopsis);
    app.setupDetailMedia(modalContent);

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
    loadCommunityReviews,
    open,
    close,
    handleDeepLink
  };
};

export { createDetailExperience };
