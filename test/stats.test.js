import test from 'node:test';
import assert from 'node:assert/strict';
import { Stats } from '../src/features/discovery/stats.ts';

test('buildScoreProfileFromScores falls back for small samples', () => {
  const profile = Stats.buildScoreProfileFromScores([4, 4, 4, 4]);
  assert.equal(profile.p35, Stats.defaultScoreProfile.p35);
  assert.equal(profile.p50, Stats.defaultScoreProfile.p50);
  assert.equal(profile.p65, Stats.defaultScoreProfile.p65);
  assert.equal(profile.sampleSize, 4);
  assert.equal(profile.source, 'default');
});

test('resolveScoreProfile orders percentiles and clamps values', () => {
  const resolved = Stats.resolveScoreProfile({ p35: 4.9, p50: 1.1, p65: 6 });
  assert.deepEqual(resolved, { p35: 1.1, p50: 4.9, p65: 5 });
});

test('calculateFinaleStrength returns neutral for flat short series', () => {
  const episodes = [{ score: 4 }, { score: 4 }];
  assert.equal(Stats.calculateFinaleStrength(episodes), 50);
});

test('calculateFlowState returns 100 for stable scores', () => {
  const episodes = [{ score: 4 }, { score: 4 }, { score: 4 }];
  assert.equal(Stats.calculateFlowState(episodes), 100);
});

test('calculateAllStats handles oversized episode arrays without spreading', () => {
  const episodes = Array.from({ length: Stats.maxEpisodeEntries + 100 }, (_, index) => ({
    episode: index + 1,
    score: index % 2 === 0 ? 1 : 5
  }));

  const stats = Stats.calculateAllStats({ episodes });

  assert.equal(stats.episodeCount, Stats.maxEpisodeEntries);
  assert.equal(stats.highestScore, 5);
  assert.equal(stats.lowestScore, 1);
  assert.equal(stats.average, 3);
  assert.equal(stats.stdDev, 2);
  assert.equal(stats.peakScore, 5);
  assert.ok(stats.controversyPotential > 0);
});

test('calculateChurnRisk returns Unknown for empty episodes', () => {
  const result = Stats.calculateChurnRisk([]);
  assert.equal(result.label, 'Unknown');
  assert.equal(result.score, 0);
  assert.deepEqual(result.factors, []);
});

test('calculateRollingAverage returns windowed averages', () => {
  const episodes = [
    { episode: 1, score: 3 },
    { episode: 2, score: 4 },
    { episode: 3, score: 5 }
  ];
  assert.deepEqual(Stats.calculateRollingAverage(episodes, 3), [{ episode: 3, rollingAvg: 4 }]);
});

test('calculateRetentionScore returns 0 for empty episodes', () => {
  assert.equal(Stats.calculateRetentionScore([], Stats.defaultScoreProfile), 0);
});

test('rating strength discounts sparse coverage and uses actual opening positions', () => {
  const sparse = Stats.calculateAllStats({ episodeCount: 72, episodes: [{ episode: 18, score: 5 }] });
  assert.equal(sparse.ratingEvidence.limited, true);
  assert.equal(sparse.ratingEvidence.ratedEpisodes, 1);
  assert.equal(sparse.ratingEvidence.completion, 'unknown');
  assert.equal(sparse.ratingEvidence.medianVotes, null);
  assert.equal(sparse.threeEpisodeHook, 0);
  assert.ok(sparse.retentionScore <= 52);
  const full = Stats.calculateAllStats({ episodeCount: 12, status: 'Finished Airing', episodes: Array.from({ length: 12 }, (_, i) => ({ episode: i + 1, score: 5 })) });
  assert.equal(full.ratingEvidence.limited, false);
  assert.equal(full.ratingEvidence.completion, 'finished');
  assert.ok(full.retentionScore > sparse.retentionScore);
});

test('rating evidence deduplicates, orders episodes, and distinguishes unknown positions and voters', () => {
  const stats = Stats.calculateAllStats({ episodeCount: 24, status: 'Currently Airing', episodes: [{ episode: 8, score: 4 }, { episode: 1, score: 5, votes: 2 }, { episode: 1, score: 5, votes: 2 }] });
  assert.equal(stats.ratingEvidence.ratedEpisodes, 2);
  assert.equal(stats.threeEpisodeHook, 100);
  assert.equal(stats.ratingEvidence.medianVotes, 2);
  assert.equal(stats.ratingEvidence.completion, 'airing');
  assert.equal(stats.ratingEvidence.limited, true);
  const unknown = Stats.calculateAllStats({ episodes: [{ score: 5 }] });
  assert.equal(unknown.ratingEvidence.positionsKnown, false);
  assert.equal(unknown.threeEpisodeHook, 0);
  const sparse = Stats.calculateAllStats({ episodes: [{ episode: 12, score: 5 }] });
  assert.equal(sparse.episodeCount, 12);
});

test('rating penalties vary gradually across the catalog baseline', () => {
  const profile = { p35: 4.15, p50: 4.29, p65: 4.41 };
  const strength = score => Stats.calculateRetentionScore(Array.from({ length: 12 }, (_, i) => ({ episode: i + 1, score })), profile);
  // Version 3 drops the second strictness curve, so the raw scale is wider; the per-step
  // check below is what rules out a cliff at the catalog baseline.
  assert.ok(strength(4.2) - strength(4.0) < 20);
  let previous = strength(3.8);
  for (let i = 381; i <= 440; i++) {
    const current = strength(i / 100);
    assert.ok(current >= previous && current - previous <= 3, `${i / 100}: ${previous} -> ${current}`);
    previous = current;
  }
});

