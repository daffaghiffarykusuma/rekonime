import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiringDashboardModel,
  createAiringScheduleRuntime,
  fetchAiringSchedules,
  formatCountdownLabel
} from '../../js/airing-schedule.ts';
import { CacheManager } from '../../js/services/cache-manager.ts';

const resetCache = () => {
  CacheManager.clearMemory();
  if (globalThis.localStorage) {
    localStorage.clear();
  }
};

test('formatCountdownLabel compresses short and long countdowns', () => {
  const now = Date.UTC(2026, 3, 15, 12, 0, 0);
  assert.equal(formatCountdownLabel(now + 45 * 60 * 1000, now), 'in 45m');
  assert.equal(formatCountdownLabel(now + (2 * 60 + 15) * 60 * 1000, now), 'in 2h 15m');
  assert.equal(formatCountdownLabel(now + ((2 * 24) + 4) * 60 * 60 * 1000, now), 'in 2d 4h');
});

test('buildAiringDashboardModel prioritizes released episodes over future-only drops', () => {
  const now = Date.UTC(2026, 3, 15, 12, 0, 0);
  const entries = [
    {
      id: 'show-a',
      status: 'watching',
      progress: 3,
      snapshot: {
        id: 'show-a',
        title: 'Show A',
        cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
        malId: 111
      }
    },
    {
      id: 'show-b',
      status: 'planned',
      progress: 0,
      snapshot: {
        id: 'show-b',
        title: 'Show B',
        cover: 'https://cdn.myanimelist.net/images/anime/2/2.jpg',
        malId: 222
      }
    }
  ];

  const animeItems = [
    { id: 'show-a', title: 'Show A', cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg', malId: 111, studio: 'A', year: 2026 },
    { id: 'show-b', title: 'Show B', cover: 'https://cdn.myanimelist.net/images/anime/2/2.jpg', malId: 222, studio: 'B', year: 2026 }
  ];

  const scheduleMap = new Map([
    [111, {
      malId: 111,
      status: 'RELEASING',
      episodeCount: 12,
      nextAiringEpisode: {
        episode: 5,
        airingAt: Math.floor((now + (6 * 60 * 60 * 1000)) / 1000)
      }
    }],
    [222, {
      malId: 222,
      status: 'RELEASING',
      episodeCount: 12,
      nextAiringEpisode: {
        episode: 1,
        airingAt: Math.floor((now + (2 * 24 * 60 * 60 * 1000)) / 1000)
      }
    }]
  ]);

  const model = buildAiringDashboardModel({
    entries,
    animeItems,
    scheduleMap,
    nowMs: now,
    locale: 'en-US',
    timeZone: 'UTC'
  });

  assert.equal(model.items.length, 2);
  assert.equal(model.items[0].id, 'show-a');
  assert.equal(model.items[0].behindCount, 1);
  assert.equal(model.counts.availableNow, 1);
  assert.equal(model.counts.airingToday, 1);
});

test('fetchAiringSchedules caches fresh AniList responses by MAL id', async () => {
  resetCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      data: {
        Page: {
          media: [
            {
              id: 1,
              idMal: 333,
              status: 'RELEASING',
              episodes: 12,
              nextAiringEpisode: {
                episode: 4,
                airingAt: 1770000000,
                timeUntilAiring: 3600
              }
            }
          ]
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const animeItems = [{ id: 'cached-show', title: 'Cached Show', cover: 'https://cdn.myanimelist.net/images/anime/3/3.jpg', malId: 333 }];
    const first = await fetchAiringSchedules(animeItems);
    const second = await fetchAiringSchedules(animeItems);

    assert.equal(calls, 1);
    assert.equal(first.get(333)?.status, 'RELEASING');
    assert.equal(second.get(333)?.nextAiringEpisode?.episode, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createAiringScheduleRuntime owns countdown refresh ticks', async () => {
  let now = Date.UTC(2026, 3, 15, 12, 0, 0);
  let tick = null;
  const models = [];
  const targetAiringAt = Math.floor((now + 90 * 60 * 1000) / 1000);

  const runtime = createAiringScheduleRuntime({
    now: () => now,
    onModel: (model) => models.push(model),
    fetchSchedules: async () => new Map([
      [444, {
        malId: 444,
        status: 'RELEASING',
        episodeCount: 12,
        nextAiringEpisode: {
          episode: 3,
          airingAt: targetAiringAt
        }
      }]
    ]),
    setIntervalFn: (callback) => {
      tick = callback;
      return 10;
    },
    clearIntervalFn: () => {}
  });

  await runtime.update({
    entries: [{ id: 'show-c', status: 'watching', progress: 1 }],
    animeItems: [{ id: 'show-c', title: 'Show C', cover: 'https://cdn.myanimelist.net/images/anime/4/4.jpg', malId: 444 }]
  });

  assert.equal(models[0].items[0].countdownLabel, 'in 1h 30m');
  assert.equal(typeof tick, 'function');

  now += 60 * 60 * 1000;
  tick();

  assert.equal(models[1].items[0].countdownLabel, 'in 30m');
  runtime.destroy();
});
