/**
 * Recommendations module for beginner-friendly anime suggestions
 */

const Recommendations = {
  /**
   * Get recommended anime based on Retention Score with a satisfaction nudge (MAL)
   * @param {Array} animeList - Array of anime objects with stats
   * @param {number} limit - Maximum number of recommendations
   * @returns {Array} Array of recommended anime with reasons
   */
  getRecommendations(animeList, limit = 5) {
    if (!animeList || animeList.length === 0) return [];

    const scored = animeList.map(anime => ({
      anime,
      recScore: this.scoreAnime(anime),
      reason: this.getRecommendationReason(anime)
    }));

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(entry => ({ ...entry.anime, reason: entry.reason }));
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

  /**
   * Generate a simple recommendation reason
   * @param {Object} anime - Anime object with stats
   * @returns {string} Reason string
   */
  getRecommendationReason(anime) {
    const reasons = [];
    const retentionScore = anime?.stats?.retentionScore ?? 0;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = Array.isArray(anime?.episodes) && anime.episodes.length > 0;

    if (!hasEpisodes) {
      if (malSatisfactionScore !== null && malSatisfactionScore >= 8.1) {
        return 'Loved by the community';
      }
      return 'New entry, check back soon';
    }

    if (retentionScore >= 85) reasons.push('Hard to put down');
    if (anime?.stats?.churnRisk?.score <= 25) reasons.push('Viewers stick around');
    if (anime?.stats?.threeEpisodeHook >= 80) reasons.push('Hooks you early');
    if (anime?.stats?.worthFinishing >= 70) reasons.push('Worth the finale');
    if (anime?.stats?.flowState >= 85) reasons.push('Smooth pacing');
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.1) reasons.push('Community favorite');

    if (reasons.length === 0) {
      return 'Reliable pick';
    }

    return reasons.slice(0, 2).join(' + ');
  },

  /**
   * Get ranking titles for the homepage spotlight cards
   * @returns {Object} Title and metric keys
   */
  getRankingTitles() {
    return {
      title1: 'Top Retention',
      title2: 'Highest Satisfaction (MAL)',
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
      { value: 'retention', label: 'Sort by: Retention Score' },
      { value: 'satisfaction', label: 'Sort by: Satisfaction Score (MAL)' }
    ];
  },

  /**
   * Get badges for an anime card
   * @param {Object} anime - Anime object with stats
   * @returns {Array} Badge objects
   */
  getBadges(anime) {
    const badges = [];
    const retentionScore = anime?.stats?.retentionScore ?? 0;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = Array.isArray(anime?.episodes) && anime.episodes.length > 0;

    if (hasEpisodes && retentionScore >= 85) {
      badges.push({ label: 'Keeps You Hooked', class: 'badge-retention' });
    }
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.5) {
      badges.push({ label: 'Fan Favorite', class: 'badge-satisfaction' });
    }
    if (hasEpisodes && anime?.stats?.threeEpisodeHook >= 80) {
      badges.push({ label: 'Great First Impression', class: 'badge-strong-start' });
    }
    if (hasEpisodes && retentionScore >= 80 && (malSatisfactionScore === null || malSatisfactionScore < 7.2)) {
      badges.push({ label: 'Underrated Pick', class: 'badge-hidden-gem' });
    }

    return badges.slice(0, 2);
  },

  /**
   * Get stats for card display
   * @param {Object} anime - Anime object with stats
   * @returns {Array} Stat objects
   */
  getCardStats(anime) {
    const episodeCount = Array.isArray(anime?.episodes) ? anime.episodes.length : 0;
    const hasEpisodes = episodeCount > 0;
    const retentionScore = hasEpisodes ? Math.round(anime?.stats?.retentionScore ?? 0) : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;

    return [
      {
        label: 'Retention',
        value: retentionScore !== null ? retentionScore : 'N/A',
        suffix: retentionScore !== null ? '%' : '',
        class: this.getRetentionClass(retentionScore),
        tooltip: {
          title: 'Retention Score',
          text: 'How consistently people keep watching across episodes.'
        }
      },
      {
        label: 'Satisfaction (MAL)',
        value: malSatisfactionScore !== null ? malSatisfactionScore.toFixed(1) : 'N/A',
        suffix: malSatisfactionScore !== null ? '/10' : '',
        class: this.getMalSatisfactionClass(malSatisfactionScore),
        tooltip: {
          title: 'Satisfaction Score',
          text: 'Community rating from MyAnimeList.'
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
   * Get retention score if available
   * @param {Object} anime - Anime object
   * @returns {number|null} Retention score
   */
  getRetentionScore(anime) {
    const hasEpisodes = Array.isArray(anime?.episodes) && anime.episodes.length > 0;
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
   * Map Retention Score to CSS class
   * @param {number|null} value - Retention score
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
      description: 'Best of both worlds',
      icon: '⚖️',
      weights: { retention: 0.75, satisfaction: 0.25 }
    },
    binge: {
      label: 'Binge Mode',
      description: 'High retention, hard to stop watching',
      icon: '🔥',
      weights: { retention: 0.9, satisfaction: 0.1 },
      boosters: ['flowState', 'threeEpisodeHook']
    },
    quality: {
      label: 'Critical Acclaim',
      description: 'Highest community ratings',
      icon: '⭐',
      weights: { retention: 0.3, satisfaction: 0.7 }
    },
    discovery: {
      label: 'Hidden Gems',
      description: 'High retention, lower popularity',
      icon: '💎',
      weights: { retention: 0.8, satisfaction: 0.2 },
      filter: (anime) => (anime.communityScore || 0) < 7.8
    },
    comfort: {
      label: 'Comfort Shows',
      description: 'Easy to watch, low stress',
      icon: '😌',
      weights: { retention: 0.6, satisfaction: 0.4 },
      boosters: ['comfortScore'],
      filter: (anime) => (anime.stats?.comfortScore || 0) > 70
    }
  },

  currentMode: 'balanced',

  /**
   * Set recommendation mode
   */
  setMode(modeKey) {
    if (this.modes[modeKey]) {
      this.currentMode = modeKey;
      // Persist preference
      try {
        localStorage.setItem('rekonime.recMode', modeKey);
      } catch (e) {
        // Ignore storage errors
      }
      return true;
    }
    return false;
  },

  /**
   * Load saved mode preference
   */
  loadModePreference() {
    try {
      const saved = localStorage.getItem('rekonime.recMode');
      if (saved && this.modes[saved]) {
        this.currentMode = saved;
      }
    } catch (e) {
      // Ignore storage errors
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

    const scored = animeList.map(anime => ({
      anime,
      recScore: this.scoreAnimeWithMode(anime, modeKey),
      reason: this.getRecommendationReasonForMode(anime, modeKey)
    }));

    return scored
      .filter(s => s.recScore > 0)
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(entry => ({ ...entry.anime, reason: entry.reason }));
  },

  /**
   * Get recommendation reason based on mode
   */
  getRecommendationReasonForMode(anime, modeKey = this.currentMode) {
    const stats = anime?.stats;

    switch (modeKey) {
      case 'binge':
        if (stats?.flowState >= 85) return 'Flows perfectly - hard to pause';
        if (stats?.threeEpisodeHook >= 85) return 'Hooks you immediately';
        return 'Built for binge-watching';

      case 'quality':
        if (anime.communityScore >= 8.5) return 'Critically acclaimed';
        return 'Highly rated by the community';

      case 'discovery':
        if (stats?.retentionScore >= 85) return 'Underappreciated gem';
        return 'Worth more attention';

      case 'comfort':
        if (stats?.comfortScore >= 80) return 'Perfect comfort viewing';
        return 'Easy, enjoyable watching';

      default:
        return this.getRecommendationReason(anime);
    }
  },

  /**
   * Get mode-specific context text
   */
  getModeContext(modeKey = this.currentMode) {
    const contexts = {
      balanced: 'Retention-first picks blended with MAL satisfaction for more dependable recommendations.',
      binge: 'Shows that are hard to stop watching - high flow state and strong hooks.',
      quality: 'Top-rated by the community - focus on critical acclaim and satisfaction.',
      discovery: 'Hidden gems with high retention but lower mainstream popularity.',
      comfort: 'Easy, stress-free shows perfect for relaxing and unwinding.'
    };
    return contexts[modeKey] || contexts.balanced;
  },

  // ==========================================
  // Because You Watched (Gap C5)
  // ==========================================

  /**
   * Get personalized "Because You Watched" recommendations
   * @param {Array} animeList - Full catalog
   * @param {Array} bookmarkedIds - User's bookmarked anime IDs
   * @param {number} limit - Max recommendations
   * @returns {Object} { recommendations: Array, basedOn: Object }
   */
  getBecauseYouWatched(animeList, bookmarkedIds, limit = 6) {
    if (!bookmarkedIds || bookmarkedIds.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Get bookmarked anime data
    const bookmarkedAnime = bookmarkedIds
      .map(id => animeList.find(a => a.id === id))
      .filter(Boolean);

    if (bookmarkedAnime.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Pick a seed anime (most recent bookmark or best for recommendations)
    const seedAnime = this.selectSeedAnime(bookmarkedAnime);

    // Get recommendations based on seed
    const similarResults = this.getSimilarAnime(
      animeList.filter(a => !bookmarkedIds.includes(a.id)),
      seedAnime,
      limit + 5 // Get extra for filtering
    );

    // Filter out already bookmarked and rank by relevance
    const filtered = similarResults
      .filter(r => !bookmarkedIds.includes(r.anime.id))
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
   * Select the best seed anime from bookmarks
   */
  selectSeedAnime(bookmarkedAnime) {
    // Prefer anime with both genres and themes
    const withTags = bookmarkedAnime.filter(a =>
      a.genres?.length > 0 && a.themes?.length > 0
    );

    if (withTags.length === 0) {
      return bookmarkedAnime[0];
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
      return `Very similar to ${seedAnime.title}`;
    }

    // Genre-focused
    if (sharedGenres.length >= 2 && sharedThemes.length === 0) {
      const genres = sharedGenres.slice(0, 2).join(' + ');
      return `Same ${genres} vibes as ${seedAnime.title}`;
    }

    // Theme-focused
    if (sharedThemes.length >= 2 && sharedGenres.length === 0) {
      const themes = sharedThemes.slice(0, 2).join(' + ');
      return `${themes} like ${seedAnime.title}`;
    }

    // Mixed
    if (sharedGenres.length > 0 && sharedThemes.length > 0) {
      return `Fans of ${seedAnime.title} also enjoy`;
    }

    return `Because you watched ${seedAnime.title}`;
  }
};

// Load saved mode preference on init
if (typeof window !== 'undefined') {
  Recommendations.loadModePreference();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recommendations;
}
