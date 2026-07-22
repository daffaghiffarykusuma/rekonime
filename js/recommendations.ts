// @ts-nocheck
import { CacheManager } from './services/cache-manager.ts';

/**
 * Recommendations module for beginner-friendly anime suggestions
 */

const Recommendations = {
  selectTopByScore(animeList, limit, scorer, { minScore = Number.NEGATIVE_INFINITY } = {}) {
    if (!Array.isArray(animeList) || animeList.length === 0) return [];
    const top = [];
    const maxItems = Math.max(1, limit);

    for (let i = 0; i < animeList.length; i += 1) {
      const anime = animeList[i];
      const score = scorer(anime);
      if (!Number.isFinite(score) || score < minScore) continue;

      if (top.length < maxItems) {
        top.push({ anime, score });
        if (top.length === maxItems) {
          top.sort((a, b) => b.score - a.score);
        }
        continue;
      }

      if (score <= top[top.length - 1].score) continue;
      top[top.length - 1] = { anime, score };
      top.sort((a, b) => b.score - a.score);
    }

    return top.sort((a, b) => b.score - a.score);
  },

  /**
   * Get recommended anime based on finish likelihood with a satisfaction nudge (MAL)
   * @param {Array} animeList - Array of anime objects with stats
   * @param {number} limit - Maximum number of recommendations
   * @returns {Array} Array of recommended anime with reasons
   */
  getRecommendations(animeList, limit = 5) {
    if (!animeList || animeList.length === 0) return [];

    const top = this.selectTopByScore(animeList, limit, anime => this.scoreAnime(anime));
    return top.map(entry => ({
      ...entry.anime,
      reason: this.getRecommendationReason(entry.anime)
    }));
  },

  getIntentDefinition(intentKey) {
    const definitions = {
      unwind: {
        reason: 'A gentler pick for an easy viewing session',
        score: anime => {
          const stats = anime?.stats || {};
          return ((stats.comfortScore ?? 50) * 0.35) +
            ((stats.emotionalStability ?? 50) * 0.25) +
            ((stats.retentionScore ?? 0) * 0.25) +
            ((100 - (stats.threeEpisodeHook ?? 50)) * 0.15);
        }
      },
      energy: {
        reason: 'Strong momentum for a higher-energy watch',
        score: anime => {
          const stats = anime?.stats || {};
          return ((stats.threeEpisodeHook ?? 0) * 0.45) +
            ((stats.flowState ?? 0) * 0.4) +
            ((stats.retentionScore ?? 0) * 0.15);
        }
      },
      emotional: {
        reason: 'A character-led story with emotional payoff',
        score: anime => {
          const stats = anime?.stats || {};
          const tags = this.normalizeTagSet([...(anime?.genres || []), ...(anime?.themes || [])]);
          const tagBoost = ['Drama', 'Romance', 'Music', 'Performing Arts']
            .some(tag => tags.has(tag)) ? 15 : 0;
          return ((stats.worthFinishing ?? 0) * 0.45) +
            ((anime?.communityScore ?? 0) * 3) +
            ((stats.retentionScore ?? 0) * 0.25) +
            tagBoost;
        }
      },
      immersive: {
        reason: 'A world-rich pick built for getting absorbed',
        score: anime => {
          const stats = anime?.stats || {};
          const tags = this.normalizeTagSet([...(anime?.genres || []), ...(anime?.themes || [])]);
          const tagBoost = ['Fantasy', 'Adventure', 'Sci-Fi', 'Isekai', 'Mythology', 'Space']
            .filter(tag => tags.has(tag)).length * 8;
          return ((stats.flowState ?? 0) * 0.35) +
            ((stats.worthFinishing ?? 0) * 0.25) +
            ((stats.retentionScore ?? 0) * 0.2) +
            tagBoost;
        }
      },
      surprise: {
        reason: 'A qualified pick beyond the most obvious choices',
        score: anime => {
          const quality = this.scoreAnime(anime);
          const id = String(anime?.id || anime?.title || '');
          const diversity = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 20;
          return quality + diversity;
        }
      }
    };
    return definitions[intentKey] || null;
  },

  getRecommendationsForIntent(animeList, intentKey, {
    limit = 4,
    modeKey = this.currentMode
  } = {}) {
    if (!Array.isArray(animeList) || animeList.length === 0) return [];
    const intent = this.getIntentDefinition(intentKey);
    if (!intent) return this.getRecommendationsWithMode(animeList, modeKey, limit);

    const top = this.selectTopByScore(
      animeList,
      limit,
      anime => (intent.score(anime) * 0.7) +
        (this.scoreAnimeWithMode(anime, modeKey) * 0.3) +
        ((Number.isFinite(anime?.tasteScore) ? anime.tasteScore : 0) * 1.4),
      { minScore: 0.0001 }
    );

    return top.map(entry => ({
      ...entry.anime,
      reason: intent.reason,
      experienceCues: this.getExperienceCues(entry.anime, intentKey)
    }));
  },

  getExperienceCues(anime, intentKey = '') {
    const stats = anime?.stats || {};
    const tags = this.normalizeTagSet([...(anime?.genres || []), ...(anime?.themes || [])]);
    const candidates = [];
    const add = (label, score) => candidates.push({ label, score });

    if ((stats.comfortScore ?? 0) >= 75 || tags.has('Iyashikei')) add('Gentle', intentKey === 'unwind' ? 120 : 80);
    if ((stats.threeEpisodeHook ?? 0) >= 82) add('Fast hook', intentKey === 'energy' ? 110 : 82);
    if ((stats.flowState ?? 0) >= 85) add('High energy', intentKey === 'energy' ? 120 : 85);
    if ((stats.worthFinishing ?? 0) >= 78 || tags.has('Drama')) add('Emotional', intentKey === 'emotional' ? 120 : 78);
    if (['Fantasy', 'Adventure', 'Sci-Fi', 'Isekai', 'Space'].some(tag => tags.has(tag))) {
      add('Immersive', intentKey === 'immersive' ? 120 : 76);
    }
    if ((stats.threeEpisodeHook ?? 100) <= 65 && (stats.worthFinishing ?? 0) >= 72) add('Slow burn', 75);
    if (['Horror', 'Gore', 'Psychological', 'Suspense'].some(tag => tags.has(tag))) add('Dark', 95);
    if (['Psychological', 'Strategy Game', 'Time Travel'].some(tag => tags.has(tag))) add('Complex', 88);

    if ((stats.retentionScore ?? 0) >= 78) add('Easy to finish', 72);
    if ((stats.worthFinishing ?? 0) >= 75) add('Strong payoff', intentKey === 'emotional' ? 105 : 70);
    if ((anime?.communityScore ?? 0) >= 8.1) add('Viewer favorite', 68);

    const cues = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(candidate => candidate.label);
    return cues.length > 0 ? cues : ['Experience data is limited'];
  },

  /**
   * Get similar anime based on shared genres + themes and score alignment
   * @param {Array} animeList - Array of anime objects
   * @param {Object} currentAnime - The anime being viewed
   * @param {number} limit - Maximum number of results
   * @returns {Array} Array of similarity results
   */
  getSimilarAnime(animeList, currentAnime, limit = 6) {
    if (!animeList || !currentAnime) return [];

    const baseGenres = this.normalizeTagSet(currentAnime.genres);
    const baseThemes = this.normalizeTagSet(currentAnime.themes);

    if (baseGenres.size === 0 || baseThemes.size === 0) {
      return [];
    }

    const baseRetention = this.getRetentionScore(currentAnime);
    const baseSatisfaction = this.getMalScore(currentAnime);
    const minSharedGenres = baseGenres.size >= 2 ? 2 : 1;

    const strictMatches = [];
    const relaxedMatches = [];

    animeList
      .filter(anime => anime && anime.id !== currentAnime.id)
      .forEach(anime => {
        const sharedGenres = this.getSharedTags(baseGenres, anime.genres);
        const sharedThemes = this.getSharedTags(baseThemes, anime.themes);

        if (sharedGenres.length === 0 || sharedThemes.length === 0) {
          return;
        }

        const candidateGenres = this.normalizeTagSet(anime.genres);
        const candidateThemes = this.normalizeTagSet(anime.themes);

        const similarityScore = this.computeSimilarityScore(
          baseGenres,
          candidateGenres,
          baseThemes,
          candidateThemes
        );

        const retentionAlignment = this.computeAlignmentScore(
          baseRetention,
          this.getRetentionScore(anime),
          100
        );
        const satisfactionAlignment = this.computeAlignmentScore(
          baseSatisfaction,
          this.getMalScore(anime),
          10
        );
        const alignmentScore = this.combineAlignmentScores(
          retentionAlignment,
          satisfactionAlignment
        );

        const compositeScore = (similarityScore * 0.6) + (alignmentScore * 0.4);

        const entry = {
          anime,
          sharedGenres,
          sharedThemes,
          retentionAlignment,
          satisfactionAlignment,
          similarityScore,
          score: compositeScore
        };

        if (sharedGenres.length >= minSharedGenres) {
          strictMatches.push(entry);
        } else {
          relaxedMatches.push(entry);
        }
      });

    const byScore = (a, b) => b.score - a.score;
    strictMatches.sort(byScore);
    relaxedMatches.sort(byScore);

    return strictMatches.concat(relaxedMatches).slice(0, limit);
  },

  /**
   * Score anime for recommendations
   * @param {Object} anime - Anime object with stats
   * @returns {number} Composite score
   */
  scoreAnime(anime) {
    const retentionScore = anime?.stats?.retentionScore ?? 0;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;
    const malSatisfactionScaled = malSatisfactionScore * 10;
    return (retentionScore * 0.75) + (malSatisfactionScaled * 0.25);
  },

  getEpisodeCount(anime) {
    const directCount = [
      anime?.episodeCount,
      anime?.episodesCount,
      anime?.episodes_count,
      anime?.metadata?.episodeCount,
      anime?.metadata?.episodesCount,
      anime?.metadata?.episodes_count
    ].reduce((max, candidate) => {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) && parsed > 0 ? Math.max(max, Math.floor(parsed)) : max;
    }, 0);
    const listCount = Array.isArray(anime?.episodes)
      ? anime.episodes.reduce((max, episode, index) => {
        const parsed = Number(episode?.episode);
        const fallback = index + 1;
        const count = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        return Math.max(max, Math.floor(count));
      }, 0)
      : 0;
    const statsCount = Number.isFinite(anime?.stats?.episodeCount) ? anime.stats.episodeCount : 0;
    return Math.max(directCount, listCount, statsCount);
  },

  /**
   * Generate a simple recommendation reason
   * @param {Object} anime - Anime object with stats
   * @returns {string} Reason string
   */
  getRecommendationReason(anime) {
    const reasons = [];
    const retentionScore = Number.isFinite(anime?.stats?.retentionScore) ? anime.stats.retentionScore : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = this.getEpisodeCount(anime) > 0;
    const churnRiskScore = Number.isFinite(anime?.stats?.churnRisk?.score) ? anime.stats.churnRisk.score : null;
    const hookScore = Number.isFinite(anime?.stats?.threeEpisodeHook) ? anime.stats.threeEpisodeHook : null;
    const finishScore = Number.isFinite(anime?.stats?.worthFinishing) ? anime.stats.worthFinishing : null;
    const flowScore = Number.isFinite(anime?.stats?.flowState) ? anime.stats.flowState : null;

    if (!hasEpisodes) {
      if (malSatisfactionScore !== null && malSatisfactionScore >= 8.1) {
        return 'A clear community favorite';
      }
      return 'Fresh listing with more data coming soon';
    }

    if (retentionScore !== null && retentionScore >= 85) reasons.push('Easy to keep watching');
    if (churnRiskScore !== null && churnRiskScore <= 25) reasons.push('Strong finish potential');
    if (hookScore !== null && hookScore >= 80) reasons.push('Grabs you quickly');
    if (finishScore !== null && finishScore >= 70) reasons.push('Pays off by the ending');
    if (flowScore !== null && flowScore >= 85) reasons.push('Great episode-to-episode momentum');
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.1) reasons.push('Widely praised by viewers');

    if (reasons.length === 0) {
      return 'A dependable next watch';
    }

    return reasons.slice(0, 2).join(' + ');
  },

  /**
   * Get ranking titles for the homepage spotlight cards
   * @returns {Object} Title and metric keys
   */
  getRankingTitles() {
    return {
      title1: 'Highest Finish Confidence',
      title2: 'Most Loved by Viewers',
      metric1: 'retention',
      metric2: 'satisfaction'
    };
  },

  /**
   * Get sort options for the catalog
   * @returns {Array} Sort option objects
   */
  getSortOptions() {
    return [
      { value: 'taste', label: 'Best fit for your taste' },
      { value: 'retention', label: 'Best chance you will finish' },
      { value: 'satisfaction', label: 'Highest community rating' }
    ];
  },

  /**
   * Get badges for an anime card
   * @param {Object} anime - Anime object with stats
   * @returns {Array} Badge objects
   */
  getBadges(anime) {
    const badges = [];
    const retentionScore = Number.isFinite(anime?.stats?.retentionScore) ? anime.stats.retentionScore : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = this.getEpisodeCount(anime) > 0;
    const hookScore = Number.isFinite(anime?.stats?.threeEpisodeHook) ? anime.stats.threeEpisodeHook : null;

    if (hasEpisodes && retentionScore !== null && retentionScore >= 85) {
      badges.push({ label: 'Hard to stop watching', class: 'badge-retention' });
    }
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.5) {
      badges.push({ label: 'Viewer favorite', class: 'badge-satisfaction' });
    }
    if (hasEpisodes && hookScore !== null && hookScore >= 80) {
      badges.push({ label: 'Strong opening episodes', class: 'badge-strong-start' });
    }
    if (hasEpisodes && retentionScore !== null && retentionScore >= 80 && (malSatisfactionScore === null || malSatisfactionScore < 7.2)) {
      badges.push({ label: 'Underrated standout', class: 'badge-hidden-gem' });
    }

    return badges.slice(0, 2);
  },

  /**
   * Get stats for card display
   * @param {Object} anime - Anime object with stats
   * @returns {Array} Stat objects
   */
  getCardStats(anime) {
    const episodeCount = this.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const retentionScore = hasEpisodes && Number.isFinite(anime?.stats?.retentionScore)
      ? Math.round(anime.stats.retentionScore)
      : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;

    return [
      {
        label: 'Finish Confidence',
        value: retentionScore !== null ? retentionScore : 'N/A',
        suffix: retentionScore !== null ? '%' : '',
        class: this.getRetentionClass(retentionScore),
        tooltip: {
          title: 'Finish Confidence',
          text: 'An estimate of how reliably a show may keep viewers watching all the way through.'
        }
      },
      {
        label: 'Community Score',
        value: malSatisfactionScore !== null ? malSatisfactionScore.toFixed(1) : 'N/A',
        suffix: malSatisfactionScore !== null ? '/10' : '',
        class: this.getMalSatisfactionClass(malSatisfactionScore),
        tooltip: {
          title: 'Community Score',
          text: 'Audience rating from MyAnimeList.'
        }
      },
      {
        label: 'Episodes',
        value: episodeCount || 'N/A',
        suffix: '',
        class: '',
        tooltip: null
      }
    ];
  },

  /**
   * Normalize tag lists into a set of clean labels
   * @param {Array} tags - Raw tag list
   * @returns {Set} Unique tag labels
   */
  normalizeTagSet(tags) {
    if (!Array.isArray(tags)) return new Set();
    const set = new Set();
    tags.forEach(tag => {
      const label = String(tag || '').trim();
      if (label) {
        set.add(label);
      }
    });
    return set;
  },

  /**
   * Get shared tags between the base set and a candidate list
   * @param {Set} baseSet - Base tag set
   * @param {Array} candidateTags - Candidate tag list
   * @returns {Array} Shared tag labels
   */
  getSharedTags(baseSet, candidateTags) {
    if (!baseSet || baseSet.size === 0 || !Array.isArray(candidateTags)) return [];
    const seen = new Set();
    const shared = [];
    candidateTags.forEach(tag => {
      const label = String(tag || '').trim();
      if (!label || !baseSet.has(label) || seen.has(label)) return;
      seen.add(label);
      shared.push(label);
    });
    return shared;
  },

  /**
   * Get finish-rate source score if available
   * @param {Object} anime - Anime object
   * @returns {number|null} Finish-rate source score
   */
  getRetentionScore(anime) {
    const hasEpisodes = this.getEpisodeCount(anime) > 0;
    if (!hasEpisodes) return null;
    const score = anime?.stats?.retentionScore;
    return Number.isFinite(score) ? score : null;
  },

  /**
   * Get satisfaction (MAL) score if available
   * @param {Object} anime - Anime object
   * @returns {number|null} MAL score
   */
  getMalScore(anime) {
    const score = anime?.communityScore;
    return Number.isFinite(score) ? score : null;
  },

  /**
   * Compute alignment between two scores on a fixed scale
   * @param {number|null} base - Base score
   * @param {number|null} candidate - Candidate score
   * @param {number} max - Max scale value
   * @returns {number|null} Alignment score
   */
  computeAlignmentScore(base, candidate, max) {
    if (!Number.isFinite(base) || !Number.isFinite(candidate) || !Number.isFinite(max) || max <= 0) {
      return null;
    }
    const delta = Math.abs(base - candidate);
    const clamped = Math.min(delta, max);
    return 1 - (clamped / max);
  },

  /**
   * Combine retention and satisfaction alignment into a single score
   * @param {number|null} retentionAlignment - Alignment score for retention
   * @param {number|null} satisfactionAlignment - Alignment score for satisfaction
   * @returns {number} Combined alignment score
   */
  combineAlignmentScores(retentionAlignment, satisfactionAlignment) {
    let score = 0;
    let weight = 0;
    if (Number.isFinite(retentionAlignment)) {
      score += retentionAlignment * 0.6;
      weight += 0.6;
    }
    if (Number.isFinite(satisfactionAlignment)) {
      score += satisfactionAlignment * 0.4;
      weight += 0.4;
    }
    if (weight === 0) return 0;
    return score / weight;
  },

  /**
   * Compute similarity score based on shared tag coverage
   * @param {number} baseGenreCount - Number of base genres
   * @param {number} baseThemeCount - Number of base themes
   * @param {number} sharedGenreCount - Number of shared genres
   * @param {number} sharedThemeCount - Number of shared themes
   * @returns {number} Similarity score
   */
  computeSimilarityScore(baseGenres, candidateGenres, baseThemes, candidateThemes) {
    const genreScore = this.computeJaccardScore(baseGenres, candidateGenres);
    const themeScore = this.computeJaccardScore(baseThemes, candidateThemes);
    return (genreScore + themeScore) / 2;
  },

  /**
   * Compute Jaccard similarity score between two tag sets
   * @param {Set} baseSet - Base tag set
   * @param {Set} candidateSet - Candidate tag set
   * @returns {number} Similarity score
   */
  computeJaccardScore(baseSet, candidateSet) {
    if (!baseSet || !candidateSet || baseSet.size === 0 || candidateSet.size === 0) {
      return 0;
    }
    let intersection = 0;
    baseSet.forEach(tag => {
      if (candidateSet.has(tag)) {
        intersection += 1;
      }
    });
    const union = baseSet.size + candidateSet.size - intersection;
    if (union === 0) return 0;
    return intersection / union;
  },

  /**
   * Map finish-rate score to CSS class
   * @param {number|null} value - Finish-rate score
   * @returns {string} CSS class name
   */
  getRetentionClass(value) {
    if (value === null || !Number.isFinite(value)) return '';
    if (value >= 85) return 'score-high';
    if (value >= 70) return 'score-mid';
    if (value >= 55) return 'score-low';
    return 'score-poor';
  },

  /**
   * Map Satisfaction (MAL) score to CSS class
   * @param {number|null} value - Satisfaction score
   * @returns {string} CSS class name
   */
  getMalSatisfactionClass(value) {
    if (value === null || !Number.isFinite(value)) return '';
    if (value >= 8.5) return 'score-high';
    if (value >= 7.5) return 'score-mid';
    if (value >= 6.5) return 'score-low';
    return 'score-poor';
  },

  // ==========================================
  // Recommendation Modes (Gap C4)
  // ==========================================

  /**
   * Available recommendation modes
   */
  modes: {
    balanced: {
      label: 'Balanced',
      description: 'Strong finishability with broad audience approval',
      icon: '⚖️',
      weights: { retention: 0.75, satisfaction: 0.25 }
    },
    binge: {
      label: 'Binge Mode',
      description: 'Fast hooks and momentum that keep you going',
      icon: '🔥',
      weights: { retention: 0.9, satisfaction: 0.1 },
      boosters: ['flowState', 'threeEpisodeHook']
    },
    quality: {
      label: 'Critical Acclaim',
      description: 'Led by top audience scores',
      icon: '⭐',
      weights: { retention: 0.3, satisfaction: 0.7 }
    },
    discovery: {
      label: 'Hidden Gems',
      description: 'Excellent staying power with less mainstream attention',
      icon: '💎',
      weights: { retention: 0.8, satisfaction: 0.2 },
      filter: (anime) => (anime.communityScore || 0) < 7.8
    },
    comfort: {
      label: 'Comfort Shows',
      description: 'Relaxed picks that are easy to settle into',
      icon: '😌',
      weights: { retention: 0.6, satisfaction: 0.4 },
      boosters: ['comfortScore'],
      filter: (anime) => (anime.stats?.comfortScore || 0) > 70
    }
  },

  currentMode: 'balanced',

  getCache() {
    return CacheManager;
  },

  /**
   * Set recommendation mode
   */
  setMode(modeKey) {
    if (this.modes[modeKey]) {
      this.currentMode = modeKey;
      // Persist preference
      const cache = this.getCache();
      cache.setJSON('rekonime.recMode', modeKey, { validate: true });
      return true;
    }
    return false;
  },

  /**
   * Load saved mode preference
   */
  loadModePreference() {
    const cache = this.getCache();
    const saved = cache.getJSON('rekonime.recMode', { fallback: '', validate: true });
    if (saved && this.modes[saved]) {
      this.currentMode = saved;
    }
  },

  /**
   * Get current mode
   */
  getCurrentMode() {
    return this.modes[this.currentMode];
  },

  /**
   * Enhanced recommendation scoring with mode support
   */
  scoreAnimeWithMode(anime, modeKey = this.currentMode) {
    const mode = this.modes[modeKey];
    if (!mode) return this.scoreAnime(anime);

    // Apply mode filter if exists
    if (mode.filter && !mode.filter(anime)) {
      return 0;
    }

    const retentionScore = anime?.stats?.retentionScore ?? 0;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;
    const malSatisfactionScaled = malSatisfactionScore * 10;

    // Base score from weights
    let score = (retentionScore * mode.weights.retention) +
      (malSatisfactionScaled * mode.weights.satisfaction);
    score += (Number.isFinite(anime?.tasteScore) ? anime.tasteScore : 0) * 2;

    // Apply boosters
    if (mode.boosters) {
      mode.boosters.forEach(booster => {
        const boosterValue = anime?.stats?.[booster];
        if (Number.isFinite(boosterValue)) {
          score += boosterValue * 0.1; // 10% boost
        }
      });
    }

    return score;
  },

  /**
   * Get recommendations with mode
   */
  getRecommendationsWithMode(animeList, modeKey = this.currentMode, limit = 6) {
    const mode = this.modes[modeKey];
    if (!mode) return this.getRecommendations(animeList, limit);

    if (!animeList || animeList.length === 0) return [];

    const top = this.selectTopByScore(
      animeList,
      limit,
      anime => this.scoreAnimeWithMode(anime, modeKey),
      { minScore: 0.0001 }
    );

    return top.map(entry => ({
      ...entry.anime,
      reason: this.getRecommendationReasonForMode(entry.anime, modeKey)
    }));
  },

  /**
   * Get recommendation reason based on mode
   */
  getRecommendationReasonForMode(anime, modeKey = this.currentMode) {
    const stats = anime?.stats;

    switch (modeKey) {
      case 'binge':
        if (stats?.flowState >= 85) return 'Built for long watch sessions';
        if (stats?.threeEpisodeHook >= 85) return 'Hooks you almost immediately';
        return 'A strong binge candidate';

      case 'quality':
        if (anime.communityScore >= 8.5) return 'One of the strongest audience favorites';
        return 'Backed by a standout community score';

      case 'discovery':
        if (stats?.retentionScore >= 85) return 'An overlooked show with serious staying power';
        return 'Deserves far more attention';

      case 'comfort':
        if (stats?.comfortScore >= 80) return 'An especially easy, cozy watch';
        return 'Low-friction viewing for a relaxed session';

      default:
        return this.getRecommendationReason(anime);
    }
  },

  /**
   * Get mode-specific context text
   */
  getModeContext(modeKey = this.currentMode) {
    const contexts = {
      balanced: 'Balanced picks that combine strong staying power with trusted audience approval.',
      binge: 'Momentum-heavy shows that make it easy to keep watching one more episode.',
      quality: 'Audience-loved titles led by standout community ratings.',
      discovery: 'Less obvious picks with impressive staying power and upside.',
      comfort: 'Relaxed, lower-stress shows that are easy to sink into.'
    };
    return contexts[modeKey] || contexts.balanced;
  },

  // ==========================================
  // Because You Watched (Gap C5)
  // ==========================================

  /**
   * Get personalized "Because You Watched" recommendations
   * @param {Array} animeList - Full catalog
   * @param {Array} watchlistIds - User's watchlist anime IDs
   * @param {number} limit - Max recommendations
   * @returns {Object} { recommendations: Array, basedOn: Object }
   */
  getBecauseYouWatched(animeList, watchlistIds, limit = 6) {
    if (!watchlistIds || watchlistIds.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Get watchlist anime data
    const watchedAnime = watchlistIds
      .map(id => animeList.find(a => a.id === id))
      .filter(Boolean);

    if (watchedAnime.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Pick a seed anime (most recent watchlist entry or best for recommendations)
    const seedAnime = this.selectSeedAnime(watchedAnime);

    // Get recommendations based on seed
    const similarResults = this.getSimilarAnime(
      animeList.filter(a => !watchlistIds.includes(a.id)),
      seedAnime,
      limit + 5 // Get extra for filtering
    );

    // Filter out already watched and rank by relevance
    const filtered = similarResults
      .filter(r => !watchlistIds.includes(r.anime.id))
      .slice(0, limit);

    return {
      recommendations: filtered.map(r => ({
        ...r.anime,
        reason: this.getPersonalizedReason(r, seedAnime),
        matchDetails: {
          sharedGenres: r.sharedGenres,
          sharedThemes: r.sharedThemes,
          retentionAlignment: r.retentionAlignment,
          satisfactionAlignment: r.satisfactionAlignment
        }
      })),
      basedOn: seedAnime
    };
  },

  /**
   * Select the best seed anime from watchlist
   */
  selectSeedAnime(watchlistAnime) {
    // Prefer anime with both genres and themes
    const withTags = watchlistAnime.filter(a =>
      a.genres?.length > 0 && a.themes?.length > 0
    );

    if (withTags.length === 0) {
      return watchlistAnime[0];
    }

    // Score each by how good it is for recommendations
    const scored = withTags.map(anime => {
      let score = 0;

      // Prefer anime with diverse tags
      score += (anime.genres?.length || 0) * 10;
      score += (anime.themes?.length || 0) * 10;

      // Prefer higher quality anime
      score += (anime.stats?.retentionScore || 0) * 0.5;
      score += (anime.communityScore || 0) * 5;

      return { anime, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].anime;
  },

  /**
   * Generate personalized reason text
   */
  getPersonalizedReason(similarityResult, seedAnime) {
    const { sharedGenres, sharedThemes, similarityScore } = similarityResult;

    // High similarity
    if (similarityScore >= 0.7 && sharedGenres.length >= 2) {
      return `A close match to what you liked about ${seedAnime.title}`;
    }

    // Genre-focused
    if (sharedGenres.length >= 2 && sharedThemes.length === 0) {
      const genres = sharedGenres.slice(0, 2).join(' + ');
      return `Carries the same ${genres} energy as ${seedAnime.title}`;
    }

    // Theme-focused
    if (sharedThemes.length >= 2 && sharedGenres.length === 0) {
      const themes = sharedThemes.slice(0, 2).join(' + ');
      return `Shares the ${themes} appeal of ${seedAnime.title}`;
    }

    // Mixed
    if (sharedGenres.length > 0 && sharedThemes.length > 0) {
      return `A strong follow-up for fans of ${seedAnime.title}`;
    }

    return `Recommended because you watched ${seedAnime.title}`;
  }
};

export { Recommendations };