test('calculateRetentionScore stays within bounds for extreme scores', () => {
  const highEpisodes = Array.from({ length: 8 }, () => ({ score: 5 }));
  const lowEpisodes = Array.from({ length: 8 }, () => ({ score: 1 }));
  const highScore = Stats.calculateRetentionScore(highEpisodes, Stats.defaultScoreProfile);
  const lowScore = Stats.calculateRetentionScore(lowEpisodes, Stats.defaultScoreProfile);

  assert.ok(Number.isFinite(highScore));
  assert.ok(Number.isFinite(lowScore));
  assert.ok(highScore >= 0 && highScore <= 100);
  assert.ok(lowScore >= 0 && lowScore <= 100);
  assert.ok(highScore > lowScore);
});

test('calculateRetentionScore is sensitive to slow-burn finishes', () => {
  const baseEpisodes = Array.from({ length: 20 }, () => ({ score: 3 }));
  const slowBurnEpisodes = Array.from({ length: 20 }, (_, index) => ({
    score: index < 10 ? 3 : 5
  }));

  const baseRetention = Stats.calculateRetentionScore(baseEpisodes, Stats.defaultScoreProfile);
  const slowRetention = Stats.calculateRetentionScore(slowBurnEpisodes, Stats.defaultScoreProfile);

  const getSignal = (episodes) => {
    const momentum = Stats.calculateMomentum(episodes);
    const momentumScore = Stats.clamp((momentum + 100) / 2, 0, 100);
    const finaleStrength = Stats.calculateFinaleStrength(episodes);
    return Stats.getSlowBurnSignal({ momentumScore, finaleStrength });
  };

  const baseSignal = getSignal(baseEpisodes);
  const slowSignal = getSignal(slowBurnEpisodes);

  assert.equal(baseSignal, 0);
  assert.ok(slowSignal > 0);
  assert.ok(slowRetention > baseRetention);
});

const flatSeries = (score, length) => Array.from({ length }, (_, i) => ({ episode: i + 1, score }));

test('a series rated 5/5 throughout reaches the top of the raw index at any length', () => {
  for (const length of [12, 24, 100]) {
    assert.equal(Stats.calculateRetentionScore(flatSeries(5, length), Stats.defaultScoreProfile), 100, `${length} episodes`);
  }
});

test('only a weaker ending costs points; a steady or rising ending keeps full credit', () => {
  const profile = { p35: 4.15, p50: 4.29, p65: 4.41 };
  const steady = flatSeries(4.6, 12);
  const rising = steady.map(ep => (ep.episode > 9 ? { ...ep, score: 4.9 } : ep));
  const falling = steady.map(ep => (ep.episode > 9 ? { ...ep, score: 4.3 } : ep));
  const raw = episodes => Stats.calculateRetentionScore(episodes, profile);
  assert.ok(raw(rising) >= raw(steady));
  assert.ok(raw(falling) < raw(steady));
});

test('catalog quantiles rank a raw index between breakpoints and across ties', () => {
  const quantiles = Array.from({ length: 101 }, (_, k) => k);
  assert.equal(Stats.rawToCatalogPercentile(42.5, quantiles), 42.5);
  assert.equal(Stats.rawToCatalogPercentile(-1, quantiles), 0);
  assert.equal(Stats.rawToCatalogPercentile(100, quantiles), 100);
  const tied = Array.from({ length: 101 }, (_, k) => (k < 40 ? k : k <= 60 ? 50 : k));
  assert.equal(Stats.rawToCatalogPercentile(50, tied), 50);
});

test('rating strength is a catalog percentile pulled toward the median by missing evidence', () => {
  const profile = { ...Stats.defaultScoreProfile, strengthQuantiles: Array.from({ length: 101 }, (_, k) => k) };
  assert.equal(Stats.calculateRatingStrength(90, 1, profile), 90);
  assert.equal(Stats.calculateRatingStrength(90, 0.5, profile), 70);
  assert.equal(Stats.calculateRatingStrength(90, 0, profile), 50);
  assert.equal(Stats.calculateRatingStrength(0, 1, profile), 1, '0 stays reserved for titles without ratings');
  assert.equal(Stats.calculateRatingStrength(73.6, 1, Stats.defaultScoreProfile), 74, 'without a table the raw index is used');
});

test('score profiles carry a strength quantile table only when it is valid', () => {
  const strengthQuantiles = Array.from({ length: 101 }, (_, k) => k);
  assert.deepEqual(Stats.resolveScoreProfile({ p35: 4, p50: 4.2, p65: 4.4, strengthQuantiles }).strengthQuantiles, strengthQuantiles);
  for (const invalid of [[1, 2, 3], strengthQuantiles.map((v, k) => (k === 50 ? 10 : v)), strengthQuantiles.map((v, k) => (k === 100 ? 101 : v))]) {
    assert.equal('strengthQuantiles' in Stats.resolveScoreProfile({ p35: 4, p50: 4.2, p65: 4.4, strengthQuantiles: invalid }), false);
  }
  const catalog = Array.from({ length: 6 }, (_, i) => ({ episodes: flatSeries(3.5 + (i * 0.25), 12) }));
  const built = Stats.buildScoreProfile(catalog);
  assert.equal(Stats.isValidStrengthQuantiles(built.strengthQuantiles), true);
  assert.equal(Stats.buildScoreProfile(catalog.slice(0, 4)).strengthQuantiles, undefined);
});

test('a raw value that rounds onto a tied breakpoint gets the tie midpoint', () => {
  const tied = Array.from({ length: 101 }, (_, k) => (k < 40 ? k : k <= 60 ? 87.34 : 87.34 + ((k - 60) * 0.3)));
  const profile = { strengthQuantiles: tied };
  assert.equal(Stats.calculateRatingStrength(87.3366, 1, profile), 50);
  assert.equal(Stats.calculateRatingStrength(87.3412, 1, profile), 50);
});
