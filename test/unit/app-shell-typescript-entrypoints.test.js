import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { ServiceWorkerManager } from '../../js/serviceWorker.ts';

test('TypeScript app shell entrypoints expose stable runtime APIs', () => {
  assert.equal(typeof App.init, 'function');
  assert.equal(typeof App.renderAnimeGrid, 'function');
  assert.equal(typeof App.showAnimeDetail, 'function');
  assert.equal(typeof App.setWatchStatus, 'function');

  assert.equal(typeof ServiceWorkerManager.register, 'function');
  assert.equal(typeof ServiceWorkerManager.initConnectivityListeners, 'function');
});
