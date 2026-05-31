import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImageUrl, sanitizeUrl } from '../../js/urlSanitizer.ts';
import {
  buildTrailerUrls,
  sanitizeTrailerEmbedUrl,
  sanitizeTrailerUrl
} from '../../js/security/trailer-url-policy.ts';

test('TypeScript security policy entrypoints preserve unsafe URL rejection behavior', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeImageUrl('https://evil.example/test.jpg', {
    allowedHosts: ['cdn.myanimelist.net']
  }), '');
  assert.equal(sanitizeTrailerUrl('http://www.youtube.com/watch?v=abc123'), '');
  assert.equal(sanitizeTrailerEmbedUrl('https://youtube.com.evil.example/embed/abc123'), '');
  assert.deepEqual(buildTrailerUrls({
    url: 'https://youtube.com.evil.example/watch?v=abc123',
    embedUrl: 'https://youtube.com.evil.example/embed/abc123'
  }), { url: '', embedUrl: '' });
});
