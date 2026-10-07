import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreRefreshRun } from '../../tools/lib/score-refresh-run.js';
import { createScoreRefreshRequest, ScoreRefreshStoppedError } from '../../tools/lib/score-refresh-request.js';
import { parseScoreRefreshArgs } from '../../tools/refresh-scores.js';

const rootFor = (...ids) => ({ anime: ids.map(id => ({
  mal_id: id, metadata: { id: `title-${id}`, score: 7, episodes_count: 1 },
  episodes: [{ episode: 1, score: 3 }]
})) });
const episodeHtml = (episode = 1, score = 4) => `<tr class="episode-list-data"><td class="episode-number" data-raw="${episode}"></td><td class="episode-poll" data-raw="${score}"></td></tr>`;
const success = url => new Response(url.includes('/episode') ? episodeHtml() : '<span itemprop="ratingValue">8.5</span>');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const fixture = ({ root = rootFor(1, 2, 3), options = {}, fetchFn = success, request, save, onEvent } = {}) => {
  let clock = 0;
  const saved = [], events = [], urls = [];
  const provider = request || createScoreRefreshRequest({
    ...options, now: () => clock, sleep: async ms => { clock += ms; },
    fetchFn: (url, init) => { urls.push(url); return fetchFn(url, init); }
  });
  const run = createScoreRefreshRun({ root, options, request: provider,
    save: save || (value => saved.push(structuredClone(value))),
    onEvent: onEvent || (event => events.push(event))
  });
  return { ...run, root, saved, events, urls };
};

test('score and episode outcomes are independent, checkpointed, and preserve failed values', async () => {
  const task = fixture({ root: rootFor(1, 2), options: { scoreSource: 'auto', saveInterval: 1 }, fetchFn: url => {
    if (url.includes('api.jikan.moe/v4/anime/1')) return Response.json({ data: { score: 8 } });
    if (url.includes('/anime/2/') && url.endsWith('/episode')) return new Response(episodeHtml());
    throw new Error('fixture failure');
  } });
  const result = await task.run();
  assert.equal(result.status, 'completed');
  assert.equal(result.stats.processed, 2);
  assert.equal(result.stats.scoreErrors, 1);
  assert.equal(result.stats.episodeErrors, 1);
  assert.deepEqual(result.failedMalIds, [1, 2]);
  assert.equal(result.resumeIndex, 0);
  assert.equal(task.saved.length, 3, 'each interval plus the final checkpoint');
  assert.equal(task.saved[0].anime[0].metadata.score, 8);
  assert.deepEqual(task.saved.at(-1).anime[0].episodes, [{ episode: 1, score: 3 }]);
  assert.equal(task.saved.at(-1).anime[1].metadata.score, 7);
  assert.deepEqual(task.saved.at(-1).anime[1].episodes, [{ episode: 1, score: 4 }]);
  assert.deepEqual(task.events.filter(event => event.type === 'fetch-failed').map(event => event.kind), ['episode', 'score']);
});

test('provider protection stops new titles and returns the first unsuccessful filtered index', async () => {
  const task = fixture({
    root: rootFor(99, 1, 2, 3), options: { malIds: new Set([1, 2, 3]) },
    fetchFn: url => url.includes('/anime/2') ? new Response('', { status: 403 }) : success(url)
  });
  const result = await task.run();
  assert.equal(result.status, 'stopped');
  assert.match(result.reason, /HTTP 403/);
  assert.equal(result.resumeIndex, 1);
  assert.deepEqual(result.failedMalIds, [2]);
  assert.equal(task.saved.at(-1).anime[1].metadata.score, 8.5);
  assert.equal(task.saved.at(-1).anime[0].metadata.score, 7);
  assert.equal(task.saved.at(-1).anime[3].metadata.score, 7);
  assert.ok(task.urls.every(url => !url.includes('/anime/3')));
});

test('interruption saves completed work immediately and ignores late responses', async () => {
  const entered = deferred(), waiting = deferred();
  const signals = [], urls = [];
  const task = fixture({ request: async (url, { signal }) => {
    urls.push(url); signals.push(signal);
    if (url.includes('/anime/2')) { entered.resolve(); await waiting.promise; }
    return success(url);
  } });
  const pending = task.run();
  await entered.promise;
  const stopped = task.stop();
  assert.equal(stopped.status, 'interrupted');
  assert.equal(stopped.resumeIndex, 1);
  assert.equal(stopped.stats.processed, 1);
  assert.equal(task.saved.length, 1);
  assert.equal(task.saved[0].anime[0].metadata.score, 8.5);
  assert.equal(task.saved[0].anime[1].metadata.score, 7);
  assert.ok(signals.every(signal => signal.aborted));
  waiting.resolve();
  assert.deepEqual(await pending, stopped);
  assert.deepEqual(task.root, task.saved[0], 'late results cannot mutate the saved checkpoint');
  task.stop();
  await task.run();
  assert.equal(task.saved.length, 1, 'repeated commands do not repeat a run or a stop checkpoint');
  assert.ok(urls.every(url => !url.includes('/anime/3')));
});

