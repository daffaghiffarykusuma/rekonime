import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../helpers/dom.js';
import { createImageProxyRuntime } from '../../src/shared/runtime/image-proxy-runtime.js';

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
  const persisted = JSON.parse(localStorage.getItem(storageKey));
  assert.equal(persisted.ok, true);
  assert.ok(Number.isFinite(persisted.checkedAt));
  assert.equal(createImageProxyRuntime({ storageKey, ttlMs: 60_000 }).getStatus(), true);

  globalThis.Image = originalImage;
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
  const proxyUrl = new URL(decision.src);
  assert.equal(proxyUrl.origin, 'https://images.weserv.nl');
  assert.deepEqual(Object.fromEntries(proxyUrl.searchParams), {
    url: 'cdn.myanimelist.net/show.jpg', w: '240', h: '360', fit: 'cover', output: 'webp'
  });
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
