import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCommunityScore } from '../../tools/lib/mal-community-score.js';

test('community score falls back to MyAnimeList when Jikan returns 504', async () => {
  const urls = [];
  const request = async (url) => {
    urls.push(url);
    if (url.includes('api.jikan.moe')) throw new Error('HTTP 504');
    return new Response('<span itemprop="ratingValue">6.48</span>');
  };

  assert.equal(await fetchCommunityScore(63276, request, 'auto'), 6.48);
  assert.deepEqual(urls, [
    'https://api.jikan.moe/v4/anime/63276',
    'https://myanimelist.net/anime/63276'
  ]);
});

test('community score keeps MAL N/A as missing', async () => {
  const request = async (url) => {
    if (url.includes('api.jikan.moe')) throw new Error('HTTP 504');
    return new Response('<span class="score-label score-na">N/A</span>');
  };

  assert.equal(await fetchCommunityScore(62495, request, 'auto'), null);
});

test('default MAL source skips Jikan and preserves unrated titles', async () => {
  const urls = [];
  const request = async (url) => {
    urls.push(url);
    return new Response(url.endsWith('/61987')
      ? '<span itemprop="ratingValue">8.65</span>'
      : '<span class="score-label score-na">N/A</span>');
  };

  assert.equal(await fetchCommunityScore(61987, request), 8.65);
  assert.equal(await fetchCommunityScore(62495, request), null);
  assert.deepEqual(urls, [
    'https://myanimelist.net/anime/61987',
    'https://myanimelist.net/anime/62495'
  ]);
});