test('out-of-order completion and a provider stop retain successes without advancing past a gap', async () => {
  const first = deferred(), second = deferred(), third = deferred();
  const checkpoints = [];
  const root = rootFor(1, 2, 3, 4);
  const task = fixture({ root, options: { concurrency: 3, saveInterval: 1 },
    save: value => { checkpoints.push(structuredClone(value)); second.resolve(); },
    request: async url => {
      if (url.includes('/anime/1')) { await first.promise; return success(url); }
      if (url.includes('/anime/2')) throw new ScoreRefreshStoppedError('protected');
      if (url.includes('/anime/3')) { await third.promise; return success(url); }
      throw new Error('title four must never start');
    }
  });
  const pending = task.run();
  await second.promise;
  third.resolve();
  first.resolve();
  const result = await pending;
  assert.equal(result.status, 'stopped');
  assert.equal(result.resumeIndex, 1);
  assert.equal(result.stats.processed, 3);
  assert.deepEqual(result.failedMalIds, [2]);
  assert.equal(checkpoints.at(-1).anime[2].metadata.score, 8.5, 'already-active successes survive a provider stop');
  assert.equal(root.anime[3].metadata.score, 7);
});

test('sustained Jikan outage uses paced MAL for later titles through the existing request module', async () => {
  let attempts = 0;
  const task = fixture({ options: { scoreSource: 'auto' }, fetchFn: url => {
    if (url.includes('api.jikan.moe')) { attempts++; throw new TypeError('connection failed'); }
    return success(url);
  } });
  const result = await task.run();
  assert.equal(attempts, 5);
  assert.equal(result.stats.scoreErrors, 0);
  assert.equal(result.stats.episodeErrors, 0);
  assert.ok(task.root.anime.every(anime => anime.metadata.score === 8.5));
});

test('default MAL mode, filtered start and limit, and unrated data preserve existing values', async () => {
  const task = fixture({ root: rootFor(9, 1, 2, 3),
    options: { malIds: new Set([1, 2, 3]), startIndex: 1, limit: 1 },
    fetchFn: () => new Response('<html>No ratings yet</html>')
  });
  const before = structuredClone(task.root);
  const result = await task.run();
  assert.equal(result.stats.processed, 1);
  assert.equal(result.resumeIndex, 2);
  assert.ok(task.urls.every(url => url.startsWith('https://myanimelist.net/anime/2')));
  assert.deepEqual(task.root, before);
  assert.deepEqual(task.events[0], { type: 'started', total: 1, startIndex: 1, endIndex: 2 });
  const defaults = parseScoreRefreshArgs([]);
  assert.equal(defaults.scoreSource, 'mal');
  assert.equal(defaults.concurrency, 1);
  assert.equal(defaults.malDelayMs, 10000);
  assert.equal(defaults.jikanDelayMs, 3000);
});

test('episode pagination deduplicates trusted pages and updates the episode total', async () => {
  const task = fixture({ root: rootFor(1), fetchFn: url => {
    if (!url.includes('/episode')) return success(url);
    if (url.includes('offset=100')) return new Response(episodeHtml(100, 4.5) + episodeHtml(101, 4.8)
      + '<link rel="next" href="https://example.com/anime/1/episode">');
    return new Response(Array.from({ length: 100 }, (_, index) => episodeHtml(index + 1)).join('')
      + '<link rel="canonical" href="https://myanimelist.net/anime/1/title-1/episode">');
  } });
  const result = await task.run();
  assert.equal(result.stats.updatedEpisodes, 1);
  assert.equal(task.root.anime[0].metadata.episodes_count, 101);
  assert.equal(task.root.anime[0].episodes.length, 101);
  assert.equal(task.root.anime[0].episodes[99].score, 4.5);
  assert.equal(task.urls.filter(url => url.includes('/episode')).length, 2);
  assert.ok(task.urls.every(url => new URL(url).hostname === 'myanimelist.net'));
});

test('a failed checkpoint rejects the run and freezes pending and already-resolved workers', async () => {
  const waiting = deferred();
  const root = rootFor(1, 2, 3);
  const task = fixture({ root, options: { concurrency: 2, saveInterval: 1 },
    save: () => { throw new Error('disk full'); },
    request: async url => { if (url.includes('/anime/2')) await waiting.promise; return success(url); }
  });
  await assert.rejects(task.run(), /disk full/);
  const checkpoint = structuredClone(root);
  waiting.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(root, checkpoint);
  assert.equal(root.anime[1].metadata.score, 7);
  assert.equal(root.anime[2].metadata.score, 7);

  const ready = fixture({ options: { concurrency: 2, saveInterval: 1 },
    save: () => { throw new Error('disk full'); }, request: async url => success(url)
  });
  await assert.rejects(ready.run(), /disk full/);
  assert.equal(ready.root.anime[1].metadata.score, 7);
});

test('an empty selection still checkpoints; invalid IDs leave a resume gap', async () => {
  const empty = fixture({ options: { malIds: new Set([99]) } });
  assert.equal((await empty.run()).stats.processed, 0);
  assert.equal(empty.saved.length, 1);
  assert.deepEqual(empty.urls, []);
  const invalid = fixture({ root: rootFor('invalid', 2) });
  const result = await invalid.run();
  assert.equal(result.stats.processed, 2);
  assert.equal(result.stats.scoreErrors, 1);
  assert.equal(result.stats.episodeErrors, 1);
  assert.equal(result.resumeIndex, 0);
});
