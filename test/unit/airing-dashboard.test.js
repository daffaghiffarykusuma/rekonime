import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiringDashboardModel,
  createAiringScheduleRuntime,
  fetchAiringSchedules
} from '../../src/features/airing/airing-schedule.ts';
import { createAiringDashboardController } from '../../src/features/airing/airing-dashboard.ts';
import { CacheManager } from '../../src/shared/services/cache-manager.ts';
import { setupDom } from '../helpers/dom.js';

const resetCache = () => {
  CacheManager.clearMemory();
  if (globalThis.localStorage) {
    localStorage.clear();
  }
};

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
        airingAt: Math.floor((now + ((2 * 24 + 4) * 60 * 60 * 1000)) / 1000)
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
  assert.equal(model.items.find(item => item.id === 'show-b').countdownLabel, 'in 2d 4h');
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

test('airing dashboard controller renders safe schedule cards and summary', async () => {
  setupDom(`<!doctype html><section id="airing-dashboard-section" hidden>
    <p id="airing-dashboard-subtitle"></p>
    <div id="airing-dashboard-summary"></div>
    <div id="airing-dashboard-grid"></div>
    <p id="airing-dashboard-empty" hidden></p>
  </section>`);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      Page: {
        media: [{
          id: 1,
          idMal: 555,
          status: 'RELEASING',
          episodes: 12,
          nextAiringEpisode: {
            episode: 4,
            airingAt: Math.floor((Date.now() + 60 * 60 * 1000) / 1000),
            timeUntilAiring: 3600
          }
        }]
      }
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const controller = createAiringDashboardController();
    await controller.update({
      entries: [{ id: 'unsafe-show', status: 'watching', progress: 2 }],
      animeItems: [{
        id: 'unsafe-show',
        title: '<img src=x onerror=alert(1)>',
        cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
        malId: 555
      }],
      locale: 'en-US',
      timeZone: 'UTC'
    });

    const section = document.getElementById('airing-dashboard-section');
    const grid = document.getElementById('airing-dashboard-grid');
    assert.equal(section.hidden, false);
    assert.equal(document.getElementById('airing-dashboard-subtitle').textContent.length > 0, true);
    assert.equal(document.querySelectorAll('#airing-dashboard-summary .airing-summary-card').length, 3);
    assert.equal(grid.querySelectorAll('.airing-card').length, 1);
    assert.equal(grid.querySelector('h3').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(grid.querySelector('img[onerror]'), null);
    assert.equal(document.getElementById('airing-dashboard-empty').hidden, true);
    controller.destroy();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('airing dashboard controller handles loading, empty watchlists, and missing sections', async () => {
  setupDom(`<!doctype html><section id="airing-dashboard-section" hidden>
    <p id="airing-dashboard-subtitle"></p>
    <div id="airing-dashboard-summary"></div>
    <div id="airing-dashboard-grid"></div>
    <p id="airing-dashboard-empty" hidden></p>
  </section>`);

  const controller = createAiringDashboardController();
  controller.showLoading(0);
  assert.equal(document.getElementById('airing-dashboard-section').hidden, true);

  controller.showLoading(1);
  assert.equal(document.querySelector('.airing-summary-card.is-loading') !== null, true);
  assert.equal(document.getElementById('airing-dashboard-section').hidden, false);

  await controller.update({ entries: [], animeItems: [] });
  assert.equal(document.getElementById('airing-dashboard-section').hidden, true);
  assert.equal(document.getElementById('airing-dashboard-summary').innerHTML, '');
  controller.destroy();

  const missingNodesController = createAiringDashboardController({ sectionId: 'missing-section' });
  missingNodesController.showLoading(1);
  await missingNodesController.update({ entries: [], animeItems: [] });
  missingNodesController.destroy();
});
