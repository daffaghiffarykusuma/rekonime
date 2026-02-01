import test from 'node:test';
import assert from 'node:assert/strict';
import { Onboarding } from '../../js/onboarding.js';
import { resetDomBody } from '../helpers/dom.js';

const createCache = () => {
  const store = new Map();
  return {
    getRaw: (key) => (store.has(key) ? store.get(key) : null),
    setRaw: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
};

test('Onboarding hasCompleted reflects stored state', () => {
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  cache.setRaw(Onboarding.storageKey, 'completed');
  assert.equal(Onboarding.hasCompleted(), true);

  cache.setRaw(Onboarding.storageKey, 'skipped');
  assert.equal(Onboarding.hasCompleted(), true);

  cache.setRaw(Onboarding.storageKey, '');
  assert.equal(Onboarding.hasCompleted(), false);

  Onboarding.getCache = originalGetCache;
});

test('Onboarding startTour renders modal and steps', () => {
  resetDomBody('');
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  Onboarding.isActive = false;
  Onboarding.startTour();

  const modal = document.getElementById('onboarding-modal');
  assert.ok(modal);
  assert.equal(Onboarding.isActive, true);

  Onboarding.getCache = originalGetCache;
});

test('Onboarding skipTour stores state and closes', async () => {
  resetDomBody('');
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  Onboarding.isActive = false;
  Onboarding.startTour();
  Onboarding.skipTour();

  await new Promise(resolve => setTimeout(resolve, 350));

  assert.equal(cache.getRaw(Onboarding.storageKey), 'skipped');
  assert.equal(Onboarding.isActive, false);

  Onboarding.getCache = originalGetCache;
});
