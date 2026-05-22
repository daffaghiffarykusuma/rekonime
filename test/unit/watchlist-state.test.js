import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATCH_STATUS_VALUES,
  normalizeWatchStatus,
  normalizeWatchProgress,
  createWatchlistLifecycle
} from '../../js/watchlist-state.js';

test('watchlist status normalization uses allowed values only', () => {
  assert.equal(WATCH_STATUS_VALUES.includes('planned'), true);
  assert.equal(normalizeWatchStatus('WATCHING'), 'watching');
  assert.equal(normalizeWatchStatus('unknown'), 'planned');
});

test('watchlist progress normalization floors and clamps to non-negative', () => {
  assert.equal(normalizeWatchProgress(3.8), 3);
  assert.equal(normalizeWatchProgress('-7'), 0);
  assert.equal(normalizeWatchProgress('not-a-number'), 0);
});

const createMemoryStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    dump: () => Object.fromEntries(store.entries())
  };
};

test('watchlist lifecycle migrates legacy bookmarks into persisted entries', () => {
  const storage = createMemoryStorage({
    'rekonime.bookmarks': JSON.stringify({
      ids: ['show-1'],
      items: [{ id: 'show-2', title: 'Show 2', cover: 'cover.jpg' }]
    })
  });
  const lifecycle = createWatchlistLifecycle({ storage, now: () => 1000, placeholderCover: 'fallback.jpg' });

  lifecycle.load();
  const result = lifecycle.migrateLegacy();

  assert.equal(result.changed, true);
  assert.equal(lifecycle.getEntry('show-1').status, 'planned');
  assert.equal(lifecycle.getEntry('show-2').snapshot.title, 'Show 2');
  assert.equal(storage.getItem('rekonime.bookmarks'), null);
});

test('watchlist lifecycle owns status timestamps and completion progress', () => {
  const storage = createMemoryStorage();
  const lifecycle = createWatchlistLifecycle({ storage, now: () => 2000 });

  const result = lifecycle.setStatus('show-1', 'completed', {
    episodeCount: 12,
    snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover.jpg' }
  });

  assert.equal(result.entry.status, 'completed');
  assert.equal(result.entry.progress, 12);
  assert.equal(result.entry.startedAt, 2000);
  assert.equal(result.entry.completedAt, 2000);
});

test('watchlist lifecycle clamps progress and upgrades planned entries to watching', () => {
  const storage = createMemoryStorage();
  const lifecycle = createWatchlistLifecycle({ storage, now: () => 3000 });
  lifecycle.setStatus('show-1', 'planned', {
    snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover.jpg' }
  });

  const result = lifecycle.setProgress('show-1', 20, { episodeCount: 8 });

  assert.equal(result.entry.status, 'watching');
  assert.equal(result.entry.progress, 8);
  assert.equal(result.entry.startedAt, 3000);
});
