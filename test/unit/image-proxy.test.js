import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFreshImageProxyStatus,
  buildImageProxyUrl
} from '../../src/shared/runtime/image-proxy.js';

test('image proxy status freshness check honors ttl', () => {
  const now = Date.now();
  assert.equal(getFreshImageProxyStatus({ ok: true, checkedAt: now - 100 }, 1000), true);
  assert.equal(getFreshImageProxyStatus({ ok: false, checkedAt: now - 2000 }, 1000), null);
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
