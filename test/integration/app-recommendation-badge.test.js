import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { setupDom } from '../helpers/dom.js';

const pick = (overrides = {}) => ({
  id: 'badge-pick',
  title: 'Badge Pick',
  year: 2024,
  studio: 'Studio',
  cover: 'https://cdn.myanimelist.net/images/anime/1/1l.jpg',
  communityScore: 8.5,
  genres: ['Action'],
  themes: [],
  fitLabel: 'Strong start',
  fitReason: 'Strong opening episodes',
  episodeSummary: '12 episodes listed',
  ...overrides
});

const renderPicks = (decision) => {
  setupDom('<div id="recommendations-grid"></div>', { url: 'https://example.com/' });
  const original = {
    getDiscoveryShortlist: App.getDiscoveryShortlist,
    getCardDecisionData: App.getCardDecisionData
  };
  App.getDiscoveryShortlist = () => ({
    getModel: () => ({ items: [pick()], dismissed: [], chosen: null, hasMore: false, heading: 'Picks', context: '' })
  });
  App.getCardDecisionData = () => decision;
  try {
    App.renderRecommendations();
    return document.querySelector('#recommendations-grid .recommendation-card');
  } finally {
    Object.assign(App, original);
  }
};

test('pick posters show the episode score with its scale in a decorative badge', () => {
  const card = renderPicks({ kind: 'episode', value: '82/100', className: 'score-high', label: 'Episode Rating Strength' });
  const badge = card.querySelector('.recommendation-media .recommendation-badge');

  assert.ok(badge, 'Expected a score badge on the poster');
  assert.equal(badge.getAttribute('aria-hidden'), 'true');
  assert.equal(badge.querySelector('.recommendation-badge-score').textContent, '82/100');
  assert.equal(badge.querySelector('.recommendation-badge-score small').textContent, '/100');
  assert.equal(badge.querySelector('.recommendation-badge-label').textContent, 'Episode strength');
});

test('pick posters fall back to the MAL score and omit the badge without a score', () => {
  const community = renderPicks({ kind: 'community', value: '8.5/10', className: '', label: 'Community Score' });
  assert.equal(community.querySelector('.recommendation-badge-label').textContent, 'MAL score');
  assert.equal(community.querySelector('.recommendation-badge-score').textContent, '8.5/10');

  const unrated = renderPicks({ kind: 'none', value: 'N/A', className: '', label: '' });
  assert.equal(unrated.querySelector('.recommendation-badge'), null);
});

test('Preferences offer no theme choice', () => {
  setupDom('<div id="settings-content"></div>', { url: 'https://example.com/' });
  const markup = App.renderSettingsPanel();

  assert.equal(/data-theme-option|set-theme|theme-selector/.test(markup), false);
  assert.match(markup, /data-action="set-sidebar-mode"/);
});
