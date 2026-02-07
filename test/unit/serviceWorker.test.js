import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceWorkerManager } from '../../js/serviceWorker.js';
import { setupDom } from '../helpers/dom.js';

test('ServiceWorkerManager register skips localhost', async () => {
  setupDom(undefined, { url: 'http://localhost/' });

  let unregistered = false;
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistrations: async () => [{ unregister: () => { unregistered = true; } }]
    },
    configurable: true
  });

  const result = await ServiceWorkerManager.register();
  assert.equal(result, false);
  assert.equal(unregistered, true);
});

test('ServiceWorkerManager register succeeds on non-localhost', async () => {
  setupDom(undefined, { url: 'https://example.com/' });

  let registerArgs = null;
  const registration = {
    scope: '/'
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: async (...args) => {
        registerArgs = args;
        return {
        ...registration,
        addEventListener: () => {},
        waiting: null
      };
      },
      addEventListener: () => {},
      getRegistrations: async () => []
    },
    configurable: true
  });

  const result = await ServiceWorkerManager.register();
  assert.equal(result, true);
  assert.ok(ServiceWorkerManager.registration);
  assert.deepEqual(registerArgs, ['/sw.js', { type: 'module' }]);
});

test('ServiceWorkerManager offline indicator toggles', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  ServiceWorkerManager.showOfflineIndicator();
  const indicator = document.getElementById('offline-indicator');
  assert.ok(indicator);

  ServiceWorkerManager.hideOfflineIndicator();
  assert.equal(indicator.classList.contains('visible'), false);
});

test('ServiceWorkerManager showUpdatePrompt is idempotent', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  ServiceWorkerManager.showUpdatePrompt();
  ServiceWorkerManager.showUpdatePrompt();
  const banners = document.querySelectorAll('#sw-update-banner');
  assert.equal(banners.length, 1);

  const applyButton = document.getElementById('sw-update-btn');
  assert.ok(applyButton);
});
