import test from 'node:test';
import assert from 'node:assert/strict';
import { FilterPresets } from '../../src/features/discovery/filterPresets.ts';
import { createAnime, createStats } from '../helpers/factories.js';

test('FilterPresets matchesPreset and getMatchingPresets', () => {
  const anime = createAnime({ stats: createStats({ threeEpisodeHook: 85 }) });
  assert.equal(FilterPresets.matchesPreset('strong-starters', anime), true);
  const matches = FilterPresets.getMatchingPresets(anime);
  assert.ok(matches.includes('strong-starters'));
});
