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

test('Surprise Me does not treat a median strength from thin evidence as passing its quality gate', () => {
  const originalRandom = Math.random;
  try {
    // Random 0 picks the first remaining candidate, so the thin title is first: only the gate removes it.
    Math.random = () => 0;
    const thin = createAnime({ id: 'thin', episodes: [{}, {}, {}], stats: createStats({ retentionScore: 60, ratingEvidence: { ratedEpisodes: 3, weight: 0.2 } }) });
    const supported = createAnime({ id: 'supported', episodes: [{}, {}, {}], stats: createStats({ retentionScore: 60, ratingEvidence: { ratedEpisodes: 3, weight: 0.9 } }) });
    assert.equal(Discovery.getSurpriseMe([{ anime: thin }, { anime: supported }]).id, 'supported');
  } finally {
    Math.random = originalRandom;
  }
});

test('Surprise Me applies its episode-rating gate to index entries without episode lists', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    // The runtime index strips episodes; rated-episode evidence in stats still identifies rated titles.
    const indexEntry = (id, stats) => createAnime({ id, episodes: [], stats: createStats(stats) });
    const weak = indexEntry('weak', { retentionScore: 30, ratingEvidence: { ratedEpisodes: 12, weight: 1 } });
    const thin = indexEntry('thin', { retentionScore: 51, ratingEvidence: { ratedEpisodes: 1, weight: 0.02 } });
    const strong = indexEntry('strong', { retentionScore: 80, ratingEvidence: { ratedEpisodes: 12, weight: 1 } });
    assert.equal(Discovery.getSurpriseMe([{ anime: weak }, { anime: strong }]).id, 'strong');
    // Fewer rated episodes than the gate's minimum leave the title to the other checks, as before.
    assert.equal(Discovery.getSurpriseMe([{ anime: thin }, { anime: strong }]).id, 'thin');
  } finally {
    Math.random = originalRandom;
  }
});
