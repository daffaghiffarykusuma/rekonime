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

    const scored = animeList
      .filter(anime => anime && anime.id !== currentAnime.id)
      .map(anime => {
        const sharedGenres = this.getSharedTags(baseGenres, anime.genres);
        const sharedThemes = this.getSharedTags(baseThemes, anime.themes);

        if (sharedGenres.length === 0 || sharedThemes.length === 0) {
          return null;
        }

        const similarityScore = this.computeSimilarityScore(
          baseGenres.size,
          baseThemes.size,
          sharedGenres.length,
          sharedThemes.length
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

        return {
          anime,
          sharedGenres,
          sharedThemes,
          retentionAlignment,
          satisfactionAlignment,
          similarityScore,
          score: compositeScore
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
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
  computeSimilarityScore(baseGenreCount, baseThemeCount, sharedGenreCount, sharedThemeCount) {
    const genreScore = baseGenreCount > 0 ? (sharedGenreCount / baseGenreCount) : 0;
    const themeScore = baseThemeCount > 0 ? (sharedThemeCount / baseThemeCount) : 0;
    return (genreScore + themeScore) / 2;
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
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recommendations;
}
