import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewingIntentRuntime
} from '../../src/features/discovery/viewing-intent.ts';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
};

test('Viewing Intent exposes the agreed outcome vocabulary', () => {
  const runtime = createViewingIntentRuntime({ storage: createStorage() });

  assert.deepEqual(
    runtime.getOptions().map(intent => intent.label),
    [
      'Help me unwind',
      'Give me energy',
      'Make me feel something',
      'Pull me into another world',
      'Surprise me'
    ]
  );
});

test('Viewing Intent apply transition owns active definition and follow-up effects', () => {
  const runtime = createViewingIntentRuntime({ storage: createStorage(), now: () => 100 });

  const result = runtime.apply('unwind');

  assert.deepEqual(result, {
    changed: true,
    active: {
      key: 'unwind',
      label: 'Help me unwind',
      description: 'Slice-of-life and iyashikei suggestions.',
      activeAt: 100
    },
    effects: {
      collapseOptions: true,
      renderViewingIntents: true,
      renderRecommendationModes: true,
      renderRecommendations: true,
      announcement: ''
    }
  });
  assert.equal(runtime.getActive()?.label, 'Help me unwind');
});

test('Viewing Intent clear transition owns follow-up effects and optional announcement', () => {
  const runtime = createViewingIntentRuntime({ storage: createStorage(), now: () => 200 });
  runtime.apply('immersive');

  const result = runtime.clear({ announce: true });

  assert.deepEqual(result, {
    changed: true,
    active: null,
    effects: {
      collapseOptions: false,
      renderViewingIntents: true,
      renderRecommendationModes: true,
      renderRecommendations: true,
      announcement: 'Added to Watching now. Choose another viewing goal when you are ready.'
    }
  });
  assert.equal(runtime.getActive(), null);
});

test('Viewing Intent persists in session storage and expires after four hours of inactivity', () => {
  const storage = createStorage();
  let now = Date.parse('2026-06-15T08:00:00Z');
  const runtime = createViewingIntentRuntime({ storage, now: () => now });

  runtime.apply('unwind');
  assert.equal(runtime.getActive()?.key, 'unwind');

  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(runtime.getActive()?.key, 'unwind');

  now += (4 * 60 * 60 * 1000) + 1;
  assert.equal(runtime.getActive(), null);
});

test('Session Dismissal survives reload and goal changes without needing a Viewing Intent', () => {
  const storage = createStorage();
  const runtime = createViewingIntentRuntime({ storage, now: () => 100 });
  assert.equal(runtime.dismiss({ id: 42, title: 'A quiet afternoon' }).changed, true);
  assert.equal(runtime.getActive(), null);
  const reloaded = createViewingIntentRuntime({ storage, now: () => 200 });
  assert.deepEqual(reloaded.getDismissed(), [{ id: '42', title: 'A quiet afternoon' }]);
  reloaded.apply('energy');
  assert.deepEqual(reloaded.getDismissed(), [{ id: '42', title: 'A quiet afternoon' }]);
  reloaded.clear();
  assert.equal(reloaded.getDismissed().length, 1);
  assert.equal(reloaded.restore('42').changed, true);
  assert.deepEqual(reloaded.getDismissed(), []);
});

test('Discovery rendering does not renew dismissals; activity slides expiry and expired state cannot revive', () => {
  const storage = createStorage();
  let now = 100;
  const runtime = createViewingIntentRuntime({ storage, now: () => now });
  runtime.dismiss({ id: 1, title: 'First pick' });
  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(runtime.getDismissed().length, 1);
  runtime.recordActivity();
  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(runtime.getDismissed().length, 1);
  runtime.getActive({ recordActivity: false });
  now += 1;
  runtime.recordActivity();
  assert.deepEqual(runtime.getDismissed(), []);
  runtime.apply('unwind');
  assert.deepEqual(runtime.getDismissed(), []);
  assert.deepEqual(createViewingIntentRuntime({ storage: createStorage() }).getDismissed(), []);
});

test('Session Dismissal rejects unavailable storage without claiming a skip or restore', () => {
  let refuse = false;
  const storage = createStorage();
  const setItem = storage.setItem;
  storage.setItem = (...args) => { if (refuse) throw new Error('Storage refused'); return setItem(...args); };
  const runtime = createViewingIntentRuntime({ storage });
  runtime.dismiss({ id: 1, title: 'First pick' });
  refuse = true;
  assert.equal(runtime.restore('1').changed, false);
  assert.equal(runtime.dismiss({ id: 2, title: 'Second pick' }).changed, false);
  assert.deepEqual(runtime.getDismissed(), [{ id: '1', title: 'First pick' }]);
});
