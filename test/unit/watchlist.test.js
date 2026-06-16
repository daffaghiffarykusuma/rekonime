import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { CacheManager } from '../../js/services/cache-manager.ts';
import { setupDom } from '../helpers/dom.js';
import { createAnime } from '../helpers/factories.js';

const resetState = () => {
  if (globalThis.localStorage) {
    localStorage.clear();
  }
  CacheManager.clearMemory();
  App.watchlistEntries = new Map();
  App.animeData = [];
  App.airingDashboardAdapter = null;
  App.runtimeCapabilities = null;
  App.watchlistLifecycleRuntime = null;
  App.lastRecommendationIds = new Set();
};

test('Setting watch status creates a planned watchlist entry', () => {
  setupDom();
  resetState();
  const anime = createAnime({ id: 'anime-1' });
  App.animeData = [anime];

  App.setWatchStatus(anime.id, 'planned');

  const entry = App.getWatchlistEntry(anime.id);
  assert.ok(entry);
  assert.equal(entry.status, 'planned');
  assert.equal(entry.progress, 0);
  assert.ok(entry.snapshot);
});

test('Clearing watch status removes watchlist entry', () => {
  setupDom();
  resetState();
  const anime = createAnime({ id: 'anime-2' });
  App.animeData = [anime];

  App.setWatchStatus(anime.id, 'planned');
  assert.ok(App.getWatchlistEntry(anime.id));

  App.setWatchStatus(anime.id, '');

  assert.equal(App.getWatchlistEntry(anime.id), null);
});

test('Setting watch progress upgrades planned to watching', () => {
  setupDom();
  resetState();
  const anime = createAnime({ id: 'anime-3' });
  App.animeData = [anime];

  App.setWatchStatus(anime.id, 'planned');
  App.setWatchProgress(anime.id, 2);

  const entry = App.getWatchlistEntry(anime.id);
  assert.ok(entry);
  assert.equal(entry.status, 'watching');
  assert.equal(entry.progress, 2);
});

test('Watchlist lifecycle schedules Airing Schedule through the shared adapter', () => {
  setupDom();
  resetState();
  const calls = [];
  const anime = createAnime({ id: 'anime-4' });
  App.animeData = [anime];
  App.airingDashboardAdapter = {
    scheduleUpdate: (...args) => calls.push(args)
  };

  App.setWatchStatus(anime.id, 'watching');

  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0][0], 'function');
  assert.equal(typeof calls[0][1], 'function');
  assert.deepEqual(calls[0][2], { timeout: 500 });
  assert.deepEqual(calls[0][0]().map((entry) => entry.id), ['anime-4']);
  assert.deepEqual(calls[0][1]().map((item) => item.id), ['anime-4']);
});
