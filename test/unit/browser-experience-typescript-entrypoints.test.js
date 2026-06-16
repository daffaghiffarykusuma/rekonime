import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiringDashboardModel, formatCountdownLabel } from '../../js/airing-schedule.ts';
import { createDetailExperience } from '../../js/detail-experience.ts';
import { createRuntimeCapabilities } from '../../js/runtime-capabilities.ts';

test('TypeScript browser experience entrypoints preserve core behavior', () => {
  const model = buildAiringDashboardModel({
    entries: [{ id: 'show-1', status: 'watching', progress: 1 }],
    animeItems: [{ id: 'show-1', title: 'Show 1', cover: 'https://example.test/cover.jpg', malId: 1 }],
    scheduleMap: new Map([[1, {
      status: 'RELEASING',
      episodeCount: 12,
      nextAiringEpisode: {
        episode: 2,
        airingAt: 121,
        timeUntilAiring: 120
      }
    }]]),
    nowMs: 1000
  });
  const runtime = createRuntimeCapabilities();
  const detail = createDetailExperience({
    cache: {
      store: new Map(),
      maxSize: 1
    }
  });

  assert.equal(formatCountdownLabel(61_000, 1_000), 'in under a minute');
  assert.equal(model.counts.tracking, 1);
  assert.equal(typeof runtime.handleGlobalEscape, 'function');
  detail.cache('show-1', '<p>cached</p>');
  assert.equal(detail.getCached('show-1'), '<p>cached</p>');
});
