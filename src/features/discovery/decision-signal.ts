// @ts-nocheck
import { Recommendations } from './recommendations.ts';

const buildDetailDecisionData = (anime, { episodeCount = 0 } = {}) => {
  const hasEpisodes = Recommendations.hasEpisodeRatingEvidence(anime);
  const retention = hasEpisodes && Number.isFinite(anime?.stats?.retentionScore)
    ? Math.round(anime.stats.retentionScore)
    : null;
  const satisfaction = Number.isFinite(anime?.communityScore)
    ? anime.communityScore
    : null;

  if (retention !== null) {
    const note = Recommendations.getRatingEvidenceLabel(anime);
    return {
      value: `${retention}/100`,
      label: 'Episode Rating Strength',
      note,
      className: Recommendations.getRetentionClass(retention)
    };
  }

  if (satisfaction !== null) {
    return {
      value: `${satisfaction.toFixed(1)}/10`,
      label: 'Community Score (MAL)',
      note: hasEpisodes ? 'Use genre fit to decide' : 'Episode rating data unavailable',
      className: Recommendations.getMalSatisfactionClass(satisfaction)
    };
  }

  return {
    value: 'N/A',
    label: 'Decision signal',
    note: 'Open details for more context',
    className: 'score-low'
  };
};

export { buildDetailDecisionData };
