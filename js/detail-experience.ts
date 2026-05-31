// @ts-nocheck
import {
  setHTML,
  insertHTML,
  replaceOuterHTML
} from './security/trusted-types.js';
import { Recommendations } from './recommendations.ts';

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

  const open = (animeId, { updateUrl = true, skipModalOpen = false } = {}) => {
    const renderStart = app.getPerformanceNow();
    app.stopTrailerPlayback();
    app.teardownTrailerObserver();

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
      setHTML(content, `
        <div class="error-message">
          <h2>That title is not available</h2>
          <p>We could not find that anime in the current catalog.</p>
          <button class="btn btn-primary detail-close-button" data-action="close-detail">Back to browsing</button>
        </div>
      `);
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
      app.setupTrailerAutoplay(modalContent);
      loadCommunityReviews(anime, synopsis);
      app.updatePrefetchObserving();
      reportModalOpened({ status: 'ok' });
      return;
    }

    const genreTags = anime.genres && anime.genres.length > 0
      ? anime.genres.map(g => `<span class="detail-tag">${app.escapeHtml(g)}</span>`).join('')
      : '';
    const themeTags = anime.themes && anime.themes.length > 0
      ? anime.themes.map(t => `<span class="detail-tag">${app.escapeHtml(t)}</span>`).join('')
      : '';

    const synopsisMarkup = app.renderSynopsis(synopsis);
    const synopsisSection = synopsisMarkup || app.renderSynopsisLoading();
    const franchiseSection = app.renderFranchiseHubSection(anime);
    const trailerSection = app.renderTrailerSection(anime);
    const episodeCount = app.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const rawRetention = anime?.stats?.retentionScore;
    const retentionScore = hasEpisodes && Number.isFinite(rawRetention) ? Math.round(rawRetention) : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const retentionClass = Recommendations.getRetentionClass(retentionScore);
    const malSatisfactionClass = Recommendations.getMalSatisfactionClass(malSatisfactionScore);
    const rawStart = anime?.stats?.threeEpisodeHook;
    const rawChurn = anime?.stats?.churnRisk?.score;
    const rawFinish = anime?.stats?.worthFinishing;
    const startScore = hasEpisodes && Number.isFinite(rawStart) ? Math.round(rawStart) : null;
    const stayScore = hasEpisodes && Number.isFinite(rawChurn) ? Math.round(100 - rawChurn) : null;
    const finishScore = hasEpisodes && Number.isFinite(rawFinish) ? Math.round(rawFinish) : null;
    const safeStartScore = Number.isFinite(startScore) ? startScore : 0;
    const safeStayScore = Number.isFinite(stayScore) ? stayScore : 0;
    const safeFinishScore = Number.isFinite(finishScore) ? finishScore : 0;

    const metaParts = [anime.type, anime.year, anime.studio, anime.source, anime.demographic]
      .map(value => {
        const label = String(value ?? '').trim();
        const normalized = label.toLowerCase();
        if (!label || normalized === 'undefined' || normalized === 'null') return '';
        return label;
      })
      .filter(Boolean);
    const metaHtml = metaParts.map(part => `<span>${app.escapeHtml(part)}</span>`).join(' &bull; ');
    const safeTitle = app.escapeHtml(anime.title);
    const { src: detailSrc, srcset: detailSrcset, sizes: detailSizes, fallback: detailFallback } = app.buildImageSrcset(anime.cover, { sizeKey: 'detail', preferOptimized: false });
    const safeCover = app.escapeAttr(detailSrc || app.sanitizeImageUrl(anime.cover));
    const detailSrcsetAttr = detailSrcset ? `srcset="${app.escapeAttr(detailSrcset)}"` : '';
    const detailSizesAttr = detailSizes ? `sizes="${app.escapeAttr(detailSizes)}"` : '';
    const detailDims = app.getImageDimensions('detail');
    const detailDimAttrs = detailDims ? `width="${detailDims.width}" height="${detailDims.height}"` : '';
    const detailFallbackAttrs = app.getImageFallbackAttrs({
      fallbackSrc: detailFallback,
      placeholder: 'https://via.placeholder.com/150x210?text=No+Image'
    });

    const altTitles = [];
    if (anime.titleEnglish && anime.titleEnglish.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'English', value: anime.titleEnglish });
    }
    if (anime.titleJapanese && anime.titleJapanese.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'Japanese', value: anime.titleJapanese });
    }
    const altTitlesHtml = altTitles.length
      ? `<div class="detail-alt-titles">
          ${altTitles.map(item => `
            <div class="detail-alt-title">
              <span class="detail-alt-label">${app.escapeHtml(item.label)}</span>
              <span class="detail-alt-value">${app.escapeHtml(item.value)}</span>
            </div>
          `).join('')}
        </div>`
      : '';
    const similarSection = app.renderSimilarAnimeSection(anime);
    const watchlistControls = app.renderWatchlistControls(anime);
    const decision = app.getCardDecisionData(anime);
    const detailDecisionClass = app.sanitizeClassList('detail-verdict', decision.className);

    setHTML(content, `
      <div class="detail-header">
        <img src="${safeCover}" ${detailSrcsetAttr} ${detailSizesAttr} alt="${safeTitle}" class="detail-cover" ${detailDimAttrs} ${detailFallbackAttrs}>
        <div class="detail-info">
          <div class="detail-title-row">
            <h2 class="detail-title" id="detail-modal-title">${safeTitle}</h2>
          </div>
          ${altTitlesHtml}
          <div class="detail-meta">
            ${metaHtml}
          </div>
          <div class="detail-tags">
            ${genreTags}${themeTags}
          </div>
          <div class="detail-decision-panel">
            <div class="${detailDecisionClass}">
              <span class="detail-verdict-label">Decision signal</span>
              <strong class="detail-verdict-value">${app.escapeHtml(decision.value)}</strong>
              <span class="detail-verdict-copy">${app.escapeHtml(decision.note)}</span>
            </div>
            <div class="detail-stats">
              <div class="detail-stat has-tooltip" tabindex="0">
                <span class="detail-stat-value ${retentionClass}">${retentionScore !== null ? `${retentionScore}%` : 'N/A'}</span>
                <span class="detail-stat-label">Finish Rate</span>
                <div class="tooltip" role="tooltip">
                  <div class="tooltip-title">Finish Rate</div>
                  <div class="tooltip-text">How reliably viewers keep watching through the series. Factors in strong starts, low drop-off, and steady pacing.</div>
                </div>
              </div>
              <div class="detail-stat has-tooltip" tabindex="0">
                <span class="detail-stat-value ${malSatisfactionClass}">${malSatisfactionScore !== null ? `${malSatisfactionScore.toFixed(1)}/10` : 'N/A'}</span>
                <span class="detail-stat-label">Satisfaction (MAL)</span>
                <div class="tooltip" role="tooltip">
                  <div class="tooltip-title">Satisfaction Score</div>
                  <div class="tooltip-text">Community rating from MyAnimeList.</div>
                </div>
              </div>
              <div class="detail-stat">
                <span class="detail-stat-value">${episodeCount || 'N/A'}</span>
                <span class="detail-stat-label">Episodes</span>
              </div>
            </div>
            ${watchlistControls}
          </div>
        </div>
      </div>
      ${hasEpisodes ? `
        <div class="detail-breakdown">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
            <span class="detail-section-note">Start, stay, finish</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Strong start
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Strong Start</div>
                <div class="tooltip-text">How compelling the first 3 episodes are. High scores mean the show hooks viewers early.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeStartScore}" max="100" aria-label="Strong start score"></progress>
            <span class="breakdown-value">${startScore !== null ? `${startScore}%` : 'N/A'}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Keeps you watching
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Keeps You Watching</div>
                <div class="tooltip-text">Low drop-off probability. Measures how likely viewers are to continue without losing interest.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeStayScore}" max="100" aria-label="Keeps you watching score"></progress>
            <span class="breakdown-value">${stayScore !== null ? `${stayScore}%` : 'N/A'}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Finish payoff
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Finish Payoff</div>
                <div class="tooltip-text">How well the show sticks the landing. Combines finale strength, momentum, and narrative build-up.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeFinishScore}" max="100" aria-label="Finish payoff score"></progress>
            <span class="breakdown-value">${finishScore !== null ? `${finishScore}%` : 'N/A'}</span>
          </div>
        </div>
      ` : `
        <div class="detail-breakdown detail-breakdown-empty">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
          </div>
          <p class="detail-empty">No episode scores yet. Finish Rate appears once episode scores are available.</p>
        </div>
      `}
      <div id="synopsis-section">
        ${synopsisSection}
      </div>
      ${franchiseSection}
      ${trailerSection}
      <div id="community-reviews-section">
        ${app.renderReviewsLoading()}
      </div>
      <div id="similar-anime-section">
        ${similarSection}
      </div>
    `);

    cache(anime.id, content.innerHTML);
    app.updateWatchlistControls(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    app.updateMetaForAnime(anime, synopsis);
    app.setupTrailerAutoplay(modalContent);

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
