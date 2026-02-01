import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/services/api-client.js';
import { createResponse } from '../helpers/mocks.js';

test('ApiClient getServiceUrl builds params', () => {
  ApiClient.registerService('sample', {
    currentVersion: 'v1',
    baseUrls: { v1: 'https://example.com/api' }
  });

  const url = ApiClient.getServiceUrl('sample', 'items', { q: 'test', page: 2 });
  assert.equal(url, 'https://example.com/api/items?q=test&page=2');
});

test('ApiClient requestService falls back on 404', async () => {
  ApiClient.registerService('fallback', {
    currentVersion: 'v4',
    baseUrls: { v4: 'https://example.com/v4', v3: 'https://example.com/v3' }
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/v4/')) {
      return createResponse({ error: 'not found' }, { status: 404 });
    }
    return createResponse({ ok: true }, { status: 200, headers: { Sunset: 'Wed, 01 Jan 2030 00:00:00 GMT' } });
  };

  const data = await ApiClient.getServiceJson('fallback', 'status');
  assert.deepEqual(data, { ok: true });
  assert.equal(ApiClient.getServiceVersion('fallback'), 'v3');

  const deprecation = ApiClient.getDeprecationInfo('fallback');
  assert.ok(deprecation);
  assert.equal(Boolean(deprecation.sunset), true);

  globalThis.fetch = originalFetch;
});

test('ApiClient request uses interceptors', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return createResponse({ ok: true }, { status: 200 });
  };

  const remove = ApiClient.addRequestInterceptor((request) => {
    return {
      url: request.url + '?intercepted=true',
      options: { ...request.options, headers: { ...request.options.headers, 'X-Test': '1' } }
    };
  });

  await ApiClient.getJson('https://example.com/data');
  remove();

  assert.equal(calls.length, 1);
  assert.equal(String(calls[0].url).includes('intercepted=true'), true);
  assert.equal(calls[0].options.headers['X-Test'], '1');

  globalThis.fetch = originalFetch;
});
