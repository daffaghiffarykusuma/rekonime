import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailReviewsAdapter } from '../../js/detail-reviews.ts';
import { setupDom } from '../helpers/dom.js';

const createReviewsService = (calls, overrides = {}) => ({
  fetchReviews: async () => ({ description: 'remote synopsis', positive: [], neutral: [], negative: [] }),
  renderSynopsis: (value) => `<p>${value}</p>`,
  renderReviewsSection: (data) => `<section class="reviews">${data.error ? 'Error' : 'Reviews'}</section>`,
  initTabSwitching: () => calls.push(['initTabSwitching']),
  ...overrides
});

const createAdapterHarness = (overrides = {}) => {
  const calls = [];
  const state = {
    currentAnimeId: 'anime-a',
    reviewsService: createReviewsService(calls),
    ...overrides
  };
  const adapter = createDetailReviewsAdapter({
    getCurrentAnimeId: () => state.currentAnimeId,
    getLogger: () => ({ error: (...args) => calls.push(['logger.error', ...args]) }),
    loadReviewsService: async () => state.reviewsService,
    renderSynopsis: (value) => `<p>${value}</p>`,
    updateMetaForAnime: (...args) => calls.push(['updateMetaForAnime', ...args])
  });
  return { adapter, calls, state };
};

test('Detail Reviews loads reviews and updates synopsis/meta for active anime', async () => {
  setupDom(`
    <div id="synopsis-section"></div>
    <div id="community-reviews-section"></div>
  `);
  const { adapter, calls } = createAdapterHarness();
  const anime = { id: 'anime-a', malId: 1, title: 'Anime A' };

  await adapter.load(anime, 'fallback');

  assert.match(document.getElementById('synopsis-section').innerHTML, /remote synopsis/);
  assert.match(document.getElementById('community-reviews-section').innerHTML, /Reviews/);
  assert.equal(calls.some(([name]) => name === 'initTabSwitching'), true);
  assert.equal(calls.some(([name]) => name === 'updateMetaForAnime'), true);
});

test('Detail Reviews ignores stale responses after active anime changes', async () => {
  setupDom(`
    <div id="synopsis-section"></div>
    <div id="community-reviews-section"></div>
  `);
  const { adapter, calls, state } = createAdapterHarness();
  state.reviewsService = createReviewsService(calls, {
    fetchReviews: async () => {
      state.currentAnimeId = 'other';
      return { description: 'remote synopsis', positive: [], neutral: [], negative: [] };
    }
  });

  await adapter.load({ id: 'anime-a', malId: 1, title: 'Anime A' }, 'fallback');

  assert.equal(document.getElementById('community-reviews-section').innerHTML, '');
  assert.equal(calls.some(([name]) => name === 'initTabSwitching'), false);
});

test('Detail Reviews renders unavailable state when MAL id is absent', async () => {
  setupDom(`
    <div id="synopsis-section"></div>
    <div id="community-reviews-section"></div>
  `);
  const { adapter } = createAdapterHarness();

  await adapter.load({ id: 'anime-a', title: 'Anime A' }, 'fallback synopsis');

  assert.match(document.getElementById('synopsis-section').innerHTML, /fallback synopsis/);
  assert.match(document.getElementById('community-reviews-section').innerHTML, /unavailable/);
});
