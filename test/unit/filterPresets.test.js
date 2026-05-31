import test from 'node:test';
import assert from 'node:assert/strict';
import { FilterPresets } from '../../js/filterPresets.ts';
import { createAnime, createStats } from '../helpers/factories.js';

test('FilterPresets applyPreset filters data', () => {
  const good = createAnime({ stats: createStats({ flowState: 80, stressSpikes: 1 }) });
  const bad = createAnime({ id: 'bad', stats: createStats({ flowState: 40, stressSpikes: 5 }) });

  const result = FilterPresets.applyPreset('binge-worthy', [good, bad]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, good.id);
});

test('FilterPresets getSortForPreset maps keys', () => {
  assert.equal(FilterPresets.getSortForPreset('binge-worthy'), 'retention');
  assert.equal(FilterPresets.getSortForPreset('critical-darlings'), 'satisfaction');
});

test('FilterPresets matchesPreset and getMatchingPresets', () => {
  const anime = createAnime({ stats: createStats({ threeEpisodeHook: 85 }) });
  assert.equal(FilterPresets.matchesPreset('strong-starters', anime), true);
  const matches = FilterPresets.getMatchingPresets(anime);
  assert.ok(matches.includes('strong-starters'));
});
