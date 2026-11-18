import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoverySession } from '../../src/features/discovery/discovery-session.ts';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
};

test('Session Dismissal survives reload and can be restored', () => {
  const storage = createStorage();
  const session = createDiscoverySession({ storage, now: () => 100 });
  assert.equal(session.dismiss({ id: 42, title: 'A quiet afternoon' }).changed, true);
  assert.equal(session.dismiss({ id: 42, title: 'A quiet afternoon' }).changed, false);
  const reloaded = createDiscoverySession({ storage, now: () => 200 });
  assert.deepEqual(reloaded.getDismissed(), [{ id: '42', title: 'A quiet afternoon' }]);
  assert.equal(reloaded.restore('42').changed, true);
  assert.deepEqual(reloaded.getDismissed(), []);
});

test('Discovery rendering does not renew dismissals; activity slides expiry and expired state cannot revive', () => {
  const storage = createStorage();
  let now = 100;
  const session = createDiscoverySession({ storage, now: () => now });
  session.dismiss({ id: 1, title: 'First pick' });
  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(session.getDismissed().length, 1);
  session.recordActivity();
  now += (4 * 60 * 60 * 1000) - 1;
  assert.equal(session.getDismissed().length, 1);
  now += 1;
  session.recordActivity();
  assert.deepEqual(session.getDismissed(), []);
  assert.deepEqual(createDiscoverySession({ storage: createStorage() }).getDismissed(), []);
});

test('Session Dismissal rejects unavailable storage without claiming a skip or restore', () => {
  let refuse = false;
  const storage = createStorage();
  const setItem = storage.setItem;
  storage.setItem = (...args) => { if (refuse) throw new Error('Storage refused'); return setItem(...args); };
  const session = createDiscoverySession({ storage });
  session.dismiss({ id: 1, title: 'First pick' });
  refuse = true;
  assert.equal(session.restore('1').changed, false);
  assert.equal(session.dismiss({ id: 2, title: 'Second pick' }).changed, false);
  assert.deepEqual(session.getDismissed(), [{ id: '1', title: 'First pick' }]);
});
