import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreRefreshRequest } from '../../tools/lib/score-refresh-request.js';
import { fetchCommunityScore } from '../../tools/lib/mal-community-score.js';

const createClock = () => {
  let time = 0;
  return { now: () => time, sleep: async (ms) => { time += ms; } };
};

test('score fallback shares MAL pacing with episode requests', async () => {
  const clock = createClock();
  const calls = [];
  const request = createScoreRefreshRequest({
    ...clock, malDelayMs: 20000, jikanDelayMs: 400,
    fetchFn: async (url) => {
      calls.push({ url, time: clock.now() });
      if (url.includes('api.jikan.moe')) return new Response('', { status: 504 });
      return new Response('<span itemprop="ratingValue">6.48</span>');
    }
  });
  const [score] = await Promise.all([
    fetchCommunityScore(63276, request),
    request('https://myanimelist.net/anime/63276/title/episode')
  ]);
  assert.equal(score, 6.48);
  const malCalls = calls.filter(({ url }) => new URL(url).hostname === 'myanimelist.net');
  assert.equal(malCalls.length, 2);
  assert.ok(malCalls[1].time - malCalls[0].time >= 20000);
  assert.equal(calls.filter(({ url }) => url.includes('api.jikan.moe')).length, 5);
});

test('every retry is paced and an exhausted request does not poison its host queue', async () => {
  const clock = createClock();
  const starts = [];
  let failing = true;
  const request = createScoreRefreshRequest({
    ...clock, malDelayMs: 5000,
    fetchFn: async () => {
      starts.push(clock.now());
      if (failing) throw new Error('network unavailable');
      return new Response('ok');
    }
  });
  await assert.rejects(request('https://myanimelist.net/anime/1'), /network unavailable/);
  assert.equal(starts.length, 5);
  failing = false;
  assert.equal(await (await request('https://myanimelist.net/anime/2')).text(), 'ok');
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(starts[index] - starts[index - 1] >= 5000);
  }
});

test('a pending MAL request does not hold the Jikan queue', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const request = createScoreRefreshRequest({
    ...createClock(),
    fetchFn: async (url) => url.includes('myanimelist.net') ? pending : new Response('jikan')
  });
  const mal = request('https://myanimelist.net/anime/1');
  try {
    assert.equal(await (await request('https://api.jikan.moe/v4/anime/1')).text(), 'jikan');
  } finally {
    release(new Response('mal'));
  }
  assert.equal(await (await mal).text(), 'mal');
});
