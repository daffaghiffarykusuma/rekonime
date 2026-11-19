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

const createRuntimeHarness = ({ storage = createMemoryStorage() } = {}) => {
  const animeData = [{
    id: 'show-1',
    title: 'Show 1',
    cover: 'cover.jpg',
    episodeCount: 12
  }];
  const lifecycle = createWatchlistLifecycle({
    storage,
    now: () => 1000
  });
  const runtime = createWatchlistLifecycleRuntime({
    buildSnapshot: (anime) => anime ? { id: anime.id, title: anime.title, cover: anime.cover } : null,
    getAnime: (animeId) => animeData.find(item => item.id === animeId) || null,
    getEpisodeLimit: (animeId) => animeData.find(item => item.id === animeId)?.episodeCount || null,
    getLifecycle: () => lifecycle,
    now: () => 1000
  });
  return { lifecycle, runtime };
};

test('a Discovery selection can be undone without deleting another saved title', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  const selected = runtime.selectForLater('show-1');
  assert.equal(selected.changed, true);
  assert.equal(lifecycle.getEntry('show-1').status, 'planned');
  runtime.setStatus('other-title', 'completed');
  const undone = runtime.undoSelection(selected.undoToken);
  assert.equal(undone.changed, true);
  lifecycle.load();
  assert.equal(lifecycle.getEntry('show-1'), null);
  assert.equal(lifecycle.getEntry('other-title').status, 'completed');
  assert.equal(runtime.undoSelection(selected.undoToken).changed, false);
});

test('selection Undo restores prior progress and affinity while retaining refreshed catalog metadata', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  runtime.setStatus('show-1', 'completed');
  runtime.setLoved('show-1', true);
  const before = structuredClone(lifecycle.getEntry('show-1'));
  const selected = runtime.selectForLater('show-1');
  lifecycle.refreshSnapshotsFromCatalog([{ id: 'show-1', title: 'Updated title', cover: 'new.jpg' }], { persist: true, replaceExisting: true });
  const undone = runtime.undoSelection(selected.undoToken);
  assert.equal(undone.changed, true);
  lifecycle.load();
  const restored = lifecycle.getEntry('show-1');
  assert.equal(restored.status, 'completed');
  assert.equal(restored.progress, 12);
  assert.equal(restored.completedAt, before.completedAt);
  assert.equal(restored.loved, true);
  assert.equal(restored.snapshot.title, 'Updated title');
});

test('selection Undo preserves newer changes from another tab and cannot retry a stale reversal', () => {
  const storage = createMemoryStorage();
  const { lifecycle, runtime } = createRuntimeHarness({ storage });
  const selected = runtime.selectForLater('show-1');
  const otherTab = createWatchlistLifecycle({ storage, now: () => 2000 });
  otherTab.load();
  otherTab.setProgress('show-1', 3);
  otherTab.setStatus('another-title', 'planned');
  const saved = storage.getItem('rekonime.watchlist');
  const rejected = runtime.undoSelection(selected.undoToken);
  assert.equal(rejected.changed, false);
  assert.equal(rejected.compatibilityResult.reason, 'stale-selection');
  assert.deepEqual(rejected.effects, {});
  assert.equal(storage.getItem('rekonime.watchlist'), saved);
  assert.equal(lifecycle.getEntry('show-1').progress, 3);
  assert.equal(lifecycle.getEntry('another-title').status, 'planned');
});

