// @ts-nocheck
import { Recommendations } from './recommendations.ts';

const renderDetailSkeleton = () => `
  <div class="detail-skeleton">
    <div class="detail-skeleton-header">
      <div class="detail-skeleton-cover"></div>
      <div class="detail-skeleton-info">
        <div class="detail-skeleton-title"></div>
        <div class="detail-skeleton-meta"></div>
        <div class="detail-skeleton-tags"><div class="detail-skeleton-tag"></div><div class="detail-skeleton-tag"></div><div class="detail-skeleton-tag"></div></div>
        <div class="detail-skeleton-stats"><div class="detail-skeleton-stat"></div><div class="detail-skeleton-stat"></div><div class="detail-skeleton-stat"></div></div>
        <div class="detail-skeleton-watchlist"><div class="detail-skeleton-pill"></div><div class="detail-skeleton-pill wide"></div></div>
      </div>
    </div>
    <div class="detail-skeleton-breakdown">
      <div class="detail-skeleton-section-title"></div>
      ${Array.from({ length: 3 }, () => '<div class="detail-skeleton-row"><div class="detail-skeleton-label"></div><div class="detail-skeleton-bar"></div><div class="detail-skeleton-value"></div></div>').join('')}
    </div>
    <div class="detail-skeleton-section"><div class="detail-skeleton-section-title"></div><div class="detail-skeleton-text"></div><div class="detail-skeleton-text medium"></div><div class="detail-skeleton-text short"></div></div>
    <div class="detail-skeleton-trailer"></div>
    <div class="detail-skeleton-reviews"><div class="detail-skeleton-section-title"></div><div class="detail-skeleton-tabs"><div class="detail-skeleton-tab"></div><div class="detail-skeleton-tab"></div><div class="detail-skeleton-tab"></div></div><div class="detail-skeleton-review-cards"><div class="detail-skeleton-review"></div><div class="detail-skeleton-review"></div></div></div>
    <div class="detail-skeleton-similar"><div class="detail-skeleton-section-title"></div><div class="detail-skeleton-similar-grid"><div class="detail-skeleton-similar-card"></div><div class="detail-skeleton-similar-card"></div><div class="detail-skeleton-similar-card"></div></div></div>
  </div>
`;

const renderSynopsisLoading = () => `
  <div class="anime-synopsis">
    <h3>Synopsis</h3>
    <div class="synopsis-loading"><div class="loading-shimmer"></div><div class="loading-shimmer"></div><div class="loading-shimmer short"></div></div>
  </div>
`;

const renderReviewsLoading = () => `
  <div class="community-reviews">
    <h3>Community Reviews</h3>
    <div class="reviews-loading"><div class="loading-spinner"></div><p>Loading reviews...</p></div>
  </div>
`;

const buildDetailDecisionData = (anime, { episodeCount = 0 } = {}) => {
  const hasEpisodes = episodeCount > 0;
  const retention = hasEpisodes && Number.isFinite(anime?.stats?.retentionScore)
    ? Math.round(anime.stats.retentionScore)
    : null;
  const satisfaction = Number.isFinite(anime?.communityScore)
    ? anime.communityScore
    : null;

  if (retention !== null) {
    let note = 'Steady finish confidence';
    if (retention >= 88) {
      note = 'Very likely to keep you watching';
    } else if (retention >= 76) {
      note = 'Reliable through the middle';
    } else if (retention < 60) {
      note = 'More selective pick';
    }
    return {
      value: `${retention}%`,
      label: 'Finish confidence',
      note,
      className: Recommendations.getRetentionClass(retention)
    };
  }

  if (satisfaction !== null) {
    return {
      value: satisfaction.toFixed(1),
      label: 'Community score',
      note: 'Use genre fit to decide',
      className: Recommendations.getMalSatisfactionClass(satisfaction)
    };
  }

  return {
    value: 'N/A',
    label: 'Decision signal',
    note: 'Open details for more context',
    className: 'score-low'
  };
};

