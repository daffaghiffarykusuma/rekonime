import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { setupDom } from '../helpers/dom.js';

const xml = '<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>One</series_title><my_status>Watching</my_status><my_watched_episodes>3</my_watched_episodes></anime></myanimelist>';
const file = { name: 'list.xml', text: async () => xml };
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const createApp = (watchlistPage = false) => {
  setupDom(`<div id="settings-content"></div>${watchlistPage ? '<div id="watchlist-grid" data-renderer="watchlist-page"></div>' : ''}`);
  return Object.assign(Object.create(App), {
    animeData: [{ id: 'one', malId: 1, title: 'One', episodeCount: 12 }], isFullDataLoaded: true,
    watchlistEntries: new Map(), watchlistLifecycle: null, watchlistLifecycleRuntime: null,
    watchlistImportWorkflow: null, tasteProfileStore: null, settingsRendered: false
  });
};

for (const watchlistPage of [false, true]) {
  test(`App ${watchlistPage ? 'Watchlist' : 'home'} adapter renders a review and dispatches one persisted batch`, async () => {
    const app = createApp(watchlistPage);
    const order = [];
    app.applyWatchlistTransition = () => order.push('event');
    app.scheduleAiringDashboardRender = () => order.push('airing');
    app.refreshTasteProfileEvidence = () => order.push('derive');
    app.updateTasteProfileUi = () => order.push('taste-ui');
    app.renderRecommendations = () => order.push('recommendations');
    const workflow = app.getWatchlistImportWorkflow();
    await workflow.review(file);
    await frame();
    assert.equal(document.activeElement.id, 'mal-import-review-heading');
    assert.equal(document.querySelector('[data-mal-count="matched"]').textContent.trim(), '1');
    assert.match(document.getElementById('mal-import-status').textContent, /Nothing has changed/);
    assert.equal(localStorage.getItem('rekonime.watchlist'), null);
    assert.equal(workflow.apply().changed, true);
    await frame();
    assert.equal(JSON.parse(localStorage.getItem('rekonime.watchlist')).entries[0].progress, 3);
    assert.equal(document.activeElement.id, 'mal-import-success-heading');
    assert.match(document.getElementById('mal-import-status').textContent, /import complete/);
    assert.deepEqual(order, watchlistPage ? ['event', 'derive', 'taste-ui', 'recommendations']
      : ['event', 'airing', 'derive', 'taste-ui', 'recommendations']);
  });
}

test('App adapter preserves the commit and retries only failed recommendation effects', async () => {
  const app = createApp();
  const order = [];
  app.applyWatchlistTransition = () => order.push('event');
  app.scheduleAiringDashboardRender = () => order.push('airing');
  app.refreshTasteProfileEvidence = () => { order.push('derive'); throw new Error('Injected derivation failure'); };
  app.updateTasteProfileUi = () => order.push('taste-ui');
  app.renderRecommendations = () => order.push('recommendations');
  const workflow = app.getWatchlistImportWorkflow();
  await workflow.review(file);
  assert.equal(workflow.apply().changed, true);
  await frame();
  assert.match(document.activeElement.textContent, /recommendations need refresh/);
  const raw = localStorage.getItem('rekonime.watchlist');
  assert.equal(JSON.parse(raw).entries[0].progress, 3);
  assert.deepEqual(order, ['event', 'airing', 'derive']);
  app.refreshTasteProfileEvidence = () => order.push('derive');
  await workflow.retry();
  await frame();
  assert.equal(localStorage.getItem('rekonime.watchlist'), raw);
  assert.match(document.getElementById('mal-import-status').textContent, /recommendations refreshed/);
  assert.deepEqual(order.slice(3), ['derive', 'taste-ui', 'recommendations']);
});

test('App adapter directs a failed file-read retry back to the file input', async () => {
  const app = createApp();
  const workflow = app.getWatchlistImportWorkflow();
  await workflow.review({ name: 'unreadable.xml', text: async () => { throw new Error('Read failure'); } });
  await frame();
  assert.equal(document.activeElement.id, 'mal-import-error');
  assert.match(document.querySelector('[data-action="retry-mal-watchlist-import"]').textContent, /file selection/);
  await workflow.retry();
  await frame();
  assert.equal(document.activeElement.id, 'mal-watchlist-import-file');
  assert.equal(localStorage.getItem('rekonime.watchlist'), null);
});
