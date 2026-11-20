import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCatalogColorIndex, compactCatalogStats, expandCatalogStats } from '../../src/features/catalog/catalog-stats-defaults.js';

const evidence = (overrides = {}) => ({ ratedEpisodes: 12, coverage: 1, medianVotes: null, limited: false, ...overrides });
const sample = () => [
  { id: 'a', stats: { average: 4.1, scoringVersion: 2, slowBurn: { signal: 0, isActive: false }, ratingEvidence: evidence() } },
  { id: 'b', stats: { average: 3.9, scoringVersion: 2, slowBurn: { signal: 0, isActive: false }, ratingEvidence: evidence({ ratedEpisodes: 24 }) } },
  { id: 'c', stats: { average: 3.2, scoringVersion: 2, slowBurn: { signal: 0.4, isActive: true }, ratingEvidence: evidence({ limited: true }) } },
  { id: 'd', stats: null }
];

test('catalog stats compaction round-trips to the original entries', () => {
  const original = sample();
  const { anime, statsDefaults } = compactCatalogStats(structuredClone(original));

  assert.deepEqual(statsDefaults, {
    scoringVersion: 2,
    slowBurn: { signal: 0, isActive: false },
    ratingEvidence: { ratedEpisodes: 12, coverage: 1, medianVotes: null, limited: false }
  });
  assert.deepEqual(anime[0].stats, { average: 4.1 });
  assert.deepEqual(anime[1].stats.ratingEvidence, { ratedEpisodes: 24 });
  assert.deepEqual(anime[2].stats.slowBurn, { signal: 0.4, isActive: true });
  assert.equal(anime[3].stats, null);

  assert.deepEqual(expandCatalogStats({ statsDefaults, anime }).anime, original);
});

test('catalog stats compaction never defaults a field that some titles lack', () => {
  const { statsDefaults } = compactCatalogStats([
    { id: 'a', stats: { scoringVersion: 2, flowState: 100 } },
    { id: 'b', stats: { scoringVersion: 2, flowState: 100 } },
    { id: 'c', stats: { scoringVersion: 2 } }
  ]);
  assert.deepEqual(statsDefaults, { scoringVersion: 2 });
});

test('catalog stats expansion gives each title its own copy of object defaults', () => {
  const payload = expandCatalogStats({
    statsDefaults: { slowBurn: { signal: 0, isActive: false } },
    anime: [{ id: 'a', stats: {} }, { id: 'b', stats: {} }]
  });
  payload.anime[0].stats.slowBurn.signal = 1;
  assert.equal(payload.anime[1].stats.slowBurn.signal, 0);
  assert.equal('statsDefaults' in payload, false);
});

test('catalog stats expansion leaves payloads without defaults unchanged', () => {
  const payload = { anime: [{ id: 'a', stats: { average: 4 } }] };
  assert.deepEqual(expandCatalogStats(structuredClone(payload)), payload);
});

test('catalog color index compaction omits position indexes and expansion restores them', () => {
  const original = [
    { id: 'a', colorIndex: 0 },
    { id: 'b', colorIndex: 7 },
    { id: 'c', colorIndex: 2 },
    { id: 'd' }
  ];
  const { anime, colorIndexFromPosition } = compactCatalogColorIndex(structuredClone(original));

  assert.equal(colorIndexFromPosition, true);
  assert.deepEqual(anime, [{ id: 'a' }, { id: 'b', colorIndex: 7 }, { id: 'c' }, { id: 'd' }]);

  const expanded = expandCatalogStats({ colorIndexFromPosition, anime });
  assert.deepEqual(expanded.anime, [
    { id: 'a', colorIndex: 0 },
    { id: 'b', colorIndex: 7 },
    { id: 'c', colorIndex: 2 },
    { id: 'd', colorIndex: 3 }
  ]);
  assert.equal('colorIndexFromPosition' in expanded, false);
});

test('catalog color index compaction leaves lists without position indexes unchanged', () => {
  const list = [{ id: 'a', colorIndex: 4 }];
  const { anime, colorIndexFromPosition } = compactCatalogColorIndex(list);
  assert.equal(anime, list);
  assert.equal(colorIndexFromPosition, false);
  assert.deepEqual(expandCatalogStats({ anime: [{ id: 'x' }] }).anime, [{ id: 'x' }]);
});
