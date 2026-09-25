import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { CacheManager } from '../../src/shared/services/cache-manager.ts';
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

test('Clearing watch status removes watchlist entry', () => {
  setupDom();
  resetState();
  const anime = createAnime({ id: 'anime-2' });
  App.animeData = [anime];

  App.setWatchStatus(anime.id, 'planned');
  const planned = App.getWatchlistLifecycle().getEntry(anime.id);
  assert.equal(planned.status, 'planned');
  assert.equal(planned.progress, 0);
  assert.equal(planned.snapshot.id, anime.id);

  App.setWatchStatus(anime.id, '');

  assert.equal(App.getWatchlistLifecycle().getEntry(anime.id), null);
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

  App.setWatchStatus(anime.id, 'planned');
  assert.equal(calls.length, 1);
  calls.length = 0;
  App.setWatchProgress(anime.id, 2);

  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0][0], 'function');
  assert.equal(typeof calls[0][1], 'function');
  assert.deepEqual(calls[0][2], { timeout: 500 });
  assert.deepEqual(calls[0][0]().map((entry) => entry.id), ['anime-4']);
  assert.deepEqual(calls[0][1]().map((item) => item.id), ['anime-4']);
  assert.equal(App.getWatchlistLifecycle().getEntry(anime.id).status, 'watching');
  assert.equal(App.getWatchlistLifecycle().getEntry(anime.id).progress, 2);
});
