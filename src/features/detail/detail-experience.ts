// @ts-nocheck
import {
  setHTML
} from '../../shared/security/trusted-types.js';
import { CatalogPayload } from '../catalog/catalog-payload.ts';

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
  let presentation;
  let media;
  let viewPromise;
  let session = null;
  let reviewRequest = 0;
  const detailCache = new Map();
  const cacheMaxSize = dependencies.cacheMaxSize || 10;
  const loadView = dependencies.loadView || (() => Promise.all([
    import('./detail-presentation.ts'), import('./detail-media.ts')
  ]).then(([presentation, { createDetailMedia }]) => ({ presentation, createDetailMedia })));
  const ensureView = () => {
    if (!viewPromise) {
      viewPromise = loadView().then(view => {
        presentation = view.presentation;
        media = view.createDetailMedia({
          escapeAttr: app.escapeAttr.bind(app),
          shouldEmbedTrailers: app.shouldEmbedTrailers.bind(app),
          shouldAutoplayTrailers: app.shouldAutoplayTrailers.bind(app)
        });
      }).catch(error => { viewPromise = null; throw error; });
    }
    return viewPromise;
  };
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
  const renderContent = (anime, synopsis = '') => presentation.renderDetailContent(anime, {
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
    renderSynopsisLoading: presentation.renderSynopsisLoading,
    renderFranchiseHubSection: app.renderFranchiseHubSection.bind(app),
    renderTrailerSection: media.render,
    renderReviewsLoading: presentation.renderReviewsLoading,
    renderSimilarAnimeSection: app.renderSimilarAnimeSection.bind(app),
    renderWatchlistControls: app.renderWatchlistControls.bind(app)
  });

  const getCached = (animeId) => {
    const key = normalizeDetailKey(animeId);
    if (!key) return '';
    const entry = detailCache.get(key);
    if (!entry) return '';
    detailCache.delete(key);
    detailCache.set(key, entry);
    return entry;
  };

  const cache = (animeId, html) => {
    const key = normalizeDetailKey(animeId);
    if (!key || !html) return;
    if (detailCache.has(key)) {
      detailCache.delete(key);
    }
    while (detailCache.size >= cacheMaxSize) {
      const firstKey = detailCache.keys().next().value;
      if (firstKey) {
        detailCache.delete(firstKey);
      } else {
        break;
      }
    }
    detailCache.set(key, html);
  };

  const syncWithUrl = ({ updateUrl = true } = {}) => {
    const animeId = app.getAnimeIdFromUrl();
    if (animeId) {
      if (session?.animeId !== animeId) {
        return open(animeId, { updateUrl, deepLink: true });
      }
      return;
    }

    if (session?.animeId) {
      return close({ updateUrl });
    }
  };

  const refreshTrailerSection = () => {
    if (activeAnime) media?.refresh({ currentAnimeId: activeAnime.id, animeData: [activeAnime] });
  };

  const loadCommunityReviews = async (anime, fallbackSynopsis = '') => {
    const owner = session;
    const request = ++reviewRequest;
    const isCurrent = () => owner === session && request === reviewRequest;
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
      if (!isCurrent()) return { status: 'stale' };
      const data = await reviewsService.fetchReviews(parsedMalId, anime.title);
      if (!isCurrent()) return { status: 'stale' };

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
      if (!isCurrent()) return { status: 'stale' };
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
          if (!isCurrent()) return { status: 'stale' };
          errorMarkup = reviewsService.renderReviewsSection(
            { positive: [], neutral: [], negative: [], description: '', error: true },
            'positive'
          );
        } catch {
          // Keep generic markup when the Reviews implementation cannot load.
        }
        if (!isCurrent()) return { status: 'stale' };
        setHTML(reviewsSection, errorMarkup);
      }
      return { status: 'failed' };
    }
  };

  const refreshCommunityReviews = () => {
    const anime = activeAnime;
    if (!anime) return Promise.resolve({ status: 'unavailable' });
    return loadCommunityReviews(anime, activeSynopsis || app.getSynopsisForAnime(anime));
  };

  const close = ({ updateUrl = true } = {}) => {
    app.getRuntimeCapabilities().setModalVisibility('detail-modal', false);
    session = null;
    reviewRequest += 1;
    media?.cleanup();
    activeAnime = null;
    activeSynopsis = '';

    if (updateUrl) {
      app.updateUrlForAnime(null);
    }
    app.updateMetaForFilters();
  };

  const open = async (animeId, { updateUrl = true, deepLink = false } = {}) => {
    const openStart = app.getPerformanceNow();
    // Identity belongs to an opening, not a title: the same title can be reopened.
    const owner = { animeId: normalizeDetailKey(animeId), options: { updateUrl, deepLink } };
    session = owner;
    activeAnime = null;
    activeSynopsis = '';
    reviewRequest += 1;
    media?.cleanup();
    const { modal, content } = getDetailElements();
    if (!modal || !content) { session = null; return false; }
    setHTML(content, presentation ? presentation.renderDetailSkeleton() : '<p role="status">Loading details...</p>');
    app.getRuntimeCapabilities().setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });
    try {
      await ensureView();
      if (session !== owner) return false;
      let anime = app.animeData.find(entry => entry?.id === owner.animeId) || null;
      if (!anime && deepLink && !app.isFullDataLoaded) {
        await catalogRuntime.loadFullCatalog();
        if (session !== owner) return false;
        anime = app.animeData.find(entry => entry?.id === owner.animeId) || null;
      }
      if (!anime) {
        const key = app.normalizeBookmarkId(owner.animeId);
        anime = key ? app.getWatchlistSnapshot(key) : null;
      }
      if (!anime) {
        if (updateUrl) app.updateUrlForAnime(null, { replace: true });
        app.resetMetaToDefault();
        setHTML(content, renderDetailErrorState(deepLink ? 'deepLink' : 'catalog'));
        app.emitAppEvent('rekonime:modal-opened', {
          animeId: owner.animeId, durationMs: Math.round(app.getPerformanceNow() - openStart),
          cached: false, status: 'not_found'
        });
        return false;
      }
      if (updateUrl) app.updateUrlForAnime(anime.id);
      renderAnime(anime, owner);
      // Enrichment belongs to this opening, including a close/reopen of the same ID.
      void catalogRuntime.loadAnimeDetailChunk(anime.id).then(detailAnime => {
        if (session !== owner || !detailAnime || detailAnime === anime) return;
        detailCache.delete(anime.id);
        renderAnime(detailAnime, owner);
      }).catch(error => {
        if (session === owner) app.getLogger()?.warn?.('Unable to enrich details', { error });
      });
      return true;
    } catch (error) {
      if (session !== owner) return false;
      app.getLogger()?.warn?.('Unable to load details', { error });
      setHTML(content, '<p role="alert">Details could not load. Check your connection and try again.</p><button type="button" class="btn btn-primary" data-action="retry-detail">Retry details</button>');
      return false;
    }
  };

  const renderAnime = (anime, owner) => {
    if (session !== owner) return;
    const animeId = anime.id;
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

    activeAnime = anime;
    reviewRequest += 1;
    const synopsis = app.getSynopsisForAnime(anime);
    activeSynopsis = synopsis;
    setHTML(content, cachedDetail || renderContent(anime, synopsis));
    if (!hasCachedDetail) cache(anime.id, content.innerHTML);
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
    getCurrentAnimeId: () => session?.animeId || null,
    invalidate: (animeId) => animeId == null ? detailCache.clear() : detailCache.delete(normalizeDetailKey(animeId)),
    syncWithUrl,
    refreshTrailerSection,
    toggleTrailerPlayback: () => { if (activeAnime) media?.toggle(); },
    refreshCommunityReviews,
    open,
    retry: () => session ? open(session.animeId, session.options) : Promise.resolve(false),
    close
  };
};

export { createDetailExperience };
