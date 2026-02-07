import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePathname,
  getNormalizedDataJsonUrl,
  buildNormalizedDataRequest
} from '../../js/sw-cache-policy.js';

test('normalizePathname collapses duplicates and trims trailing slash', () => {
  assert.equal(normalizePathname('data//anime.full.json/'), '/data/anime.full.json');
  assert.equal(normalizePathname('/version.json'), '/version.json');
});

test('getNormalizedDataJsonUrl only allows explicit same-origin endpoints', () => {
  const origin = 'https://example.com';

  const allowed = getNormalizedDataJsonUrl('https://example.com/data//anime.full.json?cache=1', origin);
  assert.equal(allowed?.toString(), 'https://example.com/data/anime.full.json');

  const disallowedPath = getNormalizedDataJsonUrl('https://example.com/data/other.json', origin);
  assert.equal(disallowedPath, null);

  const disallowedOrigin = getNormalizedDataJsonUrl('https://evil.example/data/anime.full.json', origin);
  assert.equal(disallowedOrigin, null);
});

test('buildNormalizedDataRequest returns null for non-allowlisted requests', () => {
  const origin = 'https://example.com';

  const allowed = buildNormalizedDataRequest(
    new Request('https://example.com/version.json?v=2', { method: 'GET' }),
    origin
  );
  assert.ok(allowed);
  assert.equal(allowed.url, 'https://example.com/version.json');

  const disallowed = buildNormalizedDataRequest(
    new Request('https://example.com/data/random.json', { method: 'GET' }),
    origin
  );
  assert.equal(disallowed, null);
});
