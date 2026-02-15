import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrailerUrls,
  sanitizeTrailerUrl,
  sanitizeTrailerEmbedUrl,
  resolveTrustedTrailerMessageOrigin
} from '../../js/security/trailer-url-policy.js';
import { validateCatalog } from '../../tools/lib/schema-validator.js';

test('trailer policy sanitizes url and embed url with strict hosts/protocols', () => {
  assert.equal(
    sanitizeTrailerUrl('https://www.youtube.com/watch?v=abc123'),
    'https://www.youtube.com/watch?v=abc123'
  );
  assert.equal(
    sanitizeTrailerEmbedUrl('https://www.youtube.com/embed/abc123?autoplay=1'),
    'https://www.youtube.com/embed/abc123'
  );

  assert.equal(sanitizeTrailerUrl('http://www.youtube.com/watch?v=abc123'), '');
  assert.equal(sanitizeTrailerEmbedUrl('https://youtube.com.evil.example/embed/abc123'), '');
});

test('buildTrailerUrls fills missing trailer links from id and sanitizes output', () => {
  const built = buildTrailerUrls({ id: 'abc123' });
  assert.equal(built.url, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(built.embedUrl, 'https://www.youtube.com/embed/abc123');

  const blocked = buildTrailerUrls({
    url: 'https://youtube.com.evil.example/watch?v=abc123',
    embedUrl: 'https://youtube.com.evil.example/embed/abc123'
  });
  assert.equal(blocked.url, '');
  assert.equal(blocked.embedUrl, '');
});

test('resolveTrustedTrailerMessageOrigin only allows trusted embed origins', () => {
  assert.equal(
    resolveTrustedTrailerMessageOrigin('https://www.youtube.com/embed/abc123', 'https://rekonime.vercel.app'),
    'https://www.youtube.com'
  );
  assert.equal(
    resolveTrustedTrailerMessageOrigin('https://youtube.com.evil.example/embed/abc123', 'https://rekonime.vercel.app'),
    ''
  );
});

test('tooling schema validator follows trailer policy decisions', () => {
  const makeAnime = (trailer) => ({
    id: 'alpha',
    title: 'Alpha',
    cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
    trailer,
    episodes: [{ episode: 1, score: 4.2 }]
  });

  const accepted = validateCatalog([makeAnime({
    url: 'https://www.youtube.com/watch?v=abc123',
    embedUrl: 'https://www.youtube.com/embed/abc123'
  })], { strict: true, allowMissingTrailer: false });
  assert.equal(accepted.valid, true);

  const rejected = validateCatalog([makeAnime({
    url: 'http://www.youtube.com/watch?v=abc123',
    embedUrl: 'https://youtube.com.evil.example/embed/abc123'
  })], { strict: true, allowMissingTrailer: false });
  assert.equal(rejected.valid, false);
  assert.ok(rejected.errors.some((error) => error.field === 'trailer'));
});
