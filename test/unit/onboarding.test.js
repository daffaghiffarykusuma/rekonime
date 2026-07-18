import test from 'node:test';
import assert from 'node:assert/strict';
import { Onboarding } from '../../js/onboarding.js';
import { resetDomBody, setupDom } from '../helpers/dom.js';

const createCache = () => {
  const store = new Map();
  return {
    getRaw: (key) => (store.has(key) ? store.get(key) : null),
    setRaw: (key, value) => store.set(key, String(value))
  };
};

const setupOnboardingShell = () => {
  setupDom();
  resetDomBody(`
    <div class="onboarding-overlay onboarding-shell" id="onboarding-modal" aria-hidden="true">
      <div class="onboarding-backdrop" data-action="onboarding-backdrop"></div>
      <div class="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button type="button" data-action="onboarding-skip">Close</button>
        <div id="onboarding-content" data-onboarding-step="welcome">
          <h2 id="onboarding-title">Welcome to Rekonime</h2>
          <button type="button" data-action="onboarding-intent" data-intent-key="unwind" aria-pressed="false" disabled>Unwind</button>
          <button type="button" data-action="onboarding-intent" data-intent-key="energy" aria-pressed="false" disabled>Energy</button>
          <button type="button" data-action="onboarding-intent" data-intent-key="surprise" aria-pressed="false" disabled>Surprise</button>
        </div>
      </div>
    </div>
  `);
  Onboarding.isActive = false;
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

test('Onboarding adopts the first-paint shell as one welcome journey', () => {
  setupOnboardingShell();
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  assert.equal(Onboarding.startTour(), true);

  const modal = document.getElementById('onboarding-modal');
  assert.equal(Onboarding.isActive, true);
  assert.equal(modal.classList.contains('onboarding-shell'), false);
  assert.equal(modal.classList.contains('visible'), true);
  assert.equal(modal.querySelectorAll('[data-action="onboarding-intent"]').length, 3);
  assert.equal(modal.querySelector('[data-action="onboarding-intent"]').disabled, false);
  assert.equal(modal.querySelector('[data-action="onboarding-next"]'), null);
  assert.equal(modal.querySelector('.onboarding-progress'), null);

  Onboarding.getCache = originalGetCache;
});

test('Onboarding intent choice completes and dispatches selected intent', async () => {
  setupOnboardingShell();
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  let selectedIntent = '';
  window.addEventListener('rekonime:onboarding-intent', (event) => {
    selectedIntent = event.detail.intentKey;
  }, { once: true });

  Onboarding.startTour();
  document.querySelector('[data-intent-key="energy"]').click();
  await new Promise(resolve => setTimeout(resolve, 150));

  assert.equal(cache.getRaw(Onboarding.storageKey), 'completed');
  assert.equal(selectedIntent, 'energy');
  assert.equal(document.getElementById('onboarding-modal').getAttribute('aria-hidden'), 'true');

  Onboarding.getCache = originalGetCache;
});

test('Onboarding skip stores state and hides the reusable shell', () => {
  setupOnboardingShell();
  const cache = createCache();
  const originalGetCache = Onboarding.getCache;
  Onboarding.getCache = () => cache;

  Onboarding.startTour();
  Onboarding.skipTour();

  assert.equal(cache.getRaw(Onboarding.storageKey), 'skipped');
  assert.equal(Onboarding.isActive, false);
  assert.equal(document.getElementById('onboarding-modal').getAttribute('aria-hidden'), 'true');

  Onboarding.getCache = originalGetCache;
});
