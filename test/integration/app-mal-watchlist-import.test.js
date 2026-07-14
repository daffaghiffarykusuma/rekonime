import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { App } from '../../js/app.ts';
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
