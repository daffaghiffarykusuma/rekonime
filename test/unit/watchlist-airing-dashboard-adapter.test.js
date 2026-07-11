import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistAiringDashboardAdapter } from '../../js/watchlist-airing-dashboard-adapter.ts';

const createAdapter = ({ controllerOptions, factoryRejects = false, updateRejects = false } = {}) => {
  const calls = [];
  const queued = [];
  let nextHandle = 1;
  const controller = {
    update: async (payload) => {
      calls.push(['update', payload]);
      if (updateRejects) throw new Error('update failed');
    }
  };
  const adapter = createWatchlistAiringDashboardAdapter({
    cancelTask: (handle) => calls.push(['cancelTask', handle]),
    controllerOptions,
    logger: { warn: (...args) => calls.push(['warn', ...args]) },
    loadDashboardFactory: async () => {
      calls.push(['loadDashboardFactory']);
      if (factoryRejects) throw new Error('factory failed');
      return (options) => {
        calls.push(['createController', options]);
        return controller;
      };
    },
    queueTask: (callback, { timeout } = {}) => {
      const handle = nextHandle;
      nextHandle += 1;
      queued.push({ callback, handle, timeout });
      calls.push(['queueTask', handle, timeout]);
      return handle;
    }
  });
  return { adapter, calls, queued };
};

test('Watchlist Airing Dashboard Adapter schedules one dashboard update', async () => {
  const { adapter, calls, queued } = createAdapter();
  const entries = [{ id: 'show-1' }];
  const animeItems = [{ id: 'show-1', title: 'Show 1' }];

  const handle = adapter.scheduleUpdate(entries, animeItems, { timeout: 1800 });
  await queued[0].callback();

  assert.equal(handle, 1);
  assert.deepEqual(calls.map((call) => call[0]), [
    'queueTask',
    'loadDashboardFactory',
    'createController',
    'update'
  ]);
  assert.deepEqual(calls[0], ['queueTask', 1, 1800]);
  assert.equal(calls[2][1].gridId, 'airing-dashboard-grid');
  assert.deepEqual(calls[3][1], { entries, animeItems });
});

test('Watchlist Airing Dashboard Adapter resolves scheduled sources when work runs', async () => {
  const { adapter, calls, queued } = createAdapter();
  let entries = [{ id: 'show-before' }];
  let animeItems = [{ id: 'show-before', title: 'Before' }];

  adapter.scheduleUpdate(() => entries, () => animeItems, { timeout: 1800 });
  entries = [{ id: 'show-after' }];
  animeItems = [{ id: 'show-after', title: 'After' }];
  await queued[0].callback();

  assert.deepEqual(calls.at(-1), ['update', { entries, animeItems }]);
});

test('Watchlist Airing Dashboard Adapter shares controller options with callers', async () => {
  const { adapter, calls, queued } = createAdapter({
    controllerOptions: {
      sectionId: 'custom-airing-section',
      hideWhenNoEntries: false
    }
  });

  adapter.scheduleUpdate([], [], { timeout: 1800 });
  await queued[0].callback();

  assert.equal(calls[2][1].sectionId, 'custom-airing-section');
  assert.equal(calls[2][1].gridId, 'airing-dashboard-grid');
  assert.equal(calls[2][1].hideWhenNoEntries, false);
});

test('Watchlist Airing Dashboard Adapter cancels previous scheduled work', () => {
  const { adapter, calls } = createAdapter();

  adapter.scheduleUpdate([], [], { timeout: 1200 });
  adapter.scheduleUpdate([], [], { timeout: 1800 });

  assert.deepEqual(calls, [
    ['queueTask', 1, 1200],
    ['cancelTask', 1],
    ['queueTask', 2, 1800]
  ]);
});

test('Watchlist Airing Dashboard Adapter logs update failures without throwing', async () => {
  const { adapter, calls, queued } = createAdapter({ updateRejects: true });

  adapter.scheduleUpdate([], [], { timeout: 1200 });
  await queued[0].callback();

  assert.equal(calls.at(-1)[0], 'warn');
  assert.equal(calls.at(-1)[1], 'Failed to update airing dashboard');
});

test('Watchlist Airing Dashboard Adapter resets failed factory load for retry', async () => {
  const calls = [];
  const queued = [];
  let failNext = true;
  const adapter = createWatchlistAiringDashboardAdapter({
    cancelTask: (handle) => calls.push(['cancelTask', handle]),
    logger: { warn: (...args) => calls.push(['warn', ...args]) },
    loadDashboardFactory: async () => {
      calls.push(['loadDashboardFactory']);
      if (failNext) {
        failNext = false;
        throw new Error('factory failed');
      }
      return () => ({ update: async (payload) => calls.push(['update', payload]) });
    },
    queueTask: (callback, { timeout } = {}) => {
      const handle = queued.length + 1;
      queued.push({ callback, timeout });
      calls.push(['queueTask', handle, timeout]);
      return handle;
    }
  });

  adapter.scheduleUpdate([], [], { timeout: 1200 });
  await queued[0].callback();
  adapter.scheduleUpdate([{ id: 'show-1' }], [], { timeout: 1800 });
  await queued[1].callback();

  assert.equal(calls.filter((call) => call[0] === 'loadDashboardFactory').length, 2);
  assert.equal(calls.some((call) => call[0] === 'warn'), true);
  assert.equal(calls.at(-1)[0], 'update');
});
