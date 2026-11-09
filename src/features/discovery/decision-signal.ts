// @ts-nocheck
import { Recommendations } from './recommendations.ts';

const buildDetailDecisionData = (anime, { episodeCount = 0 } = {}) => {
  const hasEpisodes = Recommendations.hasEpisodeRatingEvidence(anime);
  const retention = Recommendations.getPresentationEpisodeScore(anime);
  const satisfaction = Number.isFinite(anime?.communityScore)
    ? anime.communityScore
    : null;

  if (retention !== null) {
    const note = Recommendations.getRatingEvidenceLabel(anime);
    return {
      value: `${retention}/100`,
      kind: 'episode',
      label: 'Episode Rating Strength',
      note,
      className: Recommendations.getRetentionClass(retention)
    };
  }

  if (satisfaction !== null) {
    return {
      value: `${satisfaction.toFixed(1)}/10`,
      kind: 'community',
      label: 'Community Score (MAL)',
      note: hasEpisodes ? 'Use genre fit to decide' : Recommendations.getRatingEvidenceLabel(anime),
      className: Recommendations.getMalSatisfactionClass(satisfaction)
    };
  }

  return {
    value: 'N/A',
    kind: 'unavailable',
    label: 'Decision signal',
    note: 'Open details for more context',
    className: 'score-low'
  };
};

export { buildDetailDecisionData };
