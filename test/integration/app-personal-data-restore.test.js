import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';

const restoredEntry = {
  id: 'restored',
  status: 'planned',
  progress: 0,
  updatedAt: 1000,
  snapshot: { id: 'restored', title: 'Restored', cover: 'restored.jpg' }
};

test('App refreshes Watchlist-dependent UI after Personal Data Restore', async () => {
  const originals = {
    currentAnimeId: App.currentAnimeId,
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
    App.currentAnimeId = 'restored';
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
