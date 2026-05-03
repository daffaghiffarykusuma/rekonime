import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTrustedMalEpisodePageUrl } from '../../tools/lib/mal-pagination-url.js';

test('MAL pagination validator accepts trusted https episode pages', () => {
  const nextUrl = formatTrustedMalEpisodePageUrl(
    '/anime/21/One_Piece/episode?offset=100',
    'https://myanimelist.net/anime/21/One_Piece/episode'
  );

  assert.equal(nextUrl, 'https://myanimelist.net/anime/21/One_Piece/episode?offset=100');
});

test('MAL pagination validator rejects attacker-selected hosts', () => {
  const nextUrl = formatTrustedMalEpisodePageUrl(
    'https://127.0.0.1/admin/episode',
    'https://myanimelist.net/anime/21/One_Piece/episode'
  );

  assert.equal(nextUrl, null);
});

test('MAL pagination validator rejects non-https and non-episode MAL URLs', () => {
  assert.equal(
    formatTrustedMalEpisodePageUrl(
      'http://myanimelist.net/anime/21/One_Piece/episode?offset=100',
      'https://myanimelist.net/anime/21/One_Piece/episode'
    ),
    null
  );
  assert.equal(
    formatTrustedMalEpisodePageUrl(
      'https://myanimelist.net/search/episode',
      'https://myanimelist.net/anime/21/One_Piece/episode'
    ),
    null
  );
  assert.equal(
    formatTrustedMalEpisodePageUrl(
      'https://myanimelist.net:444/anime/21/One_Piece/episode',
      'https://myanimelist.net/anime/21/One_Piece/episode'
    ),
    null
  );
});
