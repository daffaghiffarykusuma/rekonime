import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEWING_INTENTS,
  createViewingIntentSession
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
  assert.deepEqual(
    VIEWING_INTENTS.map(intent => intent.label),
    [
      'Help me unwind',
      'Give me energy',
      'Make me feel something',
      'Pull me into another world',
      'Surprise me'
    ]
  );
});

test('Viewing Intent persists in session storage and expires after four hours of inactivity', () => {
  const storage = createStorage();
  let now = Date.parse('2026-06-15T08:00:00Z');
  const session = createViewingIntentSession({ storage, now: () => now });

  session.set('unwind');
  assert.equal(session.get()?.key, 'unwind');

  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(session.get()?.key, 'unwind');

  now += (4 * 60 * 60 * 1000) + 1;
  assert.equal(session.get(), null);
});

test('Viewing Intent clears when discovery completes', () => {
  const storage = createStorage();
  const session = createViewingIntentSession({ storage, now: () => 1 });

  session.set('immersive');
  assert.equal(session.clear(), true);
  assert.equal(session.get(), null);
});
