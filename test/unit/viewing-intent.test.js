import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewingIntentRuntime
} from '../../js/viewing-intent.ts';

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
      description: 'Gentle, stable, low-friction viewing.',
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

test('Viewing Intent clears when discovery completes', () => {
  const storage = createStorage();
  const runtime = createViewingIntentRuntime({ storage, now: () => 1 });

  runtime.apply('immersive');
  assert.equal(runtime.clear().changed, true);
  assert.equal(runtime.getActive(), null);
});
