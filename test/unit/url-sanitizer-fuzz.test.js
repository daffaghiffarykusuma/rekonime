import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUrl } from '../../js/urlSanitizer.js';

const EDGE_CASE_URLS = [
  '',
  '   ',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  '///evil.example/path',
  '//evil.example/path',
  'https://example.com/%0d%0aSet-Cookie:test',
  'https://example.com/\u0000',
  'http://example.com',
  '/relative/path',
  './relative/path',
  'https://www.youtube.com/watch?v=abc123',
  'https://youtube.com.evil.example/watch?v=abc123',
  'https://[::1]/',
  'not-a-url',
  'ftp://example.com/file.txt'
];

test('sanitizeUrl handles malformed/edge-case inputs without throwing', () => {
  EDGE_CASE_URLS.forEach((value) => {
    assert.doesNotThrow(() => {
      sanitizeUrl(value, {
        allowRelative: true,
        allowedProtocols: ['https:'],
        allowedHosts: ['example.com', 'www.youtube.com']
      });
    });
  });
});

test('sanitizeUrl returns only allowed protocol/hosts for edge-case inputs', () => {
  EDGE_CASE_URLS.forEach((value) => {
    const safe = sanitizeUrl(value, {
      allowRelative: false,
      allowedProtocols: ['https:'],
      allowedHosts: ['example.com', 'www.youtube.com']
    });
    if (!safe) return;
    const parsed = new URL(safe);
    assert.equal(parsed.protocol, 'https:');
    assert.ok(['example.com', 'www.youtube.com'].includes(parsed.hostname));
  });
});
