import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATCH_STATUS_VALUES,
  WATCH_STATUS_DISPLAY_OPTIONS,
  normalizeWatchStatus,
  normalizeWatchProgress,
  buildWatchlistControlModel,
  buildWatchlistCounts,
  filterWatchlistEntries,
  buildWatchlistDisplayModel,
  buildWatchlistUpdatePayload,
  buildWatchlistTransitionEnvelope,
  createWatchlistLifecycle
} from '../../js/watchlist-state.js';

test('watchlist status normalization uses allowed values only', () => {
  assert.equal(WATCH_STATUS_VALUES.includes('planned'), true);
  assert.equal(WATCH_STATUS_DISPLAY_OPTIONS.some(option => option.value === ''), true);
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
  assert.equal(result.operation, 'status');
  assert.equal(result.statusChanged, true);
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
  assert.equal(result.operation, 'progress');
  assert.equal(result.statusChanged, true);
  assert.equal(result.progressChanged, true);
});

test('watchlist lifecycle builds shared counts, filters, and display models', () => {
  const entries = [
    { id: 'show-1', status: 'planned', snapshot: { id: 'show-1', title: 'Show 1', cover: 'cover-1.jpg' } },
    { id: 'show-2', status: 'watching', progress: 2, snapshot: { id: 'show-2', title: 'Show 2', cover: 'cover-2.jpg' } }
  ];

  assert.deepEqual(buildWatchlistCounts(entries), {
    all: 2,
    planned: 1,
    watching: 1,
    completed: 0,
    dropped: 0
  });
  assert.deepEqual(filterWatchlistEntries(entries, 'watching').map(entry => entry.id), ['show-2']);

  const model = buildWatchlistDisplayModel(entries, [{ id: 'show-2', title: 'Catalog Show 2', cover: 'catalog.jpg' }], {
    statusFilter: 'watching'
  });
  assert.equal(model.displayItems[0].title, 'Catalog Show 2');
  assert.equal(model.allDisplayItems[0].title, 'Show 1');
});

test('watchlist display puts Watching now entries before other statuses', () => {
  const entries = [
    { id: 'planned', status: 'planned', updatedAt: 300 },
    { id: 'completed', status: 'completed', updatedAt: 500 },
    { id: 'watching-old', status: 'watching', updatedAt: 100 },
    { id: 'watching-new', status: 'watching', updatedAt: 400 }
  ];

  const model = buildWatchlistDisplayModel(entries);

  assert.deepEqual(
    model.visibleEntries.map(entry => entry.id),
    ['watching-new', 'watching-old', 'completed', 'planned']
  );
});

test('watchlist lifecycle builds shared control model and update payload', () => {
  const entry = { id: 'show-1', status: 'watching', progress: 3 };
  const model = buildWatchlistControlModel(entry, {
    anime: { id: 'show-1', stats: { episodeCount: 12 } }
  });

  assert.equal(model.status, 'watching');
  assert.equal(model.showProgress, true);
  assert.equal(model.inputMax, '12');
  assert.equal(model.totalText, 'of 12');
  assert.equal(model.options.find(option => option.value === 'watching').selected, true);

  assert.deepEqual(buildWatchlistUpdatePayload({ id: 'show-1', entry, removed: false }), {
    id: 'show-1',
    removed: false,
    status: 'watching',
    progress: 3,
    entry
  });
});

test('watchlist lifecycle builds transition envelopes for adapters', () => {
  const entry = { id: 'show-1', status: 'watching', progress: 4 };
  const previousEntry = { id: 'show-1', status: 'planned', progress: 0 };
  const transition = buildWatchlistTransitionEnvelope({
    changed: true,
    id: 'show-1',
    entry,
    previousEntry,
    operation: 'status',
    statusChanged: true,
    progressChanged: true
  }, { dashboardTimeout: 500 });

  assert.equal(transition.event.name, 'rekonime:watchlist-updated');
  assert.deepEqual(transition.event.payload, {
    id: 'show-1',
    removed: false,
    status: 'watching',
    progress: 4,
    entry
  });
  assert.equal(transition.render.controls.shouldUpdate, true);
  assert.equal(transition.render.watchlist.shouldRender, true);
  assert.equal(transition.dashboard.shouldSchedule, true);
  assert.equal(transition.dashboard.timeout, 500);
  assert.deepEqual(transition.compatibilityResult, { entry });
});
