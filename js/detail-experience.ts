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
import { CatalogPayload } from './services/catalog-payload.ts';

const DETAIL_ERROR_MESSAGES = {
  catalog: 'We could not find that anime in the current catalog.',
  deepLink: 'We could not find that anime. The link may be outdated or the catalog may have changed.'
};

const renderDetailErrorState = (reason = 'catalog') => `
  <div class="error-message">
    <h2>That title is not available</h2>
    <p>${DETAIL_ERROR_MESSAGES[reason] || DETAIL_ERROR_MESSAGES.catalog}</p>
    <button class="btn btn-primary detail-close-button" data-action="close-detail">Back to browsing</button>
  </div>
`;

const normalizeDetailKey = (animeId) => String(animeId ?? '').trim();

const renderUnavailableReviews = () => `
  <div class="community-reviews">
    <h3>Community Reviews</h3>
    <p class="no-reviews">Reviews are unavailable for this title.</p>
  </div>
`;

const renderFailedReviews = () => `
  <div class="community-reviews">
    <h3>Community Reviews</h3>
    <p class="no-reviews">Failed to load community reviews.</p>
  </div>
`;

const createDetailExperience = (app, dependencies = {}) => {
  const catalogRuntime = dependencies.catalogRuntime;
  const media = createDetailMedia({
    escapeAttr: app.escapeAttr.bind(app),
    shouldEmbedTrailers: app.shouldEmbedTrailers.bind(app),
    shouldAutoplayTrailers: app.shouldAutoplayTrailers.bind(app)
  });
  let reviewsServicePromise = null;
  let activeAnime = null;
  let activeSynopsis = '';
  const loadReviewsService = dependencies.loadReviewsService || (() => {
    if (!reviewsServicePromise) {
      reviewsServicePromise = import('./reviews.js')
        .then(module => module.ReviewsService)
        .catch((error) => {
          reviewsServicePromise = null;
          throw error;
        });
    }
    return reviewsServicePromise;
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
    getImageDimensions: (kind) => app.getImageProxyRuntime().getDimensions(kind),
    getImageFallbackAttrs: app.getImageFallbackAttrs.bind(app),
    getEpisodeCount: (anime) => CatalogPayload.getEpisodeCount(anime),
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
    const reviewsSection = document.getElementById('community-reviews-section');
    const synopsisSection = document.getElementById('synopsis-section');
    const parsedMalId = Number.parseInt(anime?.malId, 10);

    if (!Number.isFinite(parsedMalId)) {
      if (synopsisSection) {
        if (fallbackSynopsis) {
          setHTML(synopsisSection, app.renderSynopsis(fallbackSynopsis));
        } else {
          synopsisSection.replaceChildren();
        }
      }
      if (reviewsSection) setHTML(reviewsSection, renderUnavailableReviews());
      return { status: 'unavailable' };
    }

    try {
      const reviewsService = await loadReviewsService();
      const data = await reviewsService.fetchReviews(parsedMalId, anime.title);
      if (app.currentAnimeId !== anime.id) return { status: 'stale' };

      if (synopsisSection) {
        const synopsis = data.description || fallbackSynopsis;
        if (synopsis) {
          setHTML(synopsisSection, reviewsService.renderSynopsis(synopsis));
        } else {
          synopsisSection.replaceChildren();
        }
      }
      if (reviewsSection) {
        setHTML(reviewsSection, reviewsService.renderReviewsSection(data, 'positive'));
        reviewsService.initTabSwitching(data);
      }
      if (data.description) app.updateMetaForAnime(anime, data.description);
      return { status: 'loaded' };
    } catch (error) {
      if (app.currentAnimeId !== anime.id) return { status: 'stale' };
      const logger = app.getLogger();
      if (logger?.error) {
        logger.error('Failed to load reviews', { error });
      } else {
        console.error('Failed to load reviews:', error);
      }
      if (synopsisSection && !fallbackSynopsis) synopsisSection.replaceChildren();
      if (reviewsSection) {
        let errorMarkup = renderFailedReviews();
        try {
          const reviewsService = await loadReviewsService();
          errorMarkup = reviewsService.renderReviewsSection(
            { positive: [], neutral: [], negative: [], description: '', error: true },
            'positive'
          );
        } catch {
          // Keep generic markup when the Reviews implementation cannot load.
        }
        setHTML(reviewsSection, errorMarkup);
      }
      return { status: 'failed' };
    }
  };

  const refreshCommunityReviews = () => {
    const anime = activeAnime?.id === app.currentAnimeId
      ? activeAnime
      : app.animeData.find(entry => entry?.id === app.currentAnimeId) || null;
    if (!anime) return Promise.resolve({ status: 'unavailable' });
    return loadCommunityReviews(anime, activeSynopsis || app.getSynopsisForAnime(anime));
  };

  const close = ({ updateUrl = true } = {}) => {
    app.getRuntimeCapabilities().setModalVisibility('detail-modal', false);
    media.cleanup();
    app.currentAnimeId = null;
    activeAnime = null;
    activeSynopsis = '';

    if (updateUrl) {
      app.updateUrlForAnime(null);
    }
    app.updateMetaForFilters();
  };

  const handleDeepLink = async (animeId) => {
    const { modal, content } = getDetailElements();

    if (!modal || !content) return false;

    setHTML(content, renderDetailSkeleton());
    app.getRuntimeCapabilities().setModalVisibility('detail-modal', true, {
      initialFocusSelector: '#close-detail'
    });

    let anime = app.animeData.find(anime => anime?.id === animeId) || null;

    if (!anime && !app.isFullDataLoaded) {
      const fullLoaded = await catalogRuntime.loadFullCatalog();
      if (fullLoaded) {
        anime = app.animeData.find(entry => entry?.id === animeId) || null;
      }
    }

    if (anime) {
      open(animeId, { updateUrl: false, skipModalOpen: true });
      return true;
    }

    setHTML(content, renderDetailErrorState('deepLink'));
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
      app.getRuntimeCapabilities().setModalVisibility('detail-modal', true, {
        initialFocusSelector: '#close-detail'
      });
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
      setHTML(content, renderDetailErrorState());
      reportModalOpened({ status: 'not_found' });
      return;
    }

    app.currentAnimeId = anime.id;
    activeAnime = anime;

    if (updateUrl) {
      app.updateUrlForAnime(anime.id);
    }

    if (!app.hasFullAnimeDetail(anime)) {
      catalogRuntime.loadAnimeDetailChunk(anime.id).then((detailAnime) => {
        if (!detailAnime || app.currentAnimeId !== anime.id) return;
        open(anime.id, { updateUrl: false, skipModalOpen: true });
      });
    }

    const synopsis = app.getSynopsisForAnime(anime);
    activeSynopsis = synopsis;
    if (hasCachedDetail) {
      app.updateWatchlistControls(anime.id);
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      content.scrollTop = 0;
      app.updateMetaForAnime(anime, synopsis);
      media.setup(modalContent);
      void refreshCommunityReviews();
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

    void refreshCommunityReviews();
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
    refreshCommunityReviews,
    open,
    close,
    handleDeepLink
  };
};

export { createDetailExperience };
