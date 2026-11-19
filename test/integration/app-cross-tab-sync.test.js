import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';

const stubApp = (calls) => {
  const originals = {
    detailExperience: App.detailExperience,
    loadWatchlist: App.loadWatchlist,
    getTasteProfileStore: App.getTasteProfileStore,
    refreshTasteProfileEvidence: App.refreshTasteProfileEvidence,
    updateTasteProfileUi: App.updateTasteProfileUi,
    renderRecommendations: App.renderRecommendations,
    renderWatchlist: App.renderWatchlist,
    scheduleAiringDashboardRender: App.scheduleAiringDashboardRender,
    updateWatchlistControls: App.updateWatchlistControls,
    renderContinueWatching: App.renderContinueWatching
  };
  App.detailExperience = { getCurrentAnimeId: () => 'open-title' };
  App.loadWatchlist = () => calls.push('load-watchlist');
  App.getTasteProfileStore = () => ({ load: () => calls.push('load-taste') });
  App.refreshTasteProfileEvidence = () => calls.push('taste-evidence');
  App.updateTasteProfileUi = () => calls.push('taste-ui');
  App.renderRecommendations = () => calls.push('recommendations');
  App.renderWatchlist = () => calls.push('watchlist');
  App.scheduleAiringDashboardRender = () => calls.push('airing');
  App.updateWatchlistControls = (id) => calls.push(`controls:${id}`);
  App.renderContinueWatching = () => calls.push('continue-watching');
  return () => Object.assign(App, originals);
};

test('App reloads and re-renders the Watchlist saved by another tab', () => {
  document.body.innerHTML = '<div id="settings-content"></div><div id="watchlist-grid"></div>';
  const calls = [];
  const restore = stubApp(calls);
  try {
    assert.equal(App.handleExternalStorageChange({ key: 'rekonime.watchlist' }), true);
    assert.deepEqual(calls, [
      'load-watchlist',
      'taste-evidence',
      'taste-ui',
      'recommendations',
      'watchlist',
      'airing',
      'controls:open-title',
      'continue-watching'
    ]);
  } finally { restore(); }
});

test('App reloads the taste profile saved by another tab without touching the Watchlist', () => {
  document.body.innerHTML = '<div id="settings-content"></div>';
  const calls = [];
  const restore = stubApp(calls);
  try {
    assert.equal(App.handleExternalStorageChange({ key: 'rekonime.tasteProfile' }), true);
    assert.deepEqual(calls, ['load-taste', 'taste-evidence', 'taste-ui', 'recommendations']);
  } finally { restore(); }
});

test('App ignores unrelated keys and keeps focused settings intact', () => {
  document.body.innerHTML = '<div id="settings-content"><input id="focused"></div><div id="watchlist-grid" data-renderer="watchlist-page"></div>';
  const calls = [];
  const restore = stubApp(calls);
  try {
    assert.equal(App.handleExternalStorageChange({ key: 'rekonime.theme' }), false);
    assert.deepEqual(calls, []);

    document.getElementById('focused').focus();
    assert.equal(App.handleExternalStorageChange({ key: null }), true);
    assert.deepEqual(calls, [
      'load-watchlist',
      'load-taste',
      'taste-evidence',
      'recommendations',
      'controls:open-title',
      'continue-watching'
    ]);
  } finally { restore(); }
});
