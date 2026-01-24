/**
 * Statistics module for anime scoring calculations
 */

const Stats = {
  strictnessExponent: 1.35,
  defaultScoreProfile: { p35: 3.2, p50: 3.6, p65: 4.0 },

  /**
   * Build a score profile from a list of anime (per-user catalog baseline)
   * @param {Array} animeList - Array of anime objects
   * @returns {Object} Score profile with p35/p50/p65
   */
  buildScoreProfile(animeList = []) {
    const scores = [];
    if (!Array.isArray(animeList)) {
      return this.buildScoreProfileFromScores(scores);
    }

    for (const anime of animeList) {
      const episodes = anime?.episodes;
      if (!Array.isArray(episodes)) continue;
      for (const ep of episodes) {
        const score = Number(ep?.score);
        if (Number.isFinite(score)) scores.push(score);
      }
    }

    return this.buildScoreProfileFromScores(scores);
  },

  /**
   * Build a score profile from raw scores
   * @param {Array} scores - Numeric scores
   * @returns {Object} Score profile with p35/p50/p65
   */
  buildScoreProfileFromScores(scores = []) {
    const values = Array.isArray(scores)
      ? scores.map(Number).filter(value => Number.isFinite(value))
      : [];
    const fallback = { ...this.defaultScoreProfile, sampleSize: values.length, source: 'default' };
    if (values.length < 5) {
      return fallback;
    }

    const p35 = this.calculatePercentile(values, 35);
    const p50 = this.calculatePercentile(values, 50);
    const p65 = this.calculatePercentile(values, 65);
    const round2 = (value) => Math.round(value * 100) / 100;

    return this.resolveScoreProfile({
      p35: round2(this.clamp(p35, 1, 5)),
      p50: round2(this.clamp(p50, 1, 5)),
      p65: round2(this.clamp(p65, 1, 5)),
      sampleSize: values.length,
      source: 'derived'
    });
  },

  /**
   * Calculate a percentile with linear interpolation
   * @param {Array} values - Numeric values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower];
    const weight = rank - lower;
    return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
  },

  /**
   * Normalize or fallback a score profile
   * @param {Object} profile - Score profile
   * @returns {Object} Normalized score profile
   */
  resolveScoreProfile(profile) {
    const fallback = this.defaultScoreProfile;
    if (!profile || !Number.isFinite(profile.p35) || !Number.isFinite(profile.p50) || !Number.isFinite(profile.p65)) {
      return { ...fallback };
    }
    const ordered = [
      this.clamp(profile.p35, 1, 5),
      this.clamp(profile.p50, 1, 5),
      this.clamp(profile.p65, 1, 5)
    ].sort((a, b) => a - b);

    const normalized = {
      p35: ordered[0],
      p50: ordered[1],
      p65: ordered[2]
    };

    if (Number.isFinite(profile.sampleSize)) normalized.sampleSize = profile.sampleSize;
    if (typeof profile.source === 'string') normalized.source = profile.source;

    return normalized;
  },

  /**
   * Scale early-episode penalties for longer series
   * @param {Array} episodes - Array of episode objects
   * @param {number} capLength - Episode count to cap at
   * @returns {number} Scale factor (0-1)
   */
  getEarlyPenaltyScale(episodes, capLength = 6) {
    const length = Array.isArray(episodes) ? episodes.length : 0;
    if (!length || length <= capLength) return 1;
    return this.clamp(capLength / length, 0, 1);
  },

  /**
   * Compute slow-burn signal from finale and momentum strength
   * @param {Object} values - Values object
   * @param {number} values.momentumScore - Momentum normalized to 0-100
   * @param {number} values.finaleStrength - Finale strength (0-100)
   * @returns {number} Signal strength (0-1)
   */
  getSlowBurnSignal({ momentumScore, finaleStrength } = {}) {
    if (!Number.isFinite(momentumScore) || !Number.isFinite(finaleStrength)) return 0;
    const finaleSignal = this.clamp((finaleStrength - 65) / 35, 0, 1);
    const momentumSignal = this.clamp((momentumScore - 60) / 40, 0, 1);
    return Math.max(finaleSignal, momentumSignal);
  },

  /**
   * Clamp a value between min and max
   * @param {number} value - Input value
   * @param {number} min - Minimum bound
   * @param {number} max - Maximum bound
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Apply a strictness curve to a value on a bounded scale
   * @param {number} value - Input value
   * @param {Object} options - Scale options
   * @returns {number} Strict-adjusted value
   */
  applyStrictness(value, { min = 0, max = 100, lowerIsBetter = false } = {}) {
    if (!Number.isFinite(value)) return min;
    const range = max - min || 1;
    const clamped = this.clamp(value, min, max);
    let ratio = (clamped - min) / range;
    if (lowerIsBetter) ratio = 1 - ratio;
    const adjusted = Math.pow(ratio, this.strictnessExponent);
    const strictRatio = lowerIsBetter ? 1 - adjusted : adjusted;
    return min + strictRatio * range;
  },

  /**
   * Apply strictness while preserving a neutral midpoint
   * @param {number} value - Input value
   * @param {Object} options - Scale options
   * @returns {number} Strict-adjusted value
   */
  applyCenteredStrictness(value, { min = 0, max = 100, center = 50 } = {}) {
    if (!Number.isFinite(value)) return center;
    const clamped = this.clamp(value, min, max);
    const span = Math.max(center - min, max - center) || 1;
    const normalized = this.clamp((clamped - center) / span, -1, 1);
    const adjusted = Math.sign(normalized) * Math.pow(Math.abs(normalized), this.strictnessExponent);
    return this.clamp(center + (adjusted * span), min, max);
  },

  /**
   * Normalize a 1-5 score into a 0-1 range
   * @param {number} score - Episode score
   * @returns {number} Normalized score
   */
  normalizeScore(score) {
    return this.clamp((score - 1) / 4, 0, 1);
  },

  /**
   * Convert a 1-5 score into a strict 0-100 score
   * @param {number} score - Episode score
   * @returns {number} Strict score percentage
   */
  scoreToStrictPercent(score) {
    return Math.round(this.applyStrictness(this.normalizeScore(score) * 100));
  },

  /**
   * Apply strictness to a 0-100 metric
   * @param {number} value - Metric value
   * @param {boolean} lowerIsBetter - Whether lower values are better
   * @returns {number} Strict metric value
   */
  strictPercent(value, lowerIsBetter = false) {
    return Math.round(this.applyStrictness(value, { min: 0, max: 100, lowerIsBetter }));
  },

  /**
   * Calculate the average score for an anime
   * @param {Array} episodes - Array of episode objects with score property
   * @returns {number} Average score rounded to 2 decimal places
   */
  calculateAverage(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const sum = episodes.reduce((acc, ep) => acc + ep.score, 0);
    return Math.round((sum / episodes.length) * 100) / 100;
  },

  /**
   * Calculate the standard deviation of scores
   * Lower values indicate more consistent scoring
   * @param {Array} episodes - Array of episode objects with score property
   * @returns {number} Standard deviation rounded to 2 decimal places
   */
  calculateStdDev(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const avg = this.calculateAverage(episodes);
    const squaredDiffs = episodes.map(ep => Math.pow(ep.score - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / episodes.length;
    return Math.round(Math.sqrt(avgSquaredDiff) * 100) / 100;
  },

  /**
   * Calculate the AUC (Area Under Curve) score
   * Normalized to 0-100 scale where 100 = all episodes scored 5
   * @param {Array} episodes - Array of episode objects with score property
   * @returns {number} AUC score as percentage (0-100)
   */
  calculateAUC(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const sum = episodes.reduce((acc, ep) => acc + ep.score, 0);
    const avg = sum / episodes.length;
    return this.scoreToStrictPercent(avg);
  },

  /**
   * Get consistency rating based on standard deviation
   * @param {number} stdDev - Standard deviation value
   * @returns {Object} Rating object with label and class
   */
  getConsistencyRating(stdDev) {
    if (stdDev < 0.5) {
      return { label: 'Very Consistent', class: 'consistency-high' };
    } else if (stdDev < 1.0) {
      return { label: 'Consistent', class: 'consistency-medium' };
    } else {
      return { label: 'Variable', class: 'consistency-low' };
    }
  },

  /**
   * Get color class based on average score
   * @param {number} avg - Average score
   * @returns {string} CSS class name
   */
  getScoreColorClass(avg) {
    if (avg >= 4.5) return 'score-excellent';
    if (avg >= 3.5) return 'score-good';
    if (avg >= 2.5) return 'score-average';
    return 'score-poor';
  },

  // ======================================
  // WEEKLY WATCHER ARCHETYPE METRICS
  // ======================================

  /**
   * Calculate "Consistency Score" - retention-focused reliability
   * Emphasizes strong openings (scaled for long series), safe sessions, low churn risk, and habit stability
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Consistency score (0-100)
   */
  calculateReliabilityScore(episodes, scoreProfile) {
    if (!episodes || episodes.length === 0) return 0;
    const hook = this.calculate3EpisodeHook(episodes);
    const safety = this.calculateSessionSafety(episodes, scoreProfile);
    const churnRisk = this.calculateChurnRisk(episodes, scoreProfile).score;
    const habitRiskRate = this.calculateHabitBreakRisk(episodes);

    const earlyScale = this.getEarlyPenaltyScale(episodes);
    const hookWeight = 0.35 * earlyScale;
    const remainingWeight = 1 - hookWeight;
    const otherTotal = 0.65;
    const scaleUp = otherTotal > 0 ? (remainingWeight / otherTotal) : 0;

    const maxRate = 6;
    const habitSafety = maxRate === 0
      ? 100
      : Math.round(this.clamp(1 - (Math.min(habitRiskRate, maxRate) / maxRate), 0, 1) * 100);

    const reliability = (hook * hookWeight)
      + (safety * 0.35 * scaleUp)
      + ((100 - churnRisk) * 0.2 * scaleUp)
      + (habitSafety * 0.1 * scaleUp);
    return this.strictPercent(this.clamp(reliability, 0, 100));
  },

  /**
   * Calculate "Session Safety" - probability of no bad episodes
   * Based on percentage of episodes above a percentile-based safety floor
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Session safety percentage (0-100)
   */
  calculateSessionSafety(episodes, scoreProfile) {
    if (!episodes || episodes.length === 0) return 0;
    const thresholds = this.resolveScoreProfile(scoreProfile);
    const avg = this.calculateAverage(episodes);
    const safetyFloor = this.clamp(avg - 0.4, thresholds.p35, thresholds.p65);
    const belowThreshold = episodes.filter(e => e.score < safetyFloor).length;
    const safetyRatio = 1 - (belowThreshold / episodes.length);
    const qualityRatio = this.normalizeScore(avg);
    const blended = (safetyRatio * 0.6) + (qualityRatio * 0.4);
    return this.strictPercent(blended * 100);
  },

  // ---- WEEKLY WATCHER RETENTION METRICS ----

  /**
   * Helper: Calculate median score
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Median score
   */
  calculateMedian(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const scores = episodes.map(e => e.score).sort((a, b) => a - b);
    const mid = Math.floor(scores.length / 2);
    return scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
  },

  /**
   * Calculate "3-Episode Hook" strength
   * Measures how compelling the opening is (crucial for weekly commitment)
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Hook strength (0-100)
   */
  calculate3EpisodeHook(episodes) {
    if (!episodes || episodes.length === 0) return 0;

    // Take first 3 episodes or all if less
    const hookEpisodes = episodes.slice(0, Math.min(3, episodes.length));
    const hookAvg = hookEpisodes.reduce((sum, ep) => sum + ep.score, 0) / hookEpisodes.length;

    // Normalize to 0-100 scale with strictness curve
    return this.scoreToStrictPercent(hookAvg);
  },

  /**
   * Calculate "Habit Break Risk"
   * Longest chain of consecutive episodes below series median (per 10 eps)
   * High value = more likely to break weekly watching habit
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Risk rate per 10 episodes (0-10)
   */
  calculateHabitBreakRisk(episodes) {
    if (!episodes || episodes.length < 2) return 0;

    const median = this.calculateMedian(episodes);
    let currentChain = 0;
    let maxChain = 0;

    for (const ep of episodes) {
      if (ep.score < median) {
        currentChain++;
        maxChain = Math.max(maxChain, currentChain);
      } else {
        currentChain = 0;
      }
    }

    const rate = (maxChain / episodes.length) * 10;
    return Math.round(rate * 10) / 10;
  },

  // ======================================
  // COMPLETIONIST ARCHETYPE METRICS
  // ======================================

  /**
   * Calculate "Peak Score" - the highest episode score achieved
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Highest score (0-5)
   */
  calculatePeakScore(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    return Math.max(...episodes.map(e => e.score));
  },

  /**
   * Calculate "Finale Strength" - score trajectory in final 25% of episodes
   * Completionists want shows that pay off at the end
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Finale strength (0-100, 50 = neutral)
   */
  calculateFinaleStrength(episodes) {
    if (!episodes || episodes.length < 4) {
      // For short series, compare last episode to rest
      if (!episodes || episodes.length < 2) return 50;
      const lastScore = episodes[episodes.length - 1].score;
      const restAvg = this.calculateAverage(episodes.slice(0, -1));
      const difference = lastScore - restAvg;
      const rawScore = Math.max(0, Math.min(100, 50 + (difference * 25)));
      return Math.round(this.applyCenteredStrictness(rawScore, { min: 0, max: 100, center: 50 }));
    }

    const quarterLength = Math.ceil(episodes.length / 4);
    const finalQuarter = episodes.slice(-quarterLength);
    const firstThreeQuarters = episodes.slice(0, -quarterLength);

    const finalAvg = this.calculateAverage(finalQuarter);
    const earlyAvg = this.calculateAverage(firstThreeQuarters);

    // Positive = strong finish, Negative = weak finish
    const difference = finalAvg - earlyAvg;
    // Normalize to 0-100 scale where 50 = neutral
    const rawScore = Math.max(0, Math.min(100, 50 + (difference * 25)));
    return Math.round(this.applyCenteredStrictness(rawScore, { min: 0, max: 100, center: 50 }));
  },

  /**
   * Calculate "Completion Score"
   * Combines finale payoff with momentum and narrative acceleration
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Worth finishing score (0-100)
   */
  calculateWorthFinishing(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const finaleStrength = this.calculateFinaleStrength(episodes);
    const momentum = this.calculateMomentum(episodes);
    const narrativeAcceleration = this.calculateNarrativeAcceleration(episodes);

    const momentumScore = this.clamp((momentum + 100) / 2, 0, 100);
    const accelClamp = this.clamp(narrativeAcceleration, -0.2, 0.2);
    const accelScore = ((accelClamp + 0.2) / 0.4) * 100;

    const completionScore = (finaleStrength * 0.5) + (momentumScore * 0.3) + (accelScore * 0.2);
    return this.strictPercent(this.clamp(completionScore, 0, 100));
  },

  /**
   * Count number of "Peak Episodes" (score of 5)
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Count of episodes with score 5
   */
  countPeakEpisodes(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    return episodes.filter(e => e.score === 5).length;
  },

  // ---- COMPLETIONIST RETENTION METRICS ----

  /**
   * Calculate "Momentum" score
   * Compares last 3 episodes to global average
   * Positive = building momentum, viewer likely to finish
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Momentum score (-100 to +100, 0 = neutral)
   */
  calculateMomentum(episodes) {
    if (!episodes || episodes.length < 4) return 0;

    const globalAvg = this.calculateAverage(episodes);
    const last3 = episodes.slice(-3);
    const last3Avg = last3.reduce((sum, ep) => sum + ep.score, 0) / 3;

    // Difference normalized to -100 to +100 scale
    const diff = last3Avg - globalAvg;
    return Math.round(Math.max(-100, Math.min(100, diff * 50)));
  },

  /**
   * Calculate "Narrative Acceleration"
   * Linear regression slope for second half only
   * Positive = story is building to climax
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Slope value (positive = accelerating)
   */
  calculateNarrativeAcceleration(episodes) {
    if (!episodes || episodes.length < 6) return 0;

    // Take second half of episodes only
    const midpoint = Math.floor(episodes.length / 2);
    const secondHalf = episodes.slice(midpoint);

    // Linear regression on second half
    const n = secondHalf.length;
    const sumX = secondHalf.reduce((acc, _, i) => acc + i, 0);
    const sumY = secondHalf.reduce((acc, e) => acc + e.score, 0);
    const sumXY = secondHalf.reduce((acc, e, i) => acc + (i * e.score), 0);
    const sumX2 = secondHalf.reduce((acc, _, i) => acc + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Math.round(slope * 100) / 100;
  },

  // ======================================
  // CASUAL VIEWER ARCHETYPE METRICS
  // ======================================

  /**
   * Calculate "Relaxation Score" - retention-oriented comfort
   * Emphasizes flow, emotional stability, easy entry, and low stress spikes
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Relaxation score (0-100)
   */
  calculateComfortScore(episodes) {
    if (!episodes || episodes.length === 0) return 0;
    const flowState = this.calculateFlowState(episodes);
    const emotionalStability = this.calculateEmotionalStability(episodes);
    const barrierToEntry = this.calculateBarrierToEntry(episodes);
    const stressSpikeRate = this.countStressSpikes(episodes);

    const barrierScore = 100 - this.clamp((Math.min(barrierToEntry, 2) / 2) * 100, 0, 100);
    const stressScore = 100 - this.clamp((Math.min(stressSpikeRate, 5) / 5) * 100, 0, 100);

    const comfort = (flowState * 0.4) + (emotionalStability * 0.3) + (barrierScore * 0.2) + (stressScore * 0.1);
    return this.strictPercent(this.clamp(comfort, 0, 100));
  },

  /**
   * Count "Stress Spikes" - episodes with score drops of 1.5+ from previous
   * Escapists want to avoid these (reported per 10 episodes)
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Stress spike rate per 10 episodes (0-10)
   */
  countStressSpikes(episodes) {
    if (!episodes || episodes.length < 2) return 0;
    let spikes = 0;
    for (let i = 1; i < episodes.length; i++) {
      if (episodes[i - 1].score - episodes[i].score >= 1.5) {
        spikes++;
      }
    }
    const rate = (spikes / episodes.length) * 10;
    return Math.round(rate * 10) / 10;
  },

  /**
   * Calculate "Emotional Stability" rating
   * Measures how smooth the viewing experience is
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Emotional stability score (0-100)
   */
  calculateEmotionalStability(episodes) {
    if (!episodes || episodes.length < 2) return 100;

    let totalChange = 0;
    for (let i = 1; i < episodes.length; i++) {
      totalChange += Math.abs(episodes[i].score - episodes[i - 1].score);
    }
    const avgChange = totalChange / (episodes.length - 1);

    // Lower average change = more stable (max avgChange would be 4)
    const stability = (1 - (avgChange / 4)) * 100;
    return this.strictPercent(stability);
  },

  // ---- CASUAL VIEWER RETENTION METRICS ----

  /**
   * Calculate "Barrier to Entry"
   * Standard deviation of first 5 episodes (lower = easier to get into)
   * @param {Array} episodes - Array of episode objects
   * @returns {number} StdDev of first 5 episodes (lower is better)
   */
  calculateBarrierToEntry(episodes) {
    if (!episodes || episodes.length === 0) return 0;

    const first5 = episodes.slice(0, Math.min(5, episodes.length));
    const avg = first5.reduce((sum, ep) => sum + ep.score, 0) / first5.length;
    const squaredDiffs = first5.map(ep => Math.pow(ep.score - avg, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / first5.length;

    return Math.round(Math.sqrt(variance) * 100) / 100;
  },

  /**
   * Calculate "Flow State" score
   * Inverse of sum of squared differences between adjacent episodes
   * Higher = smoother viewing experience, easier to binge
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Flow state score (0-100, higher is better)
   */
  calculateFlowState(episodes) {
    if (!episodes || episodes.length < 2) return 100;

    let sumSquaredDiffs = 0;
    for (let i = 1; i < episodes.length; i++) {
      const diff = episodes[i].score - episodes[i - 1].score;
      sumSquaredDiffs += diff * diff;
    }

    // Normalize: max possible sum would be (4^2 * (n-1)) for score swings of 1<->5
    const maxPossible = 16 * (episodes.length - 1);
    const flowRatio = 1 - (sumSquaredDiffs / maxPossible);

    return this.strictPercent(flowRatio * 100);
  },

  // ======================================
  // DEEP DIVER ARCHETYPE METRICS
  // ======================================

  /**
   * Calculate "Quality Trend" - is the show improving, declining, or stable?
   * Deep divers analyze technical quality and notice every trend
   * Uses linear regression slope
   * @param {Array} episodes - Array of episode objects
   * @returns {Object} Object with slope and direction
   */
  calculateQualityTrend(episodes) {
    if (!episodes || episodes.length < 3) return { slope: 0, direction: 'stable' };

    const n = episodes.length;
    const sumX = episodes.reduce((acc, _, i) => acc + i, 0);
    const sumY = episodes.reduce((acc, e) => acc + e.score, 0);
    const sumXY = episodes.reduce((acc, e, i) => acc + (i * e.score), 0);
    const sumX2 = episodes.reduce((acc, _, i) => acc + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const roundedSlope = Math.round(slope * 100) / 100;

    let direction = 'stable';
    if (roundedSlope > 0.05) direction = 'improving';
    else if (roundedSlope < -0.05) direction = 'declining';

    return { slope: roundedSlope, direction };
  },

  /**
   * Detect "Quality Dips" - identifies significant quality drops
   * Returns array of episodes where dips occurred
   * @param {Array} episodes - Array of episode objects
   * @returns {Array} Array of dip objects with episode info
   */
  detectQualityDips(episodes) {
    if (!episodes || episodes.length < 3) return [];
    const avg = this.calculateAverage(episodes);
    const dips = [];
    const dipThreshold = avg - 0.8;

    for (let i = 0; i < episodes.length; i++) {
      if (episodes[i].score < dipThreshold) {
        dips.push({
          episode: episodes[i].episode,
          score: episodes[i].score,
          deviation: Math.round((avg - episodes[i].score) * 100) / 100
        });
      }
    }
    return dips;
  },

  /**
   * Calculate "Production Quality Index"
   * Composite score balancing quality with retention signals
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Production quality index (0-100)
   */
  calculateProductionQualityIndex(episodes, scoreProfile) {
    if (!episodes || episodes.length === 0) return 0;

    const avg = this.calculateAverage(episodes);
    const stdDev = this.calculateStdDev(episodes);
    const trend = this.calculateQualityTrend(episodes);
    const dips = this.detectQualityDips(episodes);
    const churnRisk = this.calculateChurnRisk(episodes, scoreProfile).score;
    const hook = this.calculate3EpisodeHook(episodes);

    const avgScore = (avg / 5) * 100;
    const consistencyScore = 100 - this.clamp((Math.min(stdDev, 2) / 2) * 100, 0, 100);
    const trendClamp = this.clamp(trend.slope, -0.2, 0.2);
    const trendScore = ((trendClamp + 0.2) / 0.4) * 100;

    let pqi = (avgScore * 0.35) + (consistencyScore * 0.15) + (trendScore * 0.2) + (hook * 0.15) + ((100 - churnRisk) * 0.15);
    pqi -= dips.length * 3;

    return this.strictPercent(this.clamp(pqi, 0, 100));
  },

  /**
   * Calculate episode-by-episode rolling average for trend analysis
   * @param {Array} episodes - Array of episode objects
   * @param {number} windowSize - Size of rolling window (default 3)
   * @returns {Array} Array of rolling average data points
   */
  calculateRollingAverage(episodes, windowSize = 3) {
    if (!episodes || episodes.length < windowSize) return [];
    const rolling = [];
    for (let i = windowSize - 1; i < episodes.length; i++) {
      const window = episodes.slice(i - windowSize + 1, i + 1);
      const avg = window.reduce((acc, e) => acc + e.score, 0) / windowSize;
      rolling.push({
        episode: episodes[i].episode,
        rollingAvg: Math.round(avg * 100) / 100
      });
    }
    return rolling;
  },

  // ---- DEEP DIVER RETENTION METRICS ----

  /**
   * Calculate "Controversy Potential"
   * Shows with both very low and very high scores are "interesting"
   * High variance combined with extremes indicates discussion-worthy content
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Controversy score (0-100)
   */
  calculateControversyPotential(episodes) {
    if (!episodes || episodes.length < 3) return 0;

    const scores = episodes.map(e => e.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    // Check for extreme scores (1s and 5s)
    const hasVeryLow = scores.some(s => s <= 1.5);
    const hasVeryHigh = scores.some(s => s >= 4.5);

    let controversy = 0;

    // Base: range contributes up to 50 points
    controversy += (range / 4) * 50;

    // Bonus: presence of extremes
    if (hasVeryLow && hasVeryHigh) {
      controversy += 50; // Maximum controversy: both extremes present
    } else if (hasVeryLow || hasVeryHigh) {
      controversy += 25; // Moderate: one extreme present
    }

    return this.strictPercent(Math.min(100, controversy));
  },

  /**
   * Detect "Shark Jump" episode
   * Episode where rolling average drops permanently by >1 point
   * Returns null if no shark jump detected
   * @param {Array} episodes - Array of episode objects
   * @param {number} windowSize - Rolling average window (default 3)
   * @returns {Object|null} {episode: number, dropAmount: number} or null
   */
  detectSharkJump(episodes, windowSize = 3) {
    if (!episodes || episodes.length < windowSize * 2) return null;

    const rolling = this.calculateRollingAverage(episodes, windowSize);
    if (rolling.length < 2) return null;

    // Find largest permanent drop
    let sharkJump = null;

    for (let i = 1; i < rolling.length; i++) {
      const drop = rolling[i - 1].rollingAvg - rolling[i].rollingAvg;

      if (drop > 0.8) {
        // Check if it's permanent (doesn't recover in remaining episodes)
        const remainingAvg = rolling.slice(i).reduce((sum, r) => sum + r.rollingAvg, 0) / (rolling.length - i);
        const preDropAvg = rolling.slice(0, i).reduce((sum, r) => sum + r.rollingAvg, 0) / i;

        if (preDropAvg - remainingAvg > 0.6) {
          sharkJump = {
            episode: rolling[i].episode,
            dropAmount: Math.round(drop * 100) / 100
          };
          break; // Return first significant permanent drop
        }
      }
    }

    return sharkJump;
  },

  // ======================================
  // UNIVERSAL RETENTION METRIC
  // ======================================

  /**
   * Calculate "Churn Risk" - Probability of a viewer dropping the show
   * Based on consecutive low-quality streaks, recent dips, and baseline quality
   * @param {Array} episodes - Array of episode objects
   * @param {Object} scoreProfile - Percentile thresholds for the viewer baseline
   * @returns {Object} {score: 0-100, label: string, factors: string[]}
   */
  calculateChurnRisk(episodes, scoreProfile) {
    if (!episodes || episodes.length === 0) {
      return { score: 0, label: 'Unknown', factors: [] };
    }

    const thresholds = this.resolveScoreProfile(scoreProfile);
    let riskScore = 0;
    const factors = [];
    const avgScore = this.calculateAverage(episodes);

    // FACTOR 1: The "Slump" (Consecutive episodes below threshold)
    const globalAvg = avgScore;
    const dropThreshold = this.clamp(globalAvg - 0.4, thresholds.p35, thresholds.p65);

    let currentSlump = 0;
    let maxSlump = 0;

    for (const ep of episodes) {
      if (ep.score <= dropThreshold) {
        currentSlump++;
      } else {
        maxSlump = Math.max(maxSlump, currentSlump);
        currentSlump = 0;
      }
    }
    maxSlump = Math.max(maxSlump, currentSlump); // Check end of array

    if (maxSlump >= 3) {
      riskScore += 50; // 3 bad eps in a row is a "habit breaker"
      factors.push(`Quality slump (${maxSlump} consecutive weak episodes)`);
    } else if (maxSlump >= 2) {
      riskScore += 25;
      factors.push('Minor slump (2 consecutive weak episodes)');
    }

    // FACTOR 2: Recent Trend (Are they leaving on a low note?)
    if (episodes.length > 1) {
      const lastEp = episodes[episodes.length - 1];
      const secondLastEp = episodes[episodes.length - 2];
      if (lastEp.score < thresholds.p35 && secondLastEp.score < thresholds.p35) {
        riskScore += 30;
        factors.push('Poor recent episodes (last 2 below p35 baseline)');
      }
    }

    // FACTOR 3: Baseline quality penalty (stricter overall)
    const avgPenalty = (1 - this.normalizeScore(avgScore)) * 35;
    if (avgPenalty > 0) {
      riskScore += Math.round(avgPenalty);
      factors.push('Overall quality below peak baseline');
    }

    // Cap at 100
    const finalRisk = Math.min(100, riskScore);
    const strictRisk = this.strictPercent(finalRisk, true);

    let label = 'Low Risk';
    if (strictRisk > 75) label = 'Critical Drop-off Risk';
    else if (strictRisk > 45) label = 'High Risk';
    else if (strictRisk > 20) label = 'Moderate Risk';

    return {
      score: strictRisk,
      label: label,
      factors: factors
    };
  },

  // ======================================
  // BEGINNER-FRIENDLY RETENTION METRIC
  // ======================================

  /**
   * Calculate "Retention Score" - retention-based single metric
   * Blends strong openings, low drop-off risk, momentum, and steady pacing
   * Opening weight scales down for longer series; strong finishes soften early penalties
   * @param {Array} episodes - Array of episode objects
   * @returns {number} Retention score (0-100)
   */
  calculateRetentionScore(episodes, scoreProfile) {
    if (!episodes || episodes.length === 0) return 0;

    const hook = this.calculate3EpisodeHook(episodes);
    const churnRisk = this.calculateChurnRisk(episodes, scoreProfile).score;
    const dropSafety = 100 - churnRisk;
    const momentum = this.calculateMomentum(episodes);
    const momentumScore = this.clamp((momentum + 100) / 2, 0, 100);
    const flowState = this.calculateFlowState(episodes);
    const finaleStrength = this.calculateFinaleStrength(episodes);

    const baseEarlyScale = this.getEarlyPenaltyScale(episodes);
    const slowBurnSignal = this.getSlowBurnSignal({ momentumScore, finaleStrength });
    const slowBurnLift = slowBurnSignal * 0.35;
    const earlyScale = this.clamp(baseEarlyScale + ((1 - baseEarlyScale) * slowBurnLift), 0, 1);

    const hookWeight = 0.35 * earlyScale;
    const remainingWeight = 1 - hookWeight;
    const otherTotal = 0.65;
    const scaleUp = otherTotal > 0 ? (remainingWeight / otherTotal) : 0;

    const blended = (hook * hookWeight)
      + (dropSafety * 0.3 * scaleUp)
      + (momentumScore * 0.2 * scaleUp)
      + (flowState * 0.15 * scaleUp);

    return this.strictPercent(this.clamp(blended, 0, 100));
  },

  /**
   * Calculate all statistics for an anime
   * @param {Object} anime - Anime object with episodes array
   * @returns {Object} Object containing all calculated statistics
   */
  calculateAllStats(anime, scoreProfile) {
    const episodes = anime.episodes || [];
    const profile = this.resolveScoreProfile(scoreProfile);
    const avg = this.calculateAverage(episodes);
    const stdDev = this.calculateStdDev(episodes);
    const auc = this.calculateAUC(episodes);
    const consistency = this.getConsistencyRating(stdDev);
    const scoreClass = this.getScoreColorClass(avg);
    const retentionScore = this.calculateRetentionScore(episodes, profile);
    const momentum = this.calculateMomentum(episodes);
    const momentumScore = this.clamp((momentum + 100) / 2, 0, 100);
    const finaleStrength = this.calculateFinaleStrength(episodes);
    const slowBurnSignal = this.getSlowBurnSignal({ momentumScore, finaleStrength });
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;

    return {
      // Core metrics
      average: avg,
      stdDev: stdDev,
      auc: auc,
      consistency: consistency,
      scoreClass: scoreClass,
      episodeCount: episodes.length,
      highestScore: episodes.length > 0 ? Math.max(...episodes.map(e => e.score)) : 0,
      lowestScore: episodes.length > 0 ? Math.min(...episodes.map(e => e.score)) : 0,
      retentionScore: retentionScore,
      malSatisfactionScore: malSatisfactionScore,

      // Weekly Watcher archetype metrics
      reliabilityScore: this.calculateReliabilityScore(episodes, profile),
      sessionSafety: this.calculateSessionSafety(episodes, profile),

      // Weekly Watcher retention metrics
      threeEpisodeHook: this.calculate3EpisodeHook(episodes),
      habitBreakRisk: this.calculateHabitBreakRisk(episodes),

      // Completionist archetype metrics
      peakScore: this.calculatePeakScore(episodes),
      finaleStrength: finaleStrength,
      worthFinishing: this.calculateWorthFinishing(episodes),
      peakEpisodeCount: this.countPeakEpisodes(episodes),

      // Completionist retention metrics
      momentum: momentum,
      narrativeAcceleration: this.calculateNarrativeAcceleration(episodes),

      // Casual Viewer archetype metrics
      comfortScore: this.calculateComfortScore(episodes),
      stressSpikes: this.countStressSpikes(episodes),
      emotionalStability: this.calculateEmotionalStability(episodes),

      // Casual Viewer retention metrics
      barrierToEntry: this.calculateBarrierToEntry(episodes),
      flowState: this.calculateFlowState(episodes),

      // Deep Diver archetype metrics
      qualityTrend: this.calculateQualityTrend(episodes),
      qualityDips: this.detectQualityDips(episodes),
      productionQualityIndex: this.calculateProductionQualityIndex(episodes, profile),
      rollingAverage: this.calculateRollingAverage(episodes),

      // Deep Diver retention metrics
      controversyPotential: this.calculateControversyPotential(episodes),
      sharkJump: this.detectSharkJump(episodes),

      // Universal retention metric
      churnRisk: this.calculateChurnRisk(episodes, profile),

      // Slow-burn indicator
      slowBurn: {
        signal: Math.round(slowBurnSignal * 100) / 100,
        isActive: slowBurnSignal > 0,
        momentumScore: Math.round(momentumScore),
        finaleStrength: Math.round(finaleStrength)
      }
    };
  },

  /**
   * Rank anime by a specific metric
   * @param {Array} animeList - Array of anime objects with stats
   * @param {string} metric - Metric to sort by
   * @returns {Array} Sorted array of anime
   */
  rankAnime(animeList, metric = 'average') {
    const sorted = [...animeList];

    switch (metric) {
      // Core metrics
      case 'average':
        sorted.sort((a, b) => b.stats.average - a.stats.average);
        break;
      case 'auc':
        sorted.sort((a, b) => b.stats.auc - a.stats.auc);
        break;
      case 'consistency':
        // Lower stdDev = more consistent = higher rank
        sorted.sort((a, b) => a.stats.stdDev - b.stats.stdDev);
        break;
      case 'retention':
        sorted.sort((a, b) => b.stats.retentionScore - a.stats.retentionScore);
        break;
      case 'satisfaction':
        sorted.sort((a, b) => (b.stats.malSatisfactionScore || 0) - (a.stats.malSatisfactionScore || 0));
        break;

      // Weekly Watcher archetype sorts
      case 'reliability':
        sorted.sort((a, b) => b.stats.reliabilityScore - a.stats.reliabilityScore);
        break;
      case 'sessionSafety':
        sorted.sort((a, b) => b.stats.sessionSafety - a.stats.sessionSafety);
        break;

      // Completionist archetype sorts
      case 'peakEpisodes':
        sorted.sort((a, b) => b.stats.peakEpisodeCount - a.stats.peakEpisodeCount);
        break;
      case 'finaleStrength':
        sorted.sort((a, b) => b.stats.finaleStrength - a.stats.finaleStrength);
        break;
      case 'worthFinishing':
        sorted.sort((a, b) => b.stats.worthFinishing - a.stats.worthFinishing);
        break;

      // Casual Viewer archetype sorts
      case 'comfort':
        sorted.sort((a, b) => b.stats.comfortScore - a.stats.comfortScore);
        break;
      case 'emotionalStability':
        sorted.sort((a, b) => b.stats.emotionalStability - a.stats.emotionalStability);
        break;
      case 'stressSpikes':
        // Lower = better (fewer stress spikes)
        sorted.sort((a, b) => a.stats.stressSpikes - b.stats.stressSpikes);
        break;

      // Deep Diver archetype sorts
      case 'productionQuality':
        sorted.sort((a, b) => b.stats.productionQualityIndex - a.stats.productionQualityIndex);
        break;
      case 'improving':
        sorted.sort((a, b) => b.stats.qualityTrend.slope - a.stats.qualityTrend.slope);
        break;
      case 'qualityDips':
        // Lower = better (fewer dips)
        sorted.sort((a, b) => a.stats.qualityDips.length - b.stats.qualityDips.length);
        break;

      // ---- RETENTION METRIC SORTS ----

      // Universal retention
      case 'churnRisk':
        // Lower = better (less risk)
        sorted.sort((a, b) => a.stats.churnRisk.score - b.stats.churnRisk.score);
        break;

      // Weekly Watcher retention
      case 'threeEpisodeHook':
        sorted.sort((a, b) => b.stats.threeEpisodeHook - a.stats.threeEpisodeHook);
        break;
      case 'habitBreakRisk':
        // Lower = better (shorter chain)
        sorted.sort((a, b) => a.stats.habitBreakRisk - b.stats.habitBreakRisk);
        break;

      // Completionist retention
      case 'momentum':
        sorted.sort((a, b) => b.stats.momentum - a.stats.momentum);
        break;
      case 'narrativeAcceleration':
        sorted.sort((a, b) => b.stats.narrativeAcceleration - a.stats.narrativeAcceleration);
        break;

      // Casual Viewer retention
      case 'barrierToEntry':
        // Lower = better (easier to start)
        sorted.sort((a, b) => a.stats.barrierToEntry - b.stats.barrierToEntry);
        break;
      case 'flowState':
        sorted.sort((a, b) => b.stats.flowState - a.stats.flowState);
        break;

      // Deep Diver retention
      case 'controversyPotential':
        // Lower controversy = better (more consensus)
        sorted.sort((a, b) => a.stats.controversyPotential - b.stats.controversyPotential);
        break;
      case 'sharkJump':
        // Shows without shark jump ranked higher, then by later episode number
        sorted.sort((a, b) => {
          const aJump = a.stats.sharkJump?.episode ?? Infinity;
          const bJump = b.stats.sharkJump?.episode ?? Infinity;
          return bJump - aJump; // Later/no shark jump is better
        });
        break;

      default:
        sorted.sort((a, b) => b.stats.average - a.stats.average);
    }

    return sorted;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Stats;
}
