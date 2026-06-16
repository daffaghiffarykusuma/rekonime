import test from 'node:test';
import assert from 'node:assert/strict';
import { Onboarding } from '../../js/onboarding.js';
import { resetDomBody, setupDom } from '../helpers/dom.js';

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
  setupDom();
  resetDomBody('');
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  Onboarding.isActive = false;
  Onboarding.startTour();

  const modal = document.getElementById('onboarding-modal');
  assert.ok(modal);
  assert.equal(Onboarding.isActive, true);
  assert.equal(Onboarding.steps.length, 1);
  assert.ok(modal.querySelector('[data-action="onboarding-intent"]'));

  Onboarding.getCache = originalGetCache;
});

test('Onboarding intent choice completes and dispatches selected intent', async () => {
  setupDom();
  resetDomBody('');
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  let selectedIntent = '';
  window.addEventListener('rekonime:onboarding-intent', (event) => {
    selectedIntent = event.detail.intentKey;
  }, { once: true });

  Onboarding.isActive = false;
  Onboarding.startTour();
  document.querySelector('[data-intent-key="energy"]').click();

  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(cache.getRaw(Onboarding.storageKey), 'completed');
  assert.equal(selectedIntent, 'energy');

  Onboarding.getCache = originalGetCache;
});

test('Onboarding skipTour stores state and closes', async () => {
  setupDom();
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
