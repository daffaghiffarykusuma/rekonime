import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readImageProxyStatus,
  getFreshImageProxyStatus,
  writeImageProxyStatus,
  isProxyImageUrl,
  buildImageProxyUrl
} from '../../js/image-proxy.js';

const STORAGE_KEY = 'rekonime.imageProxyStatus.test';

test('image proxy status read/write roundtrip', () => {
  localStorage.removeItem(STORAGE_KEY);
  const empty = readImageProxyStatus(STORAGE_KEY);
  assert.equal(empty.ok, null);
  assert.equal(empty.checkedAt, 0);

  const saved = writeImageProxyStatus(STORAGE_KEY, true);
  assert.equal(saved.ok, true);
  assert.equal(Number.isFinite(saved.checkedAt), true);

  const loaded = readImageProxyStatus(STORAGE_KEY);
  assert.equal(loaded.ok, true);
  assert.equal(Number.isFinite(loaded.checkedAt), true);
});

test('image proxy status freshness check honors ttl', () => {
  const now = Date.now();
  assert.equal(getFreshImageProxyStatus({ ok: true, checkedAt: now - 100 }, 1000), true);
  assert.equal(getFreshImageProxyStatus({ ok: false, checkedAt: now - 2000 }, 1000), null);
});

test('buildImageProxyUrl returns proxied url for allowed images', () => {
  const proxy = buildImageProxyUrl('https://cdn.myanimelist.net/images/anime/1/1l.jpg', {
    sanitizeImageUrl: (url) => url,
    width: 240,
    height: 360
  });

  assert.equal(proxy.startsWith('https://images.weserv.nl/?'), true);
  assert.equal(proxy.includes('w=240'), true);
  assert.equal(proxy.includes('h=360'), true);
  assert.equal(proxy.includes('fit=cover'), true);
  assert.equal(proxy.includes('output=webp'), true);

  assert.equal(isProxyImageUrl(proxy), true);
});

test('buildImageProxyUrl passes through already proxied urls', () => {
  const source = 'https://images.weserv.nl/?url=cdn.myanimelist.net/images/anime/1/1l.jpg&w=240&h=360&fit=cover&output=webp';
  const result = buildImageProxyUrl(source, {
    sanitizeImageUrl: (url) => url,
    width: 240,
    height: 360
  });
  assert.equal(result, source);
});
