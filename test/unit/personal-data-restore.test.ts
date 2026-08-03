import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recoverPendingPersonalDataRestore,
  restorePersonalData
} from '../../js/personal-data-restore.ts';
import { createTasteProfileStore } from '../../js/taste-profile.ts';
import { createWatchlistLifecycle } from '../../js/watchlist-state.js';

const profile = (preferredGenres: string[] = []) => ({
  version: 1,
  updatedAt: 1,
  explicit: {
    moreLikeTitleIds: [],
    notForMeTitleIds: [],
    preferredGenres,
    preferredThemes: [],
    reducedGenres: [],
    reducedThemes: []
  },
  inferred: {
    positiveGenres: [],
    positiveThemes: [],
    negativeGenres: [],
    negativeThemes: []
  }
});

const entry = (id: string, status = 'completed') => ({
  id,
  status,
  progress: 12,
  updatedAt: 1000,
  snapshot: {
    id,
    title: id,
    cover: `${id}.jpg`,
    genres: ['Drama'],
    themes: ['Coming of Age']
  }
});

const memoryStorage = () => {
  const values = new Map<string, string>();
  const failedJSONKeys = new Set<string>();
  return {
    getJSON: (key: string) => {
      const value = values.get(key);
      return value ? JSON.parse(value) : null;
    },
    getRaw: (key: string) => values.get(key) || '',
    getItem: (key: string) => values.get(key) || null,
    setJSON: (key: string, value: unknown) => {
      values.set(key, JSON.stringify(value));
      return !failedJSONKeys.has(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
      return true;
    },
    setRaw: (key: string, value: string) => {
      values.set(key, String(value));
      return true;
    },
    removeItem: (key: string) => values.delete(key),
    failJSON: (key: string) => failedJSONKeys.add(key)
  };
};

const harness = ({ tasteFails = false, watchlistFails = false } = {}) => {
  const existing = entry('existing', 'planned');
  const storage = memoryStorage();
  const tasteProfileStore = createTasteProfileStore({
    storage,
    now: () => 2000
  });
  tasteProfileStore.load();
  tasteProfileStore.commitProfile(profile());
  const sharedEntries = new Map([[existing.id, existing]]);
  const watchlistLifecycle = createWatchlistLifecycle({
    storage,
    now: () => 2000,
    entries: sharedEntries
  } as any);
  watchlistLifecycle.commitEntries(sharedEntries);
  if (tasteFails) storage.failJSON('rekonime.tasteProfile');
  if (watchlistFails) storage.failJSON('rekonime.watchlist');
  return { tasteProfileStore, watchlistLifecycle, storage, sharedEntries };
};

test('Personal Data Restore commits a full export and refreshes inferred evidence', () => {
  const runtime = harness();
  const restored = entry('restored');
  const result = restorePersonalData({
    version: 1,
    generatedAt: '2026-08-03T00:00:00.000Z',
    tasteProfile: profile(['Action']),
    watchlist: [restored]
  }, runtime);

  assert.deepEqual(result, { ok: true, mode: 'full', watchlistCount: 1 });
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['restored']);
  assert.deepEqual(runtime.tasteProfileStore.getProfile().explicit.preferredGenres, ['Action']);
  assert.deepEqual(runtime.tasteProfileStore.getProfile().inferred.positiveGenres, [{ label: 'Drama', weight: 3 }]);
});

test('Personal Data Restore accepts profile-only data without replacing Watchlist Lifecycle', () => {
  const runtime = harness();
  const result = restorePersonalData(profile(['Comedy']), runtime);

  assert.deepEqual(result, { ok: true, mode: 'profile-only', watchlistCount: 0 });
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
  assert.deepEqual(runtime.tasteProfileStore.getProfile().explicit.preferredGenres, ['Comedy']);
});

test('Personal Data Restore rejects duplicate or invalid Watchlist Entries before writing', () => {
  const runtime = harness();
  const duplicate = entry('duplicate');
  const result = restorePersonalData({
    version: 1,
    tasteProfile: profile(),
    watchlist: [duplicate, duplicate]
  }, runtime);

  assert.deepEqual(result, { ok: false, reason: 'invalid_watchlist' });
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
});

test('Personal Data Restore rejects unsupported versions before writing', () => {
  const runtime = harness();
  const result = restorePersonalData({
    version: 2,
    tasteProfile: profile(),
    watchlist: []
  }, runtime);

  assert.deepEqual(result, { ok: false, reason: 'unsupported_version' });
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
});

test('Personal Data Restore rolls back Watchlist Lifecycle when Taste Profile storage fails', () => {
  const runtime = harness({ tasteFails: true });
  const result = restorePersonalData({
    version: 1,
    tasteProfile: profile(['Action']),
    watchlist: [entry('restored')]
  }, runtime);

  assert.deepEqual(result, { ok: false, reason: 'storage_failure' });
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
  assert.deepEqual([...runtime.sharedEntries.keys()], ['existing']);
  runtime.tasteProfileStore.load();
  assert.deepEqual(runtime.tasteProfileStore.getProfile().explicit.preferredGenres, []);
});

test('Personal Data Restore recovers an interrupted full restore before domain data loads', () => {
  const runtime = harness();
  const previousTaste = runtime.storage.getRaw('rekonime.tasteProfile');
  const previousWatchlist = runtime.storage.getRaw('rekonime.watchlist');
  runtime.storage.setJSON('rekonime.personalDataRestoreJournal', {
    version: 1,
    tasteProfileRaw: previousTaste,
    watchlistRaw: previousWatchlist
  });
  runtime.storage.setRaw('rekonime.tasteProfile', JSON.stringify(profile(['Changed'])));
  runtime.storage.setRaw('rekonime.watchlist', JSON.stringify({
    version: 1,
    updatedAt: 3000,
    entries: [entry('changed')]
  }));

  assert.deepEqual(recoverPendingPersonalDataRestore(runtime.storage, runtime), { ok: true, recovered: true });
  runtime.tasteProfileStore.load();
  runtime.watchlistLifecycle.load();
  assert.deepEqual(runtime.tasteProfileStore.getProfile().explicit.preferredGenres, []);
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
});

test('Personal Data Restore restores fallback storage when the Watchlist write reports failure', () => {
  const runtime = harness({ watchlistFails: true });
  const result = restorePersonalData({
    version: 1,
    tasteProfile: profile(['Action']),
    watchlist: [entry('restored')]
  }, runtime);

  assert.deepEqual(result, { ok: false, reason: 'storage_failure' });
  runtime.watchlistLifecycle.load();
  assert.deepEqual(runtime.watchlistLifecycle.getEntries().map(item => item.id), ['existing']);
  assert.deepEqual(runtime.tasteProfileStore.getProfile().explicit.preferredGenres, []);
});
