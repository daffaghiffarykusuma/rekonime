import {
  setHTML,
  insertHTML,
  replaceOuterHTML
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
    if (!app.currentAnimeId) return;
    const anime = app.animeData.find(item => item.id === app.currentAnimeId);
    if (!anime) return;

    app.stopTrailerPlayback();
    app.teardownTrailerObserver();
    app.teardownTrailerScrollListener();

    const markup = app.renderTrailerSection(anime);
    const current = document.getElementById('detail-trailer');
    const reviewsSection = document.getElementById('community-reviews-section');

    if (!markup) {
      if (current) current.remove();
      return;
    }

    if (current) {
      replaceOuterHTML(current, markup);
    } else if (reviewsSection) {
      insertHTML(reviewsSection, 'beforebegin', markup);
    }

    const modalContent = document.querySelector('#detail-modal .modal-content');
    app.setupTrailerAutoplay(modalContent);
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
      if (reviewsSection) {
        setHTML(reviewsSection, `
          <div class="community-reviews">
            <h3>Community Reviews</h3>
            <p class="no-reviews">Reviews are unavailable for this title.</p>
          </div>
        `);
      }
      return;
    }

    try {
      const reviewsService = await app.loadReviewsService();
      const data = await reviewsService.fetchReviews(parsedMalId, anime.title);

      if (app.currentAnimeId !== anime.id) {
        return;
      }

      if (synopsisSection) {
        if (data.description) {
          setHTML(synopsisSection, reviewsService.renderSynopsis(data.description));
        } else if (fallbackSynopsis) {
          setHTML(synopsisSection, reviewsService.renderSynopsis(fallbackSynopsis));
        } else {
          synopsisSection.replaceChildren();
        }
      }

      if (reviewsSection) {
        setHTML(reviewsSection, reviewsService.renderReviewsSection(data, 'positive'));
        reviewsService.initTabSwitching(data);
      }

      if (data.description) {
        app.updateMetaForAnime(anime, data.description);
      }
    } catch (error) {
      const logger = app.getLogger();
      if (logger?.error) {
        logger.error('Failed to load reviews', { error });
      } else {
        console.error('Failed to load reviews:', error);
      }

      if (synopsisSection && !fallbackSynopsis) {
        synopsisSection.replaceChildren();
      }

      if (reviewsSection) {
        let errorMarkup = `
          <div class="community-reviews">
            <h3>Community Reviews</h3>
            <p class="no-reviews">Failed to load community reviews.</p>
          </div>
        `;
        try {
          const reviewsService = await app.loadReviewsService();
          errorMarkup = reviewsService.renderReviewsSection(
            { positive: [], neutral: [], negative: [], description: '', error: true },
            'positive'
          );
        } catch (loadError) {
          // Keep generic markup.
        }
        setHTML(reviewsSection, errorMarkup);
      }
    }
  };

  const close = ({ updateUrl = true } = {}) => {
    app.setModalVisibility('detail-modal', false);

    if (app.trailerCleanup) {
      app.trailerCleanup();
      app.trailerCleanup = null;
    } else {
      app.stopTrailerPlayback();
      app.teardownTrailerObserver();
      app.teardownTrailerScrollListener();
    }
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

    setHTML(content, `
      <div class="error-message">
        <h2>That title is not available</h2>
        <p>We could not find that anime. The link may be outdated or the catalog may have changed.</p>
        <button class="btn btn-primary detail-close-button" data-action="close-detail">Back to browsing</button>
      </div>
    `);
    return false;
  };

  return {
    isCached,
    getCached,
    cache,
    syncWithUrl,
    refreshTrailerSection,
    loadCommunityReviews,
    close,
    handleDeepLink
  };
};

export { createDetailExperience };
