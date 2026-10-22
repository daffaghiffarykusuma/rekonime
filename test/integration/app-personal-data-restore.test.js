import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { MAX_IMPORT_BYTES } from '../../src/shared/security/import-limits.ts';

test('App rejects oversized backups before reading or touching personal storage', async () => {
  const originalToast = App.showToast;
  let reads = 0;
  const messages = [];
  App.showToast = message => messages.push(message);
  try {
    const result = await App.restorePersonalDataFile({ size: MAX_IMPORT_BYTES + 1, text: async () => { reads++; return '{}'; } });
    assert.deepEqual(result, { ok: false, reason: 'invalid_file' });
    assert.equal(reads, 0);
    assert.match(messages[0], /10 MiB/);
  } finally { App.showToast = originalToast; }
});

const restoredEntry = {
  id: 'restored',
  status: 'planned',
  progress: 0,
  updatedAt: 1000,
  snapshot: { id: 'restored', title: 'Restored', cover: 'restored.jpg' }
};

test('App refreshes Watchlist-dependent UI after Personal Data Restore', async () => {
  const originals = {
    detailExperience: App.detailExperience,
    getTasteProfileStore: App.getTasteProfileStore,
    getWatchlistLifecycle: App.getWatchlistLifecycle,
    getCache: App.getCache,
    updateTasteProfileUi: App.updateTasteProfileUi,
    renderRecommendations: App.renderRecommendations,
    renderWatchlist: App.renderWatchlist,
    updateWatchlistControls: App.updateWatchlistControls,
    scheduleAiringDashboardRender: App.scheduleAiringDashboardRender,
    showToast: App.showToast
  };
  const journal = new Map();
  const calls = [];
  const tasteProfileStore = {
    load: () => ({}),
    commitProfile: () => true,
    getPersistedRaw: () => null,
    restorePersistedRaw: () => true
  };
  const watchlistLifecycle = {
    load: () => new Map(),
    getEntries: () => [],
    commitEntries: () => true,
    getPersistedRaw: () => null,
    restorePersistedRaw: () => true
  };
  const storage = {
    getJSON: (key) => journal.get(key) || null,
    setJSON: (key, value) => { journal.set(key, value); return true; },
    removeItem: (key) => journal.delete(key)
  };

  try {
    App.detailExperience = { getCurrentAnimeId: () => 'restored' };
    App.getTasteProfileStore = () => tasteProfileStore;
    App.getWatchlistLifecycle = () => watchlistLifecycle;
    App.getCache = () => storage;
    App.updateTasteProfileUi = () => calls.push('taste-profile');
    App.renderRecommendations = () => calls.push('recommendations');
    App.renderWatchlist = () => calls.push('watchlist');
    App.updateWatchlistControls = (id) => calls.push(`controls:${id}`);
    App.scheduleAiringDashboardRender = () => calls.push('airing');
    App.showToast = (message) => calls.push(message);

    const result = await App.restorePersonalDataFile({
      text: async () => JSON.stringify({
        version: 1,
        tasteProfile: { version: 1, explicit: { preferredGenres: [] }, inferred: {} },
        watchlist: [restoredEntry]
      })
    });

    assert.deepEqual(result, { ok: true, mode: 'full', watchlistCount: 1 });
    assert.deepEqual(calls, [
      'taste-profile',
      'recommendations',
      'watchlist',
      'controls:restored',
      'airing',
      'Personal data restored.'
    ]);
  } finally {
    Object.assign(App, originals);
  }
});
