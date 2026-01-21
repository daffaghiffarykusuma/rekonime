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
        return 'Highly rated on MAL';
      }
      return 'Data still growing';
    }

    if (retentionScore >= 85) reasons.push('High retention');
    if (anime?.stats?.churnRisk?.score <= 25) reasons.push('Low drop-off');
    if (anime?.stats?.threeEpisodeHook >= 80) reasons.push('Strong start');
    if (anime?.stats?.worthFinishing >= 70) reasons.push('Strong finish');
    if (anime?.stats?.flowState >= 85) reasons.push('Steady pace');
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.1) reasons.push('Highly rated on MAL');

    if (reasons.length === 0) {
      return 'Solid watch-through';
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
      badges.push({ label: 'High Retention', class: 'badge-retention' });
    }
    if (malSatisfactionScore !== null && malSatisfactionScore >= 8.5) {
      badges.push({ label: 'Highly Rated (MAL)', class: 'badge-satisfaction' });
    }
    if (hasEpisodes && anime?.stats?.threeEpisodeHook >= 80) {
      badges.push({ label: 'Strong Start', class: 'badge-strong-start' });
    }
    if (hasEpisodes && retentionScore >= 80 && (malSatisfactionScore === null || malSatisfactionScore < 7.2)) {
      badges.push({ label: 'Hidden Gem', class: 'badge-hidden-gem' });
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
        class: this.getRetentionClass(retentionScore)
      },
      {
        label: 'Satisfaction (MAL)',
        value: malSatisfactionScore !== null ? malSatisfactionScore.toFixed(1) : 'N/A',
        suffix: malSatisfactionScore !== null ? '/10' : '',
        class: this.getMalSatisfactionClass(malSatisfactionScore)
      },
      {
        label: 'Episodes',
        value: episodeCount || 'N/A',
        suffix: '',
        class: ''
      }
    ];
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
