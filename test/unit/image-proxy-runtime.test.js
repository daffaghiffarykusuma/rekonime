import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../helpers/dom.js';
import { createImageProxyRuntime } from '../../js/image-proxy-runtime.js';

test('image proxy runtime schedules probe and persists healthy status', async () => {
  setupDom();
  const storageKey = 'rekonime.imageProxyRuntime.test';
  localStorage.removeItem(storageKey);

  const originalImage = globalThis.Image;
  globalThis.Image = class {
    set src(_value) {
      setTimeout(() => {
        if (typeof this.onload === 'function') {
          this.onload();
        }
      }, 0);
    }
  };

  const runtime = createImageProxyRuntime({
    storageKey,
    ttlMs: 60_000,
    timeoutMs: 50,
    queueTask: (callback) => {
      callback();
      return null;
    },
    waitForLoad: false
  });

  assert.equal(runtime.shouldUseProxy(), true);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(runtime.getStatus(), true);

  globalThis.Image = originalImage;
});

test('image proxy runtime markFailed forces disabled status', () => {
  setupDom();
  const storageKey = 'rekonime.imageProxyRuntime.failed';
  localStorage.removeItem(storageKey);

  const runtime = createImageProxyRuntime({
    storageKey,
    ttlMs: 60_000,
    queueTask: (callback) => {
      callback();
      return null;
    },
    waitForLoad: false
  });

  runtime.markFailed();
  assert.equal(runtime.getStatus(), false);
});
