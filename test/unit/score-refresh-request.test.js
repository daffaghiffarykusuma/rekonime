import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreRefreshRequest } from '../../tools/lib/score-refresh-request.js';
import { fetchCommunityScore } from '../../tools/lib/mal-community-score.js';

const createClock = () => {
  let time = 0;
  return { now: () => time, sleep: async (ms) => { time += ms; } };
};

test('a rate limit pauses queued requests to the same host', async () => {
  let releaseSleep;
  let time = 0;
  const starts = [];
  const waits = [];
  const request = createScoreRefreshRequest({
    malDelayMs: 0, now: () => time,
    sleep: (ms) => {
      waits.push(ms);
      if (releaseSleep) { time += ms; return Promise.resolve(); }
      return new Promise((resolve) => { releaseSleep = () => { time += ms; resolve(); }; });
    },
    fetchFn: async () => {
      starts.push(time);
      return starts.length === 1
        ? new Response('', { status: 429, headers: { 'Retry-After': '120' } })
        : new Response('ok');
    }
  });
  const first = request('https://myanimelist.net/anime/1');
  const queued = request('https://myanimelist.net/anime/2');
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.deepEqual(starts, [0], 'queued work must wait for the provider cooldown');
  assert.equal(waits[0], 60000);
  releaseSleep();
  await Promise.all([first, queued]);
  assert.ok(starts.slice(1).every((start) => start >= 120000));
});

test('access denial stops requests instead of retrying or calling the MAL fallback', async () => {
  const calls = [];
  const request = createScoreRefreshRequest({
    ...createClock(), fetchFn: async (url) => {
      calls.push(url);
      return new Response('', { status: 403 });
    }
  });
  await assert.rejects(fetchCommunityScore(1, request, 'auto'), /HTTP 403/);
  await assert.rejects(request('https://myanimelist.net/anime/2'), /HTTP 403/);
  assert.equal(calls.length, 1);
});

test('permanent HTTP errors are not retried', async () => {
  let calls = 0;
  const request = createScoreRefreshRequest({
    ...createClock(), fetchFn: async () => {
      calls += 1;
      return new Response('', { status: 404 });
    }
  });
  await assert.rejects(request('https://myanimelist.net/anime/1'), /HTTP 404/);
  assert.equal(calls, 1);
});

test('Retry-After supports dates and rejects invalid values without bypassing backoff', async () => {
  for (const [header, minimum] of [
    ['Thu, 01 Jan 1970 00:02:00 GMT', 120000], ['120', 120000],
    ['garbage', 60000], ['-1', 60000], ['0', 60000]
  ]) {
    const clock = createClock();
    const starts = [];
    const request = createScoreRefreshRequest({
      ...clock, malDelayMs: 0,
      fetchFn: async () => {
        starts.push(clock.now());
        return starts.length === 1
          ? new Response('', { status: 429, headers: { 'Retry-After': header } })
          : new Response('ok');
      }
    });
    await request('https://myanimelist.net/anime/1');
    assert.equal(starts[1], minimum, header);
    await request('https://myanimelist.net/anime/2');
    assert.ok(starts[2] - starts[1] >= 2000, 'throttling keeps later requests slower');
  }
});

test('repeated throttling stops the entire refresh after increasing cooldowns', async () => {
  const clock = createClock();
  const starts = [];
  const request = createScoreRefreshRequest({
    ...clock,
    fetchFn: async () => {
      starts.push(clock.now());
      return new Response('', { status: 429 });
    }
  });
  await assert.rejects(fetchCommunityScore(1, request, 'auto'), /repeated HTTP 429/);
  await assert.rejects(request('https://myanimelist.net/anime/2'), /repeated HTTP 429/);
  assert.deepEqual(starts, [0, 60000, 180000]);
});

test('HTTP 200 challenge pages stop queued work instead of becoming empty episode data', async () => {
  let calls = 0;
  const request = createScoreRefreshRequest({
    ...createClock(), fetchFn: async () => {
      calls += 1;
      return new Response('<title>Just a moment...</title><form id="challenge-form"></form>');
    }
  });
  const results = await Promise.allSettled([
    request('https://myanimelist.net/anime/1/title/episode'),
    request('https://myanimelist.net/anime/2/title/episode')
  ]);
  assert.ok(results.every((result) => result.status === 'rejected' && /security challenge/.test(result.reason.message)));
  assert.equal(calls, 1);
});

test('default pacing is conservative on both providers', async () => {
  for (const [hostname, minimum] of [['myanimelist.net', 10000], ['api.jikan.moe', 3000]]) {
    const clock = createClock();
    const starts = [];
    const request = createScoreRefreshRequest({
      ...clock, fetchFn: async () => { starts.push(clock.now()); return new Response('ok'); }
    });
    await Promise.all([request(`https://${hostname}/anime/1`), request(`https://${hostname}/anime/2`)]);
    assert.deepEqual(starts, [0, minimum]);
  }
});

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
    fetchCommunityScore(63276, request, 'auto'),
    request('https://myanimelist.net/anime/63276/title/episode')
  ]);
  assert.equal(score, 6.48);
  const malCalls = calls.filter(({ url }) => new URL(url).hostname === 'myanimelist.net');
  assert.equal(malCalls.length, 2);
  assert.ok(malCalls[1].time - malCalls[0].time >= 20000);
  assert.equal(calls.filter(({ url }) => url.includes('api.jikan.moe')).length, 5);
});

test('a sustained Jikan outage is tried once per run, then queued and later scores use paced MAL', async () => {
  for (const failureMode of ['network', 'server']) {
    const clock = createClock();
    const calls = [];
    const outages = [];
    const request = createScoreRefreshRequest({
      ...clock, onProviderUnavailable: (event) => outages.push(event),
      fetchFn: async (url) => {
        calls.push({ url, time: clock.now() });
        if (url.includes('api.jikan.moe')) {
          if (failureMode === 'server') return new Response('', { status: 504 });
          throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
        }
        return new Response('<span itemprop="ratingValue">8.5</span>');
      }
    });
    assert.deepEqual(await Promise.all([
      fetchCommunityScore(1, request, 'auto'), fetchCommunityScore(2, request, 'auto')
    ]), [8.5, 8.5]);
    assert.equal(await fetchCommunityScore(3, request, 'auto'), 8.5);
    assert.equal(calls.filter(({ url }) => url.includes('api.jikan.moe')).length, 5, failureMode);
    assert.equal(outages.length, 1);
    const malCalls = calls.filter(({ url }) => url.includes('myanimelist.net'));
    for (let index = 1; index < malCalls.length; index += 1) {
      assert.ok(malCalls[index].time - malCalls[index - 1].time >= 10000);
    }
  }
});

test('Jikan success and title-specific errors reset the outage counter', async () => {
  const clock = createClock();
  let calls = 0;
  const outages = [];
  const request = createScoreRefreshRequest({
    ...clock, onProviderUnavailable: (event) => outages.push(event),
    fetchFn: async () => {
      calls += 1;
      if (calls === 5) return Response.json({ data: { score: 8 } });
      if (calls === 10) return new Response('', { status: 404 });
      if (calls === 15) return Response.json({ data: { score: 9 } });
      throw new Error('temporary connection failure');
    }
  });
  const url = 'https://api.jikan.moe/v4/anime/1';
  assert.equal((await (await request(url)).json()).data.score, 8);
  await assert.rejects(request(url), /HTTP 404/);
  assert.equal((await (await request(url)).json()).data.score, 9);
  assert.equal(calls, 15);
  assert.deepEqual(outages, []);
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
