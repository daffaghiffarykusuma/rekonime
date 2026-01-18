/**
 * Recommendations module for profile-based anime suggestions
 */

const Recommendations = {
  /**
   * Get recommended anime based on viewing style profile
   * @param {Array} animeList - Array of anime objects with stats
   * @param {string} profile - Viewing style: 'programmer' (Weekly Watcher), 'completionist', 'escapist' (Casual Viewer), 'focuser' (Deep Diver)
   * @param {number} limit - Maximum number of recommendations
   * @returns {Array} Array of recommended anime with reasons
   */
  getRecommendations(animeList, profile, limit = 5) {
    if (!animeList || animeList.length === 0) return [];

    switch (profile) {
      case 'programmer':
        return this.getProgrammerRecs(animeList, limit);
      case 'completionist':
        return this.getCompletionistRecs(animeList, limit);
      case 'escapist':
        return this.getEscapistRecs(animeList, limit);
      case 'focuser':
        return this.getFocuserRecs(animeList, limit);
      default:
        return this.getDefaultRecs(animeList, limit);
    }
  },

  /**
   * Weekly Watcher recommendations: Prioritize consistency and session safety
   * @param {Array} animeList - Array of anime objects
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended anime with reasons
   */
  getProgrammerRecs(animeList, limit) {
    const scored = animeList.map(anime => {
      let score = 0;

      // High weight on reliability
      score += anime.stats.reliabilityScore * 0.5;

      // Session safety is crucial
      score += anime.stats.sessionSafety * 0.3;

      // Consistency bonus
      score += (5 - anime.stats.stdDev) * 10;

      // Bonus for no bad episodes
      if (anime.stats.lowestScore >= 3) {
        score += 20;
      }

      return {
        anime,
        recScore: score,
        reason: this.getProgrammerReason(anime)
      };
    });

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(s => ({ ...s.anime, reason: s.reason }));
  },

  /**
   * Generate recommendation reason for Weekly Watcher
   */
  getProgrammerReason(anime) {
    if (anime.stats.sessionSafety === 100) {
      return 'Perfect session safety';
    }
    if (anime.stats.reliabilityScore >= 85) {
      return 'Highly reliable quality';
    }
    if (anime.stats.stdDev < 0.5) {
      return 'Exceptionally consistent';
    }
    return 'Reliable viewing experience';
  },

  /**
   * Completionist recommendations: Prioritize peaks and finale payoff
   * @param {Array} animeList - Array of anime objects
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended anime with reasons
   */
  getCompletionistRecs(animeList, limit) {
    const scored = animeList.map(anime => {
      let score = 0;

      // Worth finishing is key
      score += anime.stats.worthFinishing * 0.4;

      // Strong finale matters
      score += anime.stats.finaleStrength * 0.3;

      // Peak episodes add value
      score += anime.stats.peakEpisodeCount * 15;

      // High peak score bonus
      if (anime.stats.peakScore === 5) {
        score += 20;
      }

      return {
        anime,
        recScore: score,
        reason: this.getCompletionistReason(anime)
      };
    });

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(s => ({ ...s.anime, reason: s.reason }));
  },

  /**
   * Generate recommendation reason for Completionist
   */
  getCompletionistReason(anime) {
    if (anime.stats.peakEpisodeCount >= 3) {
      return `${anime.stats.peakEpisodeCount} peak episodes`;
    }
    if (anime.stats.finaleStrength >= 60) {
      return 'Strong finale payoff';
    }
    if (anime.stats.worthFinishing >= 70) {
      return 'Worth the commitment';
    }
    return 'Rewarding to complete';
  },

  /**
   * Casual Viewer recommendations: Prioritize relaxation and emotional stability
   * @param {Array} animeList - Array of anime objects
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended anime with reasons
   */
  getEscapistRecs(animeList, limit) {
    const scored = animeList.map(anime => {
      let score = 0;

      // Comfort is priority
      score += anime.stats.comfortScore * 0.5;

      // Emotional stability matters
      score += anime.stats.emotionalStability * 0.3;

      // Penalize stress spikes heavily
      score -= anime.stats.stressSpikes * 20;

      // Bonus for no stress spikes
      if (anime.stats.stressSpikes === 0) {
        score += 25;
      }

      return {
        anime,
        recScore: score,
        reason: this.getEscapistReason(anime)
      };
    });

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(s => ({ ...s.anime, reason: s.reason }));
  },

  /**
   * Generate recommendation reason for Casual Viewer
   */
  getEscapistReason(anime) {
    if (anime.stats.stressSpikes === 0 && anime.stats.comfortScore >= 80) {
      return 'Perfect comfort watch';
    }
    if (anime.stats.emotionalStability >= 90) {
      return 'Very emotionally stable';
    }
    if (anime.stats.stressSpikes === 0) {
      return 'No stressful moments';
    }
    return 'Relaxing experience';
  },

  /**
   * Deep Diver recommendations: Prioritize production quality and improving trends
   * @param {Array} animeList - Array of anime objects
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended anime with reasons
   */
  getFocuserRecs(animeList, limit) {
    const scored = animeList.map(anime => {
      let score = 0;

      // Production quality is key
      score += anime.stats.productionQualityIndex * 0.4;

      // AUC for overall quality
      score += anime.stats.auc * 0.3;

      // Trend bonus (improving is good)
      score += anime.stats.qualityTrend.slope * 50;

      // Penalize quality dips
      score -= anime.stats.qualityDips.length * 10;

      // Bonus for no dips
      if (anime.stats.qualityDips.length === 0) {
        score += 15;
      }

      return {
        anime,
        recScore: score,
        reason: this.getFocuserReason(anime)
      };
    });

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(s => ({ ...s.anime, reason: s.reason }));
  },

  /**
   * Generate recommendation reason for Deep Diver
   */
  getFocuserReason(anime) {
    if (anime.stats.productionQualityIndex >= 90) {
      return 'Excellent production quality';
    }
    if (anime.stats.qualityTrend.direction === 'improving') {
      return 'Improving quality trend';
    }
    if (anime.stats.qualityDips.length === 0) {
      return 'Consistently high quality';
    }
    return 'Worth analyzing';
  },

  /**
   * Default recommendations when no profile selected
   * @param {Array} animeList - Array of anime objects
   * @param {number} limit - Maximum recommendations
   * @returns {Array} Recommended anime with reasons
   */
  getDefaultRecs(animeList, limit) {
    const scored = animeList.map(anime => {
      let score = 0;

      // Balance of all factors
      score += anime.stats.average * 20;
      score += anime.stats.auc * 0.5;
      score += (5 - anime.stats.stdDev) * 10;

      return {
        anime,
        recScore: score,
        reason: `${anime.stats.average.toFixed(1)} avg score`
      };
    });

    return scored
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(s => ({ ...s.anime, reason: s.reason }));
  },

  /**
   * Get profile-specific ranking titles
   * @param {string} profile - Current profile
   * @returns {Object} Titles for ranking cards
   */
  getRankingTitles(profile) {
    const titles = {
      programmer: {
        title1: 'Strongest Hook',
        title2: 'Lowest Drop Risk',
        metric1: 'threeEpisodeHook',
        metric2: 'churnRisk'
      },
      completionist: {
        title1: 'Best Momentum',
        title2: 'Accelerating Stories',
        metric1: 'momentum',
        metric2: 'narrativeAcceleration'
      },
      escapist: {
        title1: 'Best Flow State',
        title2: 'Easiest to Start',
        metric1: 'flowState',
        metric2: 'barrierToEntry'
      },
      focuser: {
        title1: 'Least Controversial',
        title2: 'No Shark Jumps',
        metric1: 'controversyPotential',
        metric2: 'sharkJump'
      }
    };

    return titles[profile] || {
      title1: 'Best Average Score',
      title2: 'Most Consistent',
      metric1: 'average',
      metric2: 'consistency'
    };
  },

  /**
   * Get profile-specific sort options
   * @param {string} profile - Current profile
   * @returns {Array} Array of sort option objects
   */
  getSortOptions(profile) {
    const baseOptions = [
      { value: 'average', label: 'Sort by: Best Average' }
    ];

    const profileOptions = {
      programmer: [
        { value: 'threeEpisodeHook', label: 'Sort by: Hook Strength' },
        { value: 'churnRisk', label: 'Sort by: Lowest Drop Risk' },
        { value: 'habitBreakRisk', label: 'Sort by: Habit Safety' },
        { value: 'reliability', label: 'Sort by: Consistency Score' },
        { value: 'sessionSafety', label: 'Sort by: Safest to Watch' }
      ],
      completionist: [
        { value: 'momentum', label: 'Sort by: Momentum' },
        { value: 'narrativeAcceleration', label: 'Sort by: Story Acceleration' },
        { value: 'peakEpisodes', label: 'Sort by: Standout Episodes' },
        { value: 'finaleStrength', label: 'Sort by: Best Ending' },
        { value: 'worthFinishing', label: 'Sort by: Completion Score' }
      ],
      escapist: [
        { value: 'flowState', label: 'Sort by: Flow State' },
        { value: 'barrierToEntry', label: 'Sort by: Easiest Start' },
        { value: 'comfort', label: 'Sort by: Relaxation Score' },
        { value: 'emotionalStability', label: 'Sort by: Most Stable' },
        { value: 'stressSpikes', label: 'Sort by: Least Tense' }
      ],
      focuser: [
        { value: 'controversyPotential', label: 'Sort by: Least Controversial' },
        { value: 'sharkJump', label: 'Sort by: No Shark Jump' },
        { value: 'productionQuality', label: 'Sort by: Quality Score' },
        { value: 'improving', label: 'Sort by: Best Trend' },
        { value: 'qualityDips', label: 'Sort by: Fewest Weak Episodes' }
      ]
    };

    return [...(profileOptions[profile] || []), ...baseOptions];
  },

  /**
   * Get profile-specific badges for an anime
   * @param {Object} anime - Anime object with stats
   * @param {string} profile - Current profile
   * @returns {Array} Array of badge objects
   */
  getBadges(anime, profile) {
    const badges = [];

    switch (profile) {
      case 'programmer':
        // Retention badges
        if (anime.stats.threeEpisodeHook >= 80) {
          badges.push({ label: 'Strong Hook', class: 'badge-strong-hook' });
        }
        if (anime.stats.churnRisk.score >= 50) {
          badges.push({ label: 'Drop Risk', class: 'badge-drop-risk' });
        }
        // Existing satisfaction badges
        if (anime.stats.sessionSafety >= 90) {
          badges.push({ label: 'Session Safe', class: 'badge-session-safe' });
        }
        if (anime.stats.reliabilityScore >= 80) {
          badges.push({ label: 'Reliable', class: 'badge-reliable' });
        }
        if (anime.stats.lowestScore < 2) {
          badges.push({ label: 'Risky', class: 'badge-risky' });
        }
        break;

      case 'completionist':
        // Retention badges
        if (anime.stats.momentum > 30) {
          badges.push({ label: 'Building Momentum', class: 'badge-momentum' });
        }
        if (anime.stats.narrativeAcceleration > 0.1) {
          badges.push({ label: 'Accelerating', class: 'badge-accelerating' });
        }
        // Existing satisfaction badges
        if (anime.stats.peakEpisodeCount >= 3) {
          badges.push({ label: 'Peak Moments', class: 'badge-peak-moments' });
        }
        if (anime.stats.finaleStrength >= 60) {
          badges.push({ label: 'Strong Finale', class: 'badge-strong-finale' });
        }
        if (anime.stats.worthFinishing >= 70) {
          badges.push({ label: 'Worth Finishing', class: 'badge-worth-finishing' });
        }
        if (anime.stats.finaleStrength < 40) {
          badges.push({ label: 'Weak Ending', class: 'badge-weak-ending' });
        }
        break;

      case 'escapist':
        // Retention badges
        if (anime.stats.barrierToEntry < 0.5) {
          badges.push({ label: 'Easy Start', class: 'badge-easy-start' });
        }
        if (anime.stats.flowState >= 85) {
          badges.push({ label: 'Great Flow', class: 'badge-great-flow' });
        }
        // Existing satisfaction badges
        if (anime.stats.comfortScore >= 80) {
          badges.push({ label: 'Comfort Watch', class: 'badge-comfort-watch' });
        }
        if (anime.stats.stressSpikes === 0) {
          badges.push({ label: 'Safe Space', class: 'badge-safe-space' });
        }
        if (anime.stats.emotionalStability >= 85) {
          badges.push({ label: 'Smooth Ride', class: 'badge-smooth-ride' });
        }
        if (anime.stats.stressSpikes >= 2) {
          badges.push({ label: 'Stress Warning', class: 'badge-stress-warning' });
        }
        break;

      case 'focuser':
        // Retention badges
        if (anime.stats.controversyPotential >= 70) {
          badges.push({ label: 'Controversial', class: 'badge-controversial' });
        }
        if (anime.stats.sharkJump) {
          badges.push({ label: 'Shark Jump', class: 'badge-shark-jump' });
        }
        // Existing satisfaction badges
        if (anime.stats.qualityTrend.direction === 'improving') {
          badges.push({ label: 'Improving', class: 'badge-improving' });
        }
        if (anime.stats.qualityTrend.direction === 'declining') {
          badges.push({ label: 'Declining', class: 'badge-declining' });
        }
        if (anime.stats.qualityDips.length >= 2) {
          badges.push({ label: 'Quality Issues', class: 'badge-quality-issues' });
        }
        if (anime.stats.productionQualityIndex >= 90) {
          badges.push({ label: 'Excellence', class: 'badge-production-excellence' });
        }
        break;
    }

    return badges;
  },

  /**
   * Get profile-specific stats for card display
   * @param {Object} anime - Anime object with stats
   * @param {string} profile - Current profile
   * @returns {Array} Array of stat objects for card display
   */
  getCardStats(anime, profile) {
    const stats = {
      programmer: [
        { label: 'Hook', value: anime.stats.threeEpisodeHook, suffix: '%' },
        { label: 'Drop Risk', value: anime.stats.churnRisk.score, suffix: '%', class: anime.stats.churnRisk.score > 50 ? 'score-poor' : '' },
        { label: 'Consistency', value: anime.stats.reliabilityScore, suffix: '%' },
        { label: 'Safe Watch', value: anime.stats.sessionSafety, suffix: '%' }
      ],
      completionist: [
        { label: 'Momentum', value: anime.stats.momentum > 0 ? '+' + anime.stats.momentum : anime.stats.momentum },
        { label: 'Accel', value: (anime.stats.narrativeAcceleration > 0 ? '+' : '') + anime.stats.narrativeAcceleration.toFixed(2) },
        { label: 'Ending', value: anime.stats.finaleStrength, suffix: '%' },
        { label: 'Peak Eps', value: anime.stats.peakEpisodeCount }
      ],
      escapist: [
        { label: 'Flow', value: anime.stats.flowState, suffix: '%' },
        { label: 'Entry', value: anime.stats.barrierToEntry.toFixed(1), class: anime.stats.barrierToEntry > 1 ? 'score-poor' : '' },
        { label: 'Relaxation', value: anime.stats.comfortScore, suffix: '%' },
        { label: 'Stability', value: anime.stats.emotionalStability, suffix: '%' }
      ],
      focuser: [
        { label: 'Controversy', value: anime.stats.controversyPotential, suffix: '%' },
        { label: 'Shark Jump', value: anime.stats.sharkJump ? 'Ep ' + anime.stats.sharkJump.episode : 'None' },
        { label: 'Quality', value: anime.stats.productionQualityIndex, suffix: '%' },
        { label: 'Trend', value: (anime.stats.qualityTrend.slope > 0 ? '+' : '') + anime.stats.qualityTrend.slope.toFixed(2) }
      ]
    };

    return stats[profile] || [
      { label: 'Avg', value: anime.stats.average.toFixed(2), class: anime.stats.scoreClass },
      { label: 'Score', value: anime.stats.auc, suffix: '%' },
      { label: 'Spread', value: anime.stats.stdDev.toFixed(2) }
    ];
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recommendations;
}