test('failed selection and failed Undo retain persisted state and support retry', () => {
  for (const failure of ['refused', 'thrown']) {
    const storage = createMemoryStorage();
    const write = storage.setItem;
    const { lifecycle, runtime } = createRuntimeHarness({ storage });
    const block = () => {
      storage.setItem = () => { if (failure === 'thrown') throw new Error('Full'); return false; };
    };
    block();
    const failed = runtime.selectForLater('show-1');
    assert.equal(failed.changed, false);
    assert.equal(failed.undoToken, undefined);
    assert.equal(lifecycle.getEntry('show-1'), null);
    storage.setItem = write;
    const selected = runtime.selectForLater('show-1');
    const saved = storage.getItem('rekonime.watchlist');
    block();
    const rejected = runtime.undoSelection(selected.undoToken);
    assert.equal(rejected.compatibilityResult.reason, 'storage-failed');
    assert.equal(rejected.changed, false);
    assert.deepEqual(rejected.effects, {});
    assert.equal(lifecycle.getEntry('show-1').status, 'planned');
    assert.equal(storage.getItem('rekonime.watchlist'), saved);
    storage.setItem = write;
    assert.equal(runtime.undoSelection(selected.undoToken).changed, true);
    lifecycle.load();
    assert.equal(lifecycle.getEntry('show-1'), null);
  }
});

test('a refused Planned save keeps Watchlist state unchanged and can be retried', () => {
  const storage = createMemoryStorage();
  const write = storage.setItem;
  const { lifecycle, runtime } = createRuntimeHarness({ storage });
  runtime.setStatus('saved-title', 'completed');
  const before = lifecycle.getEntries();
  const persistedBefore = storage.getItem('rekonime.watchlist');
  storage.setItem = () => false;

  const failed = runtime.setStatus('show-1', 'planned');
  assert.equal(failed.changed, false);
  assert.equal(failed.compatibilityResult.reason, 'storage-failed');
  assert.deepEqual(failed.effects, {});
  assert.equal(failed.transition, null);
  assert.deepEqual(lifecycle.getEntries(), before);
  assert.equal(storage.getItem('rekonime.watchlist'), persistedBefore);

  storage.setItem = write;
  const saved = runtime.setStatus('show-1', 'planned');
  assert.equal(saved.changed, true);
  lifecycle.load();
  assert.equal(lifecycle.getEntry('show-1').status, 'planned');
  assert.equal(lifecycle.getEntry('show-1').startedAt, undefined);
  assert.deepEqual(lifecycle.getEntry('saved-title'), before[0]);
});

test('thrown storage writes preserve an existing Entry when changing or removing its status', () => {
  const storage = createMemoryStorage();
  const { lifecycle, runtime } = createRuntimeHarness({ storage });
  runtime.setStatus('show-1', 'completed');
  runtime.setLoved('show-1', true);
  const before = structuredClone(lifecycle.getEntry('show-1'));
  const persistedBefore = storage.getItem('rekonime.watchlist');
  storage.setItem = () => { throw new Error('storage unavailable'); };

  for (const status of ['planned', '']) {
    const failed = runtime.setStatus('show-1', status);
    assert.equal(failed.changed, false);
    assert.equal(failed.compatibilityResult.reason, 'storage-failed');
    assert.equal(failed.transition, null);
    assert.deepEqual(failed.effects, {});
    assert.deepEqual(lifecycle.getEntry('show-1'), before);
    assert.equal(storage.getItem('rekonime.watchlist'), persistedBefore);
  }
});

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
  const { lifecycle, runtime } = createRuntimeHarness();

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
    refreshTasteProfile: true,
    renderRecommendations: true
  });
});