const renderTagList = (values, { escapeHtml }) => Array.isArray(values) && values.length > 0
  ? values.map(value => `<span class="detail-tag">${escapeHtml(value)}</span>`).join('')
  : '';

const renderMeta = (anime, { escapeHtml }) => {
  const metaParts = [anime.type, anime.year, anime.studio, anime.source, anime.demographic]
    .map(value => {
      const label = String(value ?? '').trim();
      const normalized = label.toLowerCase();
      if (!label || normalized === 'undefined' || normalized === 'null') return '';
      return label;
    })
    .filter(Boolean);
  return metaParts.map(part => `<span>${escapeHtml(part)}</span>`).join(' &bull; ');
};

const renderAltTitles = (anime, { escapeHtml }) => {
  const altTitles = [];
  if (anime.titleEnglish && anime.titleEnglish.toLowerCase() !== anime.title.toLowerCase()) {
    altTitles.push({ label: 'English', value: anime.titleEnglish });
  }
  if (anime.titleJapanese && anime.titleJapanese.toLowerCase() !== anime.title.toLowerCase()) {
    altTitles.push({ label: 'Japanese', value: anime.titleJapanese });
  }
  return altTitles.length
    ? `<div class="detail-alt-titles">
        ${altTitles.map(item => `
          <div class="detail-alt-title">
            <span class="detail-alt-label">${escapeHtml(item.label)}</span>
            <span class="detail-alt-value">${escapeHtml(item.value)}</span>
          </div>
        `).join('')}
      </div>`
    : '';
};

const renderBreakdown = ({
  hasEpisodes,
  startScore,
  stayScore,
  finishScore,
  safeStartScore,
  safeStayScore,
  safeFinishScore
}) => hasEpisodes ? `
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
    <p class="detail-empty">No episode scores yet. Finish Confidence appears once episode scores are available.</p>
  </div>
`;

const renderDetailTabs = ({
  breakdown,
  synopsisSection,
  franchiseSection,
  trailerSection,
  reviewsSection,
  similarSection
}) => `
  <div class="detail-tabs">
    <div class="detail-tab-list" role="tablist" aria-label="Anime details">
      <button class="detail-tab is-active" type="button" role="tab" id="detail-tab-overview" aria-selected="true" aria-controls="detail-panel-overview" data-action="detail-tab" data-detail-tab="overview">Overview</button>
      <button class="detail-tab" type="button" role="tab" id="detail-tab-watch-order" aria-selected="false" aria-controls="detail-panel-watch-order" data-action="detail-tab" data-detail-tab="watch-order">Watch order</button>
      <button class="detail-tab" type="button" role="tab" id="detail-tab-reviews" aria-selected="false" aria-controls="detail-panel-reviews" data-action="detail-tab" data-detail-tab="reviews">Reviews</button>
      <button class="detail-tab" type="button" role="tab" id="detail-tab-similar" aria-selected="false" aria-controls="detail-panel-similar" data-action="detail-tab" data-detail-tab="similar">Similar titles</button>
    </div>
    <section class="detail-tab-panel is-active" role="tabpanel" id="detail-panel-overview" aria-labelledby="detail-tab-overview" data-detail-panel="overview">
      ${breakdown}
      <div id="synopsis-section">${synopsisSection}</div>
      ${trailerSection}
    </section>
    <section class="detail-tab-panel" role="tabpanel" id="detail-panel-watch-order" aria-labelledby="detail-tab-watch-order" data-detail-panel="watch-order" hidden>
      ${franchiseSection || '<p class="detail-empty">No watch-order map is available for this title yet.</p>'}
    </section>
    <section class="detail-tab-panel" role="tabpanel" id="detail-panel-reviews" aria-labelledby="detail-tab-reviews" data-detail-panel="reviews" hidden>
      <div id="community-reviews-section">${reviewsSection}</div>
    </section>
    <section class="detail-tab-panel" role="tabpanel" id="detail-panel-similar" aria-labelledby="detail-tab-similar" data-detail-panel="similar" hidden>
      <div id="similar-anime-section">${similarSection}</div>
    </section>
  </div>
`;

