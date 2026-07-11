import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDetailDecisionData, renderDetailContent } from '../../js/detail-presentation.ts';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const createRenderOptions = (overrides = {}) => ({
  escapeHtml,
  escapeAttr: escapeHtml,
  sanitizeImageUrl: (value) => value || '',
  sanitizeClassList: (...classes) => classes.filter(Boolean).join(' '),
  buildImageSrcset: (cover) => ({ src: cover || '', srcset: '', sizes: '', fallback: '' }),
  getImageDimensions: () => ({ width: 150, height: 210 }),
  getImageFallbackAttrs: () => '',
  getEpisodeCount: (anime) => anime.episodes?.length || anime.episodeCount || 0,
  renderSynopsis: (value) => value ? `<p>${escapeHtml(value)}</p>` : '',
  renderSynopsisLoading: () => '<p>Loading synopsis</p>',
  renderFranchiseHubSection: () => '<section id="franchise"></section>',
  renderTrailerSection: () => '<section id="detail-trailer"></section>',
  renderReviewsLoading: () => '<p>Loading reviews</p>',
  renderSimilarAnimeSection: () => '<section class="similar"></section>',
  renderWatchlistControls: () => '<div class="watchlist-controls"></div>',
  ...overrides
});

test('Detail Presentation builds the shared decision signal', () => {
  assert.deepEqual(
    buildDetailDecisionData({
      stats: { retentionScore: 90 },
      communityScore: 7.2
    }, { episodeCount: 12 }),
    {
      value: '90%',
      label: 'Finish confidence',
      note: 'Very likely to keep you watching',
      className: 'score-high'
    }
  );
});

test('Detail Presentation renders modal body without App Shell state', () => {
  const html = renderDetailContent({
    id: 'show-1',
    title: 'Show <One>',
    cover: 'https://example.test/show.jpg',
    genres: ['Drama'],
    themes: ['School'],
    type: 'TV',
    year: 2024,
    episodes: [{ score: 4 }],
    stats: { retentionScore: 82, threeEpisodeHook: 77, churnRisk: { score: 18 }, worthFinishing: 91 },
    communityScore: 8.2
  }, createRenderOptions({ synopsis: 'Local synopsis' }));

  assert.match(html, /Show &lt;One&gt;/);
  assert.match(html, /Local synopsis/);
  assert.match(html, /watchlist-controls/);
  assert.match(html, /Decision signal/);
  assert.match(html, /Satisfaction \(MAL\)/);
  assert.doesNotMatch(html, /detail-stat-label">Finish Confidence/);
  assert.match(html, /role="tab"[^>]*>Overview/);
  assert.match(html, /role="tab"[^>]*>Watch order/);
  assert.match(html, /id="detail-panel-reviews"/);
  assert.match(html, /id="similar-anime-section"/);
});
