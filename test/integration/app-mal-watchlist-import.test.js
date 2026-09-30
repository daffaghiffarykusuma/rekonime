import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { App } from '../../src/app/app.ts';
import { setupDom } from '../helpers/dom.js';

test('App reviews and applies a MAL export as one first-import batch', async () => {
  setupDom('<div id="settings-content"></div>');
  App.animeData = JSON.parse(readFileSync('data/anime.full.json', 'utf8')).anime;
  const anime = App.animeData.find(item => Number.isInteger(Number(item.malId)));
  const xml = `<myanimelist><anime>
    <series_animedb_id>${anime.malId}</series_animedb_id>
    <series_title><![CDATA[${anime.title}]]></series_title>
    <my_watched_episodes>3</my_watched_episodes>
    <my_status>Watching</my_status>
  </anime></myanimelist>`;
  App.isFullDataLoaded = true;
  App.watchlistEntries = new Map();
  App.watchlistLifecycleRuntime = null;
  App.tasteProfileStore = null;
  App.settingsRendered = false;
  App.malImportState = { stage: 'choose', fileName: '', plan: null };

  await App.importMalWatchlistFile({
    name: 'myanimelist.xml',
    text: async () => xml
  });

  assert.match(document.getElementById('settings-content').textContent, /1 rows are ready to review/);
  assert.equal(document.querySelector('[data-mal-count="matched"]').textContent.trim(), '1');
  assert.equal(document.querySelector('[data-mal-count="unmatched"]').textContent.trim(), '0');
  assert.equal(document.querySelector('[data-mal-count="skipped"]').textContent.trim(), '0');

  let transitions = 0;
  let tasteRefreshes = 0;
  let tasteUiUpdates = 0;
  let recommendationRenders = 0;
  const originals = {
    applyWatchlistTransition: App.applyWatchlistTransition,
    refreshTasteProfileEvidence: App.refreshTasteProfileEvidence,
    updateTasteProfileUi: App.updateTasteProfileUi,
    renderRecommendations: App.renderRecommendations
  };
  App.applyWatchlistTransition = () => { transitions += 1; };
  App.refreshTasteProfileEvidence = () => { tasteRefreshes += 1; };
  App.updateTasteProfileUi = () => { tasteUiUpdates += 1; };
  App.renderRecommendations = () => { recommendationRenders += 1; };

  try {
    const result = App.applyMalWatchlistPlan();
    assert.equal(result.changed, true);
    assert.equal(App.watchlistEntries.size, 1);
    assert.equal(transitions, 1);
    assert.equal(tasteRefreshes, 1);
    assert.equal(tasteUiUpdates, 1);
    assert.equal(recommendationRenders, 1);
    assert.match(document.getElementById('settings-content').textContent, /1 Watchlist entries imported/);
  } finally {
    Object.assign(App, originals);
  }
});

test('App retains a committed import through downstream failure and retries only derivation', async () => {
  setupDom('<div id="settings-content"></div>');
  App.animeData = [{ id: 'one', malId: 1, title: 'One', episodeCount: 12 }];
  App.isFullDataLoaded = true;
  App.watchlistEntries = new Map();
  App.watchlistLifecycle = null;
  App.watchlistLifecycleRuntime = null;
  App.tasteProfileStore = null;
  await App.importMalWatchlistFile({ name: 'retry.xml', text: async () => '<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>One</series_title><my_status>Watching</my_status><my_watched_episodes>3</my_watched_episodes></anime></myanimelist>' });
  const originals = { applyWatchlistTransition: App.applyWatchlistTransition, refreshTasteProfileEvidence: App.refreshTasteProfileEvidence, updateTasteProfileUi: App.updateTasteProfileUi, renderRecommendations: App.renderRecommendations, scheduleAiringDashboardRender: App.scheduleAiringDashboardRender };
  const order = [];
  App.applyWatchlistTransition = () => order.push('event');
  App.scheduleAiringDashboardRender = () => order.push('airing');
  App.refreshTasteProfileEvidence = () => { order.push('derive'); throw new Error('Injected derivation failure'); };
  App.updateTasteProfileUi = () => order.push('taste-ui');
  App.renderRecommendations = () => order.push('recommendations');
  try {
    assert.equal(App.applyMalWatchlistPlan().changed, true);
    assert.equal(App.malImportState.stage, 'partial-success');
    const raw = localStorage.getItem('rekonime.watchlist');
    assert.equal(JSON.parse(raw).entries[0].progress, 3);
    assert.deepEqual(order, ['event', 'airing', 'derive']);
    App.refreshTasteProfileEvidence = () => order.push('derive');
    App.retryMalRecommendations();
    assert.equal(App.malImportState.stage, 'success');
    assert.equal(localStorage.getItem('rekonime.watchlist'), raw);
    assert.deepEqual(order.slice(3), ['derive', 'taste-ui', 'recommendations']);
  } finally { Object.assign(App, originals); }
});

test('App file read and catalog failures preserve the selected file and allow review retry without mutation', async () => {
  setupDom('<div id="settings-content"></div>');
  const file = { name: 'unreadable.xml', text: async () => { throw new Error('Read failure'); } };
  const before = localStorage.getItem('rekonime.watchlist');
  await App.importMalWatchlistFile(file);
  assert.equal(App.malImportState.stage, 'error');
  assert.equal(App.malImportState.file, file);
  assert.equal(localStorage.getItem('rekonime.watchlist'), before);
  assert.ok(document.querySelector('[data-action="retry-mal-watchlist-import"]'));
});

test('App retains the selected file when the full catalog cannot load', async () => {
  setupDom('<div id="settings-content"></div>');
  const originalRuntime = App.getCatalogRuntime, originalLoaded = App.isFullDataLoaded;
  App.isFullDataLoaded = false;
  App.getCatalogRuntime = () => ({ loadFullCatalog: async () => false });
  const file = { name: 'catalog-retry.xml', text: async () => '<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>One</series_title><my_status>Watching</my_status><my_watched_episodes>1</my_watched_episodes></anime></myanimelist>' };
  const before = localStorage.getItem('rekonime.watchlist');
  try {
    await App.importMalWatchlistFile(file);
    assert.equal(App.malImportState.stage, 'error');
    assert.equal(App.malImportState.file, file);
    assert.match(App.malImportState.error, /full catalog is unavailable/i);
    assert.equal(localStorage.getItem('rekonime.watchlist'), before);
  } finally { App.getCatalogRuntime = originalRuntime; App.isFullDataLoaded = originalLoaded; }
});
