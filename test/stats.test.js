const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../js/stats');

test('calculateAverage rounds to 2 decimals', () => {
  const episodes = [{ score: 3 }, { score: 4 }, { score: 5 }];
  assert.equal(Stats.calculateAverage(episodes), 4);
});

test('calculateStdDev returns expected value', () => {
  const episodes = [{ score: 3 }, { score: 4 }, { score: 5 }];
  assert.equal(Stats.calculateStdDev(episodes), 0.82);
});

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
