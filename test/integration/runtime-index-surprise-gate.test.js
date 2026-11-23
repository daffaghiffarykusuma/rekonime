import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFullIndexPayload } from '../../tools/runtime-catalog-index.js';
import { expandCatalogStats } from '../../src/features/catalog/catalog-stats-defaults.js';
import { Discovery } from '../../src/features/discovery/discovery.js';

// Production loads the compact runtime index, which has no episode lists. Surprise Me's
// episode-rating gate must still see each title's rating evidence after the build's
// projection and compaction and the loader's expansion.
test('the runtime index keeps the rating evidence Surprise Me gates on', () => {
  const full = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'anime.full.json'), 'utf8'));
  const index = expandCatalogStats(JSON.parse(JSON.stringify(buildFullIndexPayload(full))));
  const { minEpisodes, minRetention, minEvidenceWeight } = Discovery.qualityThresholds;

  assert.deepEqual(index.scoreProfile.strengthQuantiles, full.scoreProfile.strengthQuantiles);
  assert.equal(index.anime.length, full.anime.length);
  let gated = 0;
  index.anime.forEach((anime, i) => {
    const source = full.anime[i].stats;
    assert.equal(anime.id, full.anime[i].id);
    assert.equal(anime.episodes, undefined, `${anime.id}: the index carries no episode list`);
    assert.equal(anime.stats.retentionScore, source.retentionScore, `${anime.id}: retentionScore`);
    assert.equal(anime.stats.ratingEvidence.ratedEpisodes, source.ratingEvidence.ratedEpisodes, `${anime.id}: ratedEpisodes`);
    assert.equal(anime.stats.ratingEvidence.weight, source.ratingEvidence.weight, `${anime.id}: weight`);

    // The expected decision deliberately restates the gate rule: this test proves the index
    // delivers the gate's inputs, while discovery.test.js covers the gate logic. If getSurpriseMe
    // gains another rejection reason, update this rule rather than reading it as data loss.
    const evidence = anime.stats.ratingEvidence;
    const rejected = evidence.ratedEpisodes >= minEpisodes
      && (anime.stats.retentionScore < minRetention || evidence.weight < minEvidenceWeight);
    if (rejected) gated += 1;
    assert.equal(Discovery.getSurpriseMe([{ anime }]) === null, rejected, `${anime.id}: Surprise Me gate`);
  });
  assert.ok(gated > index.anime.length / 3, `the gate rejects a real share of the index (${gated})`);
});
