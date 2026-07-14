import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistLifecycleRuntime } from '../../js/watchlist-lifecycle-runtime.ts';
import { createWatchlistLifecycle } from '../../js/watchlist-state.js';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
};

const createRuntimeHarness = ({ lastRecommendationIds = [] } = {}) => {
  const animeData = [{
    id: 'show-1',
    title: 'Show 1',
    cover: 'cover.jpg',
    episodeCount: 12
  }];
  const lifecycle = createWatchlistLifecycle({
    storage: createMemoryStorage(),
    now: () => 1000
  });
  const runtime = createWatchlistLifecycleRuntime({
    buildSnapshot: (anime) => anime ? { id: anime.id, title: anime.title, cover: anime.cover } : null,
    getAnime: (animeId) => animeData.find(item => item.id === animeId) || null,
    getEpisodeLimit: (animeId) => animeData.find(item => item.id === animeId)?.episodeCount || null,
    getLifecycle: () => lifecycle,
    isLastRecommendation: (animeId) => lastRecommendationIds.includes(animeId),
    now: () => 1000
  });
  return { lifecycle, runtime };
};

test('Watchlist Lifecycle Runtime loads page state and preserves its Snapshot', () => {
  const storage = createMemoryStorage();
  const seeded = createWatchlistLifecycle({ storage, now: () => 1000 });
  seeded.setStatus('show-1', 'planned', {
    snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover.jpg' }
  });
  const runtime = createWatchlistLifecycleRuntime({
    buildSnapshot: () => null,
    dashboardTimeout: null,
    getAnime: () => null,
    getEpisodeLimit: () => null,
    getLifecycle: () => createWatchlistLifecycle({ storage, now: () => 2000 }),
    loadBeforeTransition: true,
    renderMode: null
  });

  const result = runtime.setStatus('show-1', 'watching', { episodeCount: 12 });

  assert.equal(result.transition.entry.snapshot.title, 'Show 1');
  assert.equal(result.transition.render.watchlist.shouldRender, true);
  assert.equal(result.transition.dashboard.shouldSchedule, false);
});

test('Watchlist Lifecycle Runtime owns status transition envelope and follow-up effects', () => {
  const { lifecycle, runtime } = createRuntimeHarness({ lastRecommendationIds: ['show-1'] });

  const result = runtime.setStatus('show-1', 'watching');

  assert.equal(lifecycle.getEntry('show-1').status, 'watching');
  assert.equal(result.compatibilityResult.entry.id, 'show-1');
  assert.equal(result.transition.event.name, 'rekonime:watchlist-updated');
  assert.equal(result.transition.dashboard.timeout, 500);
  assert.deepEqual(result.transition.feedback, {
    message: 'Saved to Watching now',
    action: { label: 'View watchlist', href: '/watchlist.html' }
  });
  assert.deepEqual(result.effects, {
    clearViewingIntent: true,
    refreshTasteProfile: true,
    renderRecommendations: true
  });
});

test('Watchlist Lifecycle Runtime owns progress and loved transition effects', () => {
  const { lifecycle, runtime } = createRuntimeHarness();

  const progress = runtime.setProgress('show-1', 20);
  assert.equal(progress.compatibilityResult.entry.progress, 12);
  assert.deepEqual(progress.effects, {
    clearViewingIntent: false,
    refreshTasteProfile: true,
    renderRecommendations: false
  });

  const loved = runtime.setLoved('show-1', true);
  assert.equal(lifecycle.getEntry('show-1').loved, true);
  assert.deepEqual(loved.effects, {
    clearViewingIntent: false,
    refreshTasteProfile: true,
    renderRecommendations: true
  });
});

test('Watchlist Lifecycle Runtime applies one imported batch and returns one effect envelope', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  const result = runtime.applyImport({
    ok: true,
    catalogScope: 'full',
    proposedEntries: [{
      id: 'show-1',
      status: 'watching',
      progress: 3,
      updatedAt: 'apply-time',
      snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover.jpg' }
    }],
    summary: { sourceRows: 1, matched: 1, creates: 1, skipped: 0, unmatched: 0 }
  });

  assert.equal(lifecycle.getEntry('show-1').updatedAt, 1000);
  assert.equal(result.changed, true);
  assert.equal(result.transition.operation, 'import');
  assert.equal(result.transition.render.watchlist.shouldRender, true);
  assert.deepEqual(result.transition.event.payload.changedIds, ['show-1']);
  assert.deepEqual(result.effects, {
    clearViewingIntent: false,
    refreshTasteProfile: true,
    renderRecommendations: true,
    updateTasteProfileUi: true
  });
});
