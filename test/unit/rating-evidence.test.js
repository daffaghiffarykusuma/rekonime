import test from 'node:test';
import assert from 'node:assert/strict';
import { getRatingSignals } from '../../src/features/discovery/rating-evidence.ts';

const evidence = (overrides = {}) => ({
  ratedEpisodes: 12, totalEpisodes: 12, positionsKnown: true, limited: false, completion: 'finished', ...overrides
});

test('rating signals lead with rounded Episode Rating Strength when episode ratings exist', () => {
  const signals = getRatingSignals({
    communityScore: 8.6,
    episodes: [{ episode: 1, score: 4.2 }],
    stats: { retentionScore: 86.4, threeEpisodeHook: 71.6, churnRisk: { score: 20.2 }, worthFinishing: 64.5, ratingEvidence: evidence() }
  });

  assert.equal(signals.episodeRatingStrength, 86);
  assert.equal(signals.episodeRatingStrengthClass, 'score-high');
  assert.deepEqual([signals.start, signals.stay, signals.finish], [72, 80, 65]);
  assert.deepEqual(signals.headline, {
    value: '86/100', kind: 'episode', label: 'Episode Rating Strength',
    note: '12/12 episodes rated', className: 'score-high'
  });
});

test('without rated episodes the strength is unavailable and the Community Score leads', () => {
  const signals = getRatingSignals({
    communityScore: 7.8,
    stats: { retentionScore: 90, threeEpisodeHook: 80, worthFinishing: 70, ratingEvidence: evidence({ ratedEpisodes: 0, totalEpisodes: null }) }
  });

  assert.equal(signals.hasEpisodeEvidence, false);
  assert.equal(signals.episodeRatingStrength, null);
  assert.deepEqual([signals.start, signals.stay, signals.finish], [null, null, null]);
  assert.equal(signals.headline.kind, 'community');
  assert.equal(signals.headline.value, '7.8/10');
  assert.match(signals.headline.note, /Episode rating data unavailable/);
});

test('missing opening episodes withhold the opening signal only', () => {
  const signals = getRatingSignals({
    episodes: [{ episode: 5, score: 4 }],
    stats: { retentionScore: 70, threeEpisodeHook: 90, worthFinishing: 60, ratingEvidence: evidence({ limited: true, completion: 'airing' }) }
  });

  assert.equal(signals.start, null);
  assert.equal(signals.finish, 60);
  assert.equal(signals.evidenceLabel, 'Limited data · 12/12 episodes rated · Provisional');
});

test('a title with no ratings at all reports an unavailable headline', () => {
  assert.deepEqual(getRatingSignals({}).headline, {
    value: 'N/A', kind: 'unavailable', label: 'Decision signal', note: 'Open details for more context', className: 'score-low'
  });
});

test('thin episode evidence leads with the Community Score when one exists', () => {
  const sparse = { episodes: [{ episode: 1, score: 5 }], stats: { retentionScore: 50, ratingEvidence: evidence({ ratedEpisodes: 1, limited: true, weight: 0.08 }) } };
  const withCommunity = getRatingSignals({ ...sparse, communityScore: 7.4 });
  assert.equal(withCommunity.episodeRatingStrength, 50);
  assert.equal(withCommunity.headline.kind, 'community');
  assert.match(withCommunity.headline.note, /Limited data/);
  assert.equal(getRatingSignals(sparse).headline.kind, 'episode');
  const enough = getRatingSignals({ ...sparse, communityScore: 7.4, stats: { ...sparse.stats, ratingEvidence: evidence({ weight: 0.5 }) } });
  assert.equal(enough.headline.kind, 'episode');
});

test('strength bands are catalog shares, so the median prior is never marked poor', () => {
  const band = value => getRatingSignals({ episodes: [{ episode: 1, score: 4 }], stats: { retentionScore: value, ratingEvidence: evidence() } }).episodeRatingStrengthClass;
  assert.deepEqual([band(85), band(84), band(50), band(49), band(20), band(19)],
    ['score-high', 'score-mid', 'score-mid', 'score-low', 'score-low', 'score-poor']);
});
