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

test('image proxy runtime resolves complete image delivery and failure transition', () => {
  setupDom('<img id="cover">');
  const runtime = createImageProxyRuntime({
    storageKey: 'rekonime.imageProxyRuntime.decision',
    ttlMs: 60_000,
    enabled: true,
    sanitizeImageUrl: value => String(value || '').startsWith('https://') ? value : '',
    dimensions: { card: { width: 240, height: 360 } },
    queueTask: () => null,
    waitForLoad: false
  });
  runtime.storeStatus(true);

  const decision = runtime.resolveImage({
    coverUrl: 'https://cdn.myanimelist.net/show.jpg',
    sizeKey: 'card',
    placeholder: 'https://via.placeholder.com/cover.jpg',
    index: 0,
    eagerCount: 2,
    priorityCount: 1
  });
  assert.equal(decision.src.includes('images.weserv.nl'), true);
  assert.equal(decision.fallbackSrc, 'https://cdn.myanimelist.net/show.jpg');
  assert.equal(decision.fallbackSecondary, 'https://via.placeholder.com/cover.jpg');
  assert.deepEqual([decision.width, decision.height], [240, 360]);
  assert.deepEqual([decision.loading, decision.fetchpriority], ['eager', 'high']);

  const img = document.getElementById('cover');
  img.src = decision.src;
  img.dataset.fallbackSrc = decision.fallbackSrc;
  img.dataset.fallbackSecondary = decision.fallbackSecondary;
  assert.equal(runtime.handleImageError(img), true);
  assert.equal(img.src, 'https://cdn.myanimelist.net/show.jpg');
  assert.equal(img.dataset.fallbackSrc, 'https://via.placeholder.com/cover.jpg');
  assert.equal(runtime.getStatus(), false);
});
