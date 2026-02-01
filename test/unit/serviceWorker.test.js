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

  const registration = {
    scope: '/'
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: async () => ({
        ...registration,
        addEventListener: () => {},
        waiting: null
      }),
      addEventListener: () => {},
      getRegistrations: async () => []
    },
    configurable: true
  });

  const result = await ServiceWorkerManager.register();
  assert.equal(result, true);
  assert.ok(ServiceWorkerManager.registration);
});

test('ServiceWorkerManager offline indicator toggles', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  ServiceWorkerManager.showOfflineIndicator();
  const indicator = document.getElementById('offline-indicator');
  assert.ok(indicator);

  ServiceWorkerManager.hideOfflineIndicator();
  assert.equal(indicator.classList.contains('visible'), false);
});
