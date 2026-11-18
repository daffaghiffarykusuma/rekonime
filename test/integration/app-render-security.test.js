import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { Discovery } from '../../src/features/discovery/discovery.js';
import { Recommendations } from '../../src/features/discovery/recommendations.ts';
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
    { label: 'Episode Rating Strength', value: '99', suffix: '/100', class: 'score-high', tooltip: null },
    { label: 'Community Score', value: '9.9', suffix: '/10', class: 'score-high" onclick="alert(1)', tooltip: null }
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
    assert.equal(card.querySelectorAll('.stat').length, 1);
    assert.equal(card.querySelector('.retention-meter'), null);
    assert.equal(card.querySelector('.card-reason'), null);
  } finally {
    Recommendations.getBadges = originalGetBadges;
    Recommendations.getCardStats = originalGetCardStats;
  }
});