test('Watchlist Lifecycle Runtime owns progress and loved transition effects', () => {
  const { lifecycle, runtime } = createRuntimeHarness();

  const progress = runtime.setProgress('show-1', 20);
  assert.equal(progress.compatibilityResult.entry.progress, 12);
  assert.deepEqual(progress.effects, {
    refreshTasteProfile: true,
    renderRecommendations: false
  });

  const loved = runtime.setLoved('show-1', true);
  assert.equal(lifecycle.getEntry('show-1').loved, true);
  assert.deepEqual(loved.effects, {
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

const createRecordingHost = (ports = null) => {
  const calls = [];
  const all = ['updateControls', 'renderWatchlist', 'renderContinueWatching', 'emit', 'scheduleDashboard',
    'announce', 'announceFailure', 'refreshTasteProfile', 'updateTasteProfileUi', 'renderRecommendations'];
  const host = {};
  for (const port of ports || all) host[port] = (...args) => calls.push([port, ...args]);
  return { calls, host, names: () => calls.map(call => call[0]) };
};

test('a status change applies every effect through the host in one order', () => {
  const lifecycle = createWatchlistLifecycle({ storage: createMemoryStorage(), now: () => 1000 });
  const { host, names, calls } = createRecordingHost();
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle, host });

  runtime.setStatus('show-1', 'watching');

  assert.deepEqual(names(), ['updateControls', 'emit', 'scheduleDashboard', 'announce', 'renderContinueWatching',
    'refreshTasteProfile', 'renderRecommendations']);
  assert.equal(calls[1][1], 'rekonime:watchlist-updated');
  assert.equal(calls[1][2].id, 'show-1');
  assert.deepEqual(calls[2][1], { timeout: 500 });
});

test('a page without a Discovery shortlist still refreshes Taste Profile evidence and emits the event', () => {
  const lifecycle = createWatchlistLifecycle({ storage: createMemoryStorage(), now: () => 1000 });
  const { host, names } = createRecordingHost(['updateControls', 'renderWatchlist', 'emit', 'announce', 'refreshTasteProfile']);
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle, host, dashboardTimeout: null, renderMode: null });

  runtime.setStatus('show-1', 'completed');

  assert.deepEqual(names(), ['updateControls', 'emit', 'announce', 'renderWatchlist', 'refreshTasteProfile']);
});

test('a storage failure redraws the title controls and announces, on any page', () => {
  const storage = createMemoryStorage();
  const lifecycle = createWatchlistLifecycle({ storage, now: () => 1000 });
  lifecycle.setStatus('show-1', 'watching', { snapshot: { id: 'show-1', title: 'Show 1', cover: 'c.jpg' } });
  storage.setItem = () => false;
  const { host, names, calls } = createRecordingHost(['updateControls', 'emit', 'announceFailure']);
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle, host });

  const result = runtime.setStatus('show-1', 'completed');

  assert.equal(result.changed, false);
  assert.deepEqual(names(), ['updateControls', 'announceFailure']);
  assert.equal(calls[0][2].status, 'watching');
  assert.match(calls[1][1].message, /Couldn't save your Watchlist change/);
});

test('advancing progress counts the next episode, then finishes at the Snapshot total before the catalog loads', () => {
  const lifecycle = createWatchlistLifecycle({ storage: createMemoryStorage(), now: () => 1000 });
  lifecycle.setStatus('show-1', 'watching', { snapshot: { id: 'show-1', title: 'Show 1', cover: 'c.jpg', stats: { episodeCount: 2 } } });
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle });

  runtime.advanceProgress('show-1');
  runtime.advanceProgress('show-1');
  assert.equal(lifecycle.getEntry('show-1').progress, 2);
  assert.equal(lifecycle.getEntry('show-1').status, 'watching');

  runtime.advanceProgress('show-1');
  assert.equal(lifecycle.getEntry('show-1').status, 'completed');
  assert.equal(runtime.advanceProgress('missing'), null);
});

test('preparing entries for display migrates legacy bookmarks and persists fallback Snapshots', () => {
  const storage = createMemoryStorage();
  storage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, updatedAt: 1, entries: [
    { id: 'show-1', status: 'planned', progress: 0, updatedAt: 1 }
  ] }));
  storage.setItem('rekonime.bookmarks', JSON.stringify(['legacy-1']));
  const getLifecycle = () => createWatchlistLifecycle({ storage, now: () => 1000, placeholderCover: 'p.webp' });
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle });

  const entries = runtime.prepareEntries({ buildFallbackSnapshot: (entry) => ({ id: entry.id, title: 'Fallback', cover: 'p.webp' }) });

  assert.deepEqual(entries.map(entry => entry.id).sort(), ['legacy-1', 'show-1']);
  const persisted = JSON.parse(storage.getItem('rekonime.watchlist')).entries;
  assert.equal(persisted.find(entry => entry.id === 'show-1').snapshot.title, 'Fallback');
  assert.equal(storage.getItem('rekonime.bookmarks'), null);
});

