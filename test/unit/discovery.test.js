import test from 'node:test';
import assert from 'node:assert/strict';
import { Discovery } from '../../src/features/discovery/discovery.js';
import { createAnime, createStats } from '../helpers/factories.js';

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
