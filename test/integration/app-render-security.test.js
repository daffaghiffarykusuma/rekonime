import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { Discovery } from '../../js/discovery.js';
import { Recommendations } from '../../js/recommendations.ts';
import { setupDom } from '../helpers/dom.js';

const createAnime = (overrides = {}) => ({
  id: 'security-test',
  title: 'Security Test',
  year: 2024,
  studio: 'Studio',
  cover: 'https://cdn.myanimelist.net/images/anime/1/1l.jpg',
  communityScore: 8.5,
  genres: ['Action'],
  themes: ['School'],
  episodes: [{ episode: 1, score: 4.5 }],
  stats: {
    average: 4.5,
    retentionScore: 92,
    episodeCount: 1,
    scoreClass: 'score-excellent'
  },
  ...overrides
});

test('App createAnimeCardElement strips injected badge and stat classes', () => {
  setupDom(undefined, { url: 'https://example.com/' });
  App.animeCardTemplate = null;

  const originalGetBadges = Recommendations.getBadges;
  const originalGetCardStats = Recommendations.getCardStats;

  Recommendations.getBadges = () => [
    { label: 'Hooked', class: 'badge-retention" data-pwned="1' }
  ];
  Recommendations.getCardStats = () => [
    { label: 'Retention', value: '99', suffix: '%', class: 'score-high" onclick="alert(1)', tooltip: null }
  ];

  try {
    const card = App.createAnimeCardElement(createAnime());
    const badge = card.querySelector('.card-badge');
    const statValue = card.querySelector('.stat-value');

    assert.ok(badge);
    assert.ok(statValue);
    assert.equal(card.querySelector('[data-pwned]'), null);
    assert.equal(card.querySelector('[onclick]'), null);
    assert.equal(badge.className, 'card-badge');
    assert.equal(statValue.className, 'stat-value');
  } finally {
    Recommendations.getBadges = originalGetBadges;
    Recommendations.getCardStats = originalGetCardStats;
  }
});

test('App renderRankingCard escapes poisoned metric values and score classes', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  const html = App.renderRankingCard(createAnime({
    stats: {
      average: '<img src=x onerror=alert(1)>',
      scoreClass: 'score-good" data-owned="1',
      episodeCount: 1
    }
  }), 'average');

  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(html.includes('data-owned='), false);
  assert.match(html, /class="ranking-score"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('App renderTrending escapes catalog year values', () => {
  setupDom('<!doctype html><div id="trending-grid"></div>', { url: 'https://example.com/' });

  const originalGetTrending = Discovery.getTrending;
  Discovery.getTrending = () => [
    createAnime({
      year: '<img src=x onerror="window.__xss=1">',
      stats: { retentionScore: 88, episodeCount: 1 },
      episodes: [{ episode: 1, score: 4.5 }]
    })
  ];

  try {
    App.animeData = [createAnime()];
    App.renderTrending();
    const grid = document.getElementById('trending-grid');

    assert.equal(grid.querySelector('.trending-meta img'), null);
    assert.match(grid.textContent, /<img src=x onerror="window\.__xss=1">/);
    assert.equal(grid.innerHTML.includes('&lt;img src=x onerror="window.__xss=1"&gt;'), true);
  } finally {
    Discovery.getTrending = originalGetTrending;
  }
});
