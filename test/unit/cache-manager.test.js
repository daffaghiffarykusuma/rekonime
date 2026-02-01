import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager } from '../../js/services/cache-manager.js';

const clearStorage = () => {
  if (globalThis.localStorage) {
    localStorage.clear();
  }
  CacheManager.clearMemory();
};

test('CacheManager setJSON/getJSON honors ttl', () => {
  clearStorage();
  const originalNow = CacheManager.now;
  CacheManager.now = () => 1000;

  CacheManager.setJSON('ttl-key', { hello: 'world' }, { ttlMs: 100 });

  CacheManager.now = () => 1050;
  assert.deepEqual(CacheManager.getJSON('ttl-key', { fallback: null }), { hello: 'world' });

  CacheManager.now = () => 1200;
  assert.equal(CacheManager.getJSON('ttl-key', { fallback: null }), null);

  CacheManager.now = originalNow;
});

test('CacheManager falls back to memory when storage unavailable', () => {
  clearStorage();
  const originalGetStorage = CacheManager.getStorage;
  CacheManager.getStorage = () => null;

  CacheManager.setJSON('mem-key', { ok: true }, { ttlMs: 0 });
  assert.deepEqual(CacheManager.getJSON('mem-key', { fallback: null }), { ok: true });

  CacheManager.getStorage = originalGetStorage;
});

test('CacheManager validation rejects invalid payloads', () => {
  clearStorage();
  const success = CacheManager.setJSON('rekonime.theme', 'dark', { validate: true });
  const failure = CacheManager.setJSON('rekonime.theme', 'invalid', { validate: true });
  assert.equal(success, true);
  assert.equal(failure, false);
});
