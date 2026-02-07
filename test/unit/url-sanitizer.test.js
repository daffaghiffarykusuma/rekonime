import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUrl, sanitizeImageUrl } from '../../js/urlSanitizer.js';

test('sanitizeUrl rejects protocol-relative and javascript URLs', () => {
  assert.equal(sanitizeUrl('//evil.example/path'), '');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
});

test('sanitizeUrl requires explicit relative paths when allowRelative is true', () => {
  assert.equal(sanitizeUrl('assets/image.png', { allowRelative: true }), '');
  assert.equal(sanitizeUrl('/assets/image.png', { allowRelative: true }), '/assets/image.png');
  assert.equal(sanitizeUrl('./assets/image.png', { allowRelative: true }), './assets/image.png');
});

test('sanitizeImageUrl enforces allowlist hosts', () => {
  const allowed = sanitizeImageUrl('https://cdn.myanimelist.net/images/test.jpg', {
    allowedHosts: ['cdn.myanimelist.net']
  });
  assert.equal(allowed, 'https://cdn.myanimelist.net/images/test.jpg');

  const blocked = sanitizeImageUrl('https://evil.example/test.jpg', {
    allowedHosts: ['cdn.myanimelist.net']
  });
  assert.equal(blocked, '');
});
