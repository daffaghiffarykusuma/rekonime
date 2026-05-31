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
