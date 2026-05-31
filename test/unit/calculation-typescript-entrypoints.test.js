import test from 'node:test';
import assert from 'node:assert/strict';
import { Stats } from '../../js/stats.ts';
import { Recommendations } from '../../js/recommendations.ts';
import { FilterPresets } from '../../js/filterPresets.ts';

test('TypeScript calculation entrypoints preserve scoring, recommendation, and preset behavior', () => {
  const episodes = [{ episode: 1, score: 3 }, { episode: 2, score: 4 }, { episode: 3, score: 5 }];
  const anime = {
    id: 'alpha',
    genres: ['Action', 'Adventure'],
    themes: ['Fantasy'],
    communityScore: 8.6,
    episodes,
    stats: Stats.calculateAllStats({ episodes }, Stats.defaultScoreProfile)
  };

  assert.equal(Stats.calculateAverage(episodes), 4);
  assert.equal(typeof Recommendations.getRecommendationReason(anime), 'string');
  assert.equal(FilterPresets.matchesPreset('critical-darlings', anime), true);
});