const renderDetailContent = (anime, {
  synopsis = '',
  escapeHtml,
  escapeAttr,
  sanitizeImageUrl,
  sanitizeClassList,
  buildImageSrcset,
  getImageDimensions,
  getImageFallbackAttrs,
  getEpisodeCount,
  renderSynopsis,
  renderSynopsisLoading,
  renderFranchiseHubSection,
  renderTrailerSection,
  renderReviewsLoading,
  renderSimilarAnimeSection,
  renderWatchlistControls
}) => {
  const synopsisMarkup = renderSynopsis(synopsis);
  const synopsisSection = synopsisMarkup || renderSynopsisLoading();
  const episodeCount = getEpisodeCount(anime);
  const hasEpisodes = episodeCount > 0;
  const rawRetention = anime?.stats?.retentionScore;
  const retentionScore = hasEpisodes && Number.isFinite(rawRetention) ? Math.round(rawRetention) : null;
  const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
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
  const safeTitle = escapeHtml(anime.title);
  const { src: detailSrc, srcset: detailSrcset, sizes: detailSizes, fallback: detailFallback } = buildImageSrcset(anime.cover, { sizeKey: 'detail', preferOptimized: false });
  const safeCover = escapeAttr(detailSrc || sanitizeImageUrl(anime.cover));
  const detailSrcsetAttr = detailSrcset ? `srcset="${escapeAttr(detailSrcset)}"` : '';
  const detailSizesAttr = detailSizes ? `sizes="${escapeAttr(detailSizes)}"` : '';
  const detailDims = getImageDimensions('detail');
  const detailDimAttrs = detailDims ? `width="${detailDims.width}" height="${detailDims.height}"` : '';
  const detailFallbackAttrs = getImageFallbackAttrs({
    fallbackSrc: detailFallback,
    placeholder: 'https://via.placeholder.com/150x210?text=No+Image'
  });
  const decision = buildDetailDecisionData(anime, { episodeCount });
  const detailDecisionClass = sanitizeClassList('detail-verdict', decision.className);

  const breakdown = renderBreakdown({ hasEpisodes, startScore, stayScore, finishScore, safeStartScore, safeStayScore, safeFinishScore });

  return `
    <div class="detail-header">
      <img src="${safeCover}" ${detailSrcsetAttr} ${detailSizesAttr} alt="${safeTitle}" class="detail-cover" ${detailDimAttrs} ${detailFallbackAttrs}>
      <div class="detail-info">
        <div class="detail-title-row">
          <h2 class="detail-title" id="detail-modal-title">${safeTitle}</h2>
        </div>
        ${renderAltTitles(anime, { escapeHtml })}
        <div class="detail-meta">${renderMeta(anime, { escapeHtml })}</div>
        <div class="detail-tags">
          ${renderTagList(anime.genres, { escapeHtml })}${renderTagList(anime.themes, { escapeHtml })}
        </div>
        <div class="detail-decision-panel">
          <div class="${detailDecisionClass}">
            <span class="detail-verdict-label">Decision signal</span>
            <strong class="detail-verdict-value">${escapeHtml(decision.value)}</strong>
            <span class="detail-verdict-copy">${escapeHtml(decision.note)}</span>
          </div>
          <div class="detail-stats">
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
          ${renderWatchlistControls(anime)}
        </div>
      </div>
    </div>
    ${renderDetailTabs({
    breakdown,
    synopsisSection,
    franchiseSection: renderFranchiseHubSection(anime),
    trailerSection: renderTrailerSection(anime),
    reviewsSection: renderReviewsLoading(),
    similarSection: renderSimilarAnimeSection(anime)
  })}
  `;
};

export {
  buildDetailDecisionData,
  renderDetailSkeleton,
  renderReviewsLoading,
  renderSynopsisLoading,
  renderDetailContent
};
