import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistLifecycleRuntime } from '../../src/features/watchlist/watchlist-lifecycle-runtime.ts';
import { parseMalWatchlistXml, planMalWatchlistImport } from '../../src/features/watchlist/mal-watchlist-import.ts';
import { createWatchlistLifecycle } from '../../src/features/watchlist/watchlist-state.js';

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
  assert.equal(result.transition.dashboard.shouldSchedule, true);
  assert.equal(result.transition.render.controls.shouldUpdate, true);
  const payload = result.transition.event.payload;
  assert.equal(payload.id, 'show-1');
  assert.equal(payload.removed, false);
  assert.equal(payload.status, 'watching');
  assert.equal(payload.progress, 0);
  assert.equal(payload.loved, false);
  assert.equal(payload.entry.id, 'show-1');
  assert.equal(payload.entry.status, 'watching');
  assert.equal(payload.entry.progress, 0);
  assert.equal(payload.snapshot.title, 'Show 1');
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
    fingerprint: '[]', errors: [],
    conflicts: [], invalidRows: [], unmatchedRows: [], warnings: [],
    proposedEntries: [{
      id: 'show-1',
      status: 'watching',
      progress: 3,
      updatedAt: 'apply-time',
      snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover.jpg' }
    }],
    summary: { sourceRows: 1, valid: 1, invalid: 0, matched: 1, creates: 1, updates: 0, conflicts: 0, unchanged: 0, skipped: 0, unmatched: 0 }
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

const importPlan = (currentEntries = []) => planMalWatchlistImport({
  parseResult: parseMalWatchlistXml('<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>Show 1</series_title><my_status>Watching</my_status><my_watched_episodes>3</my_watched_episodes></anime></myanimelist>'),
  fullCatalog: [{ id: 'show-1', malId: 1, title: 'Show 1', cover: 'cover.jpg', episodeCount: 12 }], currentEntries
});

test('import refuses cross-tab stale reviews and repeated identical imports have no effects', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  const plan = importPlan();
  assert.equal(runtime.applyImport(plan).changed, true);
  assert.equal(runtime.applyImport(plan).compatibilityResult.reason, 'stale-plan');
  const repeat = runtime.applyImport(importPlan(lifecycle.getEntries()));
  assert.equal(repeat.changed, false);
  assert.equal(repeat.compatibilityResult.status, 'no-changes');
  assert.deepEqual(repeat.effects, {});
});

test('import storage refusal, throw, serialization, and invalid candidates leave live and persisted data intact', () => {
  for (const failure of ['false', 'throw', 'circular', 'date']) {
    const storage = createMemoryStorage();
    const lifecycle = createWatchlistLifecycle({ storage, now: () => 1000 });
    lifecycle.setStatus('saved', 'planned', { snapshot: { id: 'saved', title: 'Saved', cover: 'saved.jpg' } });
    const before = storage.getItem('rekonime.watchlist');
    const live = JSON.stringify(lifecycle.getEntries());
    const plan = importPlan(lifecycle.getEntries());
    if (failure === 'circular') plan.proposedEntries[0].snapshot.circular = plan.proposedEntries[0].snapshot;
    if (failure === 'date') plan.proposedEntries[0].startedAt = NaN;
    if (failure === 'false') storage.setItem = () => false;
    if (failure === 'throw') storage.setItem = () => { throw new Error('Storage unavailable'); };
    const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle, now: () => 2000 });
    const result = runtime.applyImport(plan);
    assert.equal(result.changed, false, failure);
    assert.equal(result.compatibilityResult.status, 'rejected', failure);
    assert.deepEqual(result.effects, {});
    assert.equal(result.transition, null);
    assert.equal(storage.getItem('rekonime.watchlist'), before, failure);
    assert.equal(JSON.stringify(lifecycle.getEntries()), live, failure);
  }
});

test('import fingerprint observes a second lifecycle writing to the same persistent store', () => {
  const storage = createMemoryStorage();
  const local = createWatchlistLifecycle({ storage, now: () => 1000 });
  local.setStatus('saved', 'watching', { snapshot: { id: 'saved', title: 'Saved', cover: 'saved.jpg' } });
  const plan = importPlan(local.getEntries());
  const otherTab = createWatchlistLifecycle({ storage, now: () => 2000 });
  otherTab.load();
  otherTab.setProgress('saved', 5);
  const raw = storage.getItem('rekonime.watchlist');
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => local });
  const result = runtime.applyImport(plan);
  assert.equal(result.compatibilityResult.reason, 'stale-plan');
  assert.equal(storage.getItem('rekonime.watchlist'), raw);
  assert.equal(local.getEntry('saved').progress, 5);
});
