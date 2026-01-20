/**
 * Recommendations module for beginner-friendly anime suggestions
 */

const Recommendations = {
  /**
   * Get recommended anime based on Satisfaction Score with a popularity nudge
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
    const satisfaction = anime?.stats?.satisfactionScore ?? 0;
    const community = Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;
    const communityScaled = community * 10;
    return (satisfaction * 0.75) + (communityScaled * 0.25);
  },

  /**
   * Generate a simple recommendation reason
   * @param {Object} anime - Anime object with stats
   * @returns {string} Reason string
   */
  getRecommendationReason(anime) {
    const reasons = [];
    const satisfaction = anime?.stats?.satisfactionScore ?? 0;
    const community = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = Array.isArray(anime?.episodes) && anime.episodes.length > 0;

    if (!hasEpisodes) {
      if (community !== null && community >= 8.1) {
        return 'Popular with viewers';
      }
      return 'Data still growing';
    }

    if (satisfaction >= 85) reasons.push('Highly satisfying');
    if (anime?.stats?.churnRisk?.score <= 25) reasons.push('Low drop-off');
    if (anime?.stats?.threeEpisodeHook >= 80) reasons.push('Strong start');
    if (anime?.stats?.worthFinishing >= 70) reasons.push('Strong finish');
    if (anime?.stats?.flowState >= 85) reasons.push('Steady pace');
    if (community !== null && community >= 8.1) reasons.push('Popular with viewers');

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
      title1: 'Top Satisfaction',
      title2: 'Most Popular',
      metric1: 'satisfaction',
      metric2: 'popularity'
    };
  },

  /**
   * Get sort options for the catalog
   * @returns {Array} Sort option objects
   */
  getSortOptions() {
    return [
      { value: 'satisfaction', label: 'Sort by: Satisfaction Score' },
      { value: 'popularity', label: 'Sort by: Popularity Score (MAL)' }
    ];
  },

  /**
   * Get badges for an anime card
   * @param {Object} anime - Anime object with stats
   * @returns {Array} Badge objects
   */
  getBadges(anime) {
    const badges = [];
    const satisfaction = anime?.stats?.satisfactionScore ?? 0;
    const community = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const hasEpisodes = Array.isArray(anime?.episodes) && anime.episodes.length > 0;

    if (hasEpisodes && satisfaction >= 85) {
      badges.push({ label: 'High Satisfaction', class: 'badge-satisfaction' });
    }
    if (community !== null && community >= 8.5) {
      badges.push({ label: 'Popular', class: 'badge-popular' });
    }
    if (hasEpisodes && anime?.stats?.threeEpisodeHook >= 80) {
      badges.push({ label: 'Strong Start', class: 'badge-strong-start' });
    }
    if (hasEpisodes && satisfaction >= 80 && (community === null || community < 7.2)) {
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
    const satisfaction = hasEpisodes ? Math.round(anime?.stats?.satisfactionScore ?? 0) : null;
    const community = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;

    return [
      {
        label: 'Satisfaction',
        value: satisfaction !== null ? satisfaction : 'N/A',
        suffix: satisfaction !== null ? '%' : '',
        class: this.getSatisfactionClass(satisfaction)
      },
      {
        label: 'Popularity',
        value: community !== null ? community.toFixed(1) : 'N/A',
        suffix: community !== null ? '/10' : '',
        class: this.getPopularityClass(community)
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
   * Map Satisfaction Score to CSS class
   * @param {number|null} value - Satisfaction score
   * @returns {string} CSS class name
   */
  getSatisfactionClass(value) {
    if (value === null || !Number.isFinite(value)) return '';
    if (value >= 85) return 'score-high';
    if (value >= 70) return 'score-mid';
    if (value >= 55) return 'score-low';
    return 'score-poor';
  },

  /**
   * Map Popularity Score to CSS class
   * @param {number|null} value - Popularity score
   * @returns {string} CSS class name
   */
  getPopularityClass(value) {
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
