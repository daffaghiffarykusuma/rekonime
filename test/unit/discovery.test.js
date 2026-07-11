import test from 'node:test';
import assert from 'node:assert/strict';
import { Discovery } from '../../js/discovery.js';
import { createAnime, createStats } from '../helpers/factories.js';

test('Discovery getSurpriseMe filters by quality thresholds', () => {
  const high = createAnime({ id: 'high', stats: createStats({ retentionScore: 90 }), communityScore: 8.5 });
  const low = createAnime({ id: 'low', stats: createStats({ retentionScore: 50 }), communityScore: 6.0 });

  const result = Discovery.getSurpriseMe([
    { anime: high, weight: 1 },
    { anime: low, weight: 1 }
  ], { requireRetention: true, requireSatisfaction: false });
  assert.equal(result.id, 'high');
});

test('Discovery applies quality gates to Taste Profile weighted candidates', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const lowQuality = createAnime({
      id: 'low',
      episodes: [{}, {}, {}],
      stats: createStats({ retentionScore: 20 })
    });
    const qualified = createAnime({
      id: 'qualified',
      episodes: [{}, {}, {}],
      stats: createStats({ retentionScore: 90 })
    });

    const result = Discovery.getSurpriseMe([
      { anime: lowQuality, weight: 100 },
      { anime: qualified, weight: 1 }
    ]);

    assert.equal(result.id, 'qualified');
  } finally {
    Math.random = originalRandom;
  }
});

test('Discovery getSeasonalFilters returns only existing seasons', () => {
  const originalCurrent = Discovery.getCurrentSeason;
  Discovery.getCurrentSeason = () => ({ season: 'Spring', year: 2024, seasonYear: 'Spring 2024' });

  const list = [
    createAnime({ season: 'Spring', year: 2024 }),
    createAnime({ season: 'Winter', year: 2024 })
  ];

  const filters = Discovery.getSeasonalFilters(list);
  assert.equal(filters.length, 2);
  const values = filters.map(item => item.value);
  assert.ok(values.includes('Spring 2024'));
  assert.ok(values.includes('Winter 2024'));

  Discovery.getCurrentSeason = originalCurrent;
});

test('Discovery getTrending orders by score', () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  const top = createAnime({ id: 'top', communityScore: 9.5, stats: createStats({ retentionScore: 90, worthFinishing: 85 }) });
  const low = createAnime({ id: 'low', communityScore: 6.0, stats: createStats({ retentionScore: 40, worthFinishing: 40 }) });

  const result = Discovery.getTrending([low, top], 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'top');

  Math.random = originalRandom;
});

test('Discovery popularity score is deterministic for the same catalog data', () => {
  const anime = createAnime({
    id: 'stable',
    communityScore: 8.4,
    stats: createStats({ retentionScore: 84, worthFinishing: 82 })
  });

  assert.equal(
    Discovery.calculateTrendingScore(anime),
    Discovery.calculateTrendingScore(anime)
  );
});

test('Discovery getPopularThisWeek is stable for same week', () => {
  const originalWeek = Discovery.getWeekNumber;
  Discovery.getWeekNumber = () => 5;

  const list = [
    createAnime({ id: 'a', communityScore: 8.0 }),
    createAnime({ id: 'b', communityScore: 8.1 }),
    createAnime({ id: 'c', communityScore: 8.2 })
  ];

  const first = Discovery.getPopularThisWeek(list, 3).map(item => item.id);
  const second = Discovery.getPopularThisWeek(list, 3).map(item => item.id);

  assert.deepEqual(first, second);

  Discovery.getWeekNumber = originalWeek;
});
