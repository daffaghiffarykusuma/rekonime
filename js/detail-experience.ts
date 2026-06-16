// @ts-nocheck
import {
  setHTML
} from './security/trusted-types.js';

const normalizeDetailKey = (animeId) => String(animeId ?? '').trim();

const createDetailExperience = (port) => {
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