test('toggling loved flips the persisted affinity rather than trusting page state', () => {
  const lifecycle = createWatchlistLifecycle({ storage: createMemoryStorage(), now: () => 1000 });
  lifecycle.setStatus('show-1', 'completed', { snapshot: { id: 'show-1', title: 'Show 1', cover: 'c.jpg' } });
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle });

  runtime.toggleLoved('show-1');
  assert.equal(lifecycle.getEntry('show-1').loved, true);
  runtime.toggleLoved('show-1');
  assert.equal(Boolean(lifecycle.getEntry('show-1').loved), false);
});

test('a status change offers Undo that restores the previous entry', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  runtime.setStatus('show-1', 'watching');
  runtime.setProgress('show-1', 4);
  const before = structuredClone(lifecycle.getEntry('show-1'));

  const changed = runtime.setStatus('show-1', 'dropped');
  assert.equal(changed.offerUndo, true);
  const undone = runtime.undoSelection(changed.undoToken);
  assert.equal(undone.changed, true);
  assert.equal(undone.transition.feedback.message, 'Undid Watchlist change');
  assert.equal(undone.transition.render.watchlist.shouldRender, true);
  lifecycle.load();
  assert.deepEqual(lifecycle.getEntry('show-1'), before);
});

test('Undo brings back a removed Watchlist entry with its Snapshot', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  runtime.setStatus('show-1', 'completed');
  const before = structuredClone(lifecycle.getEntry('show-1'));

  const removed = runtime.setStatus('show-1', '');
  assert.equal(removed.transition.removed, true);
  assert.equal(runtime.undoSelection(removed.undoToken).changed, true);
  lifecycle.load();
  assert.deepEqual(lifecycle.getEntry('show-1'), before);
});

test('status Undo is rejected after a newer change to the same entry', () => {
  const { lifecycle, runtime } = createRuntimeHarness();
  const changed = runtime.setStatus('show-1', 'watching');
  runtime.setProgress('show-1', 3);
  const rejected = runtime.undoSelection(changed.undoToken);
  assert.equal(rejected.changed, false);
  assert.equal(rejected.compatibilityResult.reason, 'stale-selection');
  assert.equal(lifecycle.getEntry('show-1').progress, 3);
});

test('a Discovery selection keeps its own Undo control instead of a toast Undo', () => {
  const { runtime } = createRuntimeHarness();
  const selected = runtime.selectForLater('show-1');
  assert.equal(selected.offerUndo, false);
  assert.ok(selected.undoToken);
});

test('status feedback carries Undo through the host and reports a stale Undo', () => {
  const lifecycle = createWatchlistLifecycle({ storage: createMemoryStorage(), now: () => 1000 });
  const { calls, host } = createRecordingHost(['announce', 'announceFailure']);
  const runtime = createWatchlistLifecycleRuntime({ getLifecycle: () => lifecycle, host });

  runtime.setStatus('show-1', 'watching', { episodeCount: 12 });
  const [, saved] = calls.find(call => call[0] === 'announce');
  assert.equal(typeof saved.undo, 'function');
  saved.undo();
  assert.equal(lifecycle.getEntry('show-1'), null);
  assert.equal(calls.at(-1)[1].message, 'Undid Watchlist change');
  assert.equal(calls.at(-1)[1].undo, undefined);

  runtime.setStatus('show-1', 'watching', { episodeCount: 12 });
  const [, second] = calls.at(-1);
  runtime.setProgress('show-1', 2, { episodeCount: 12 });
  second.undo();
  assert.equal(calls.at(-1)[0], 'announceFailure');
  assert.match(calls.at(-1)[1].message, /changed again/);
  assert.equal(lifecycle.getEntry('show-1').progress, 2);
});
