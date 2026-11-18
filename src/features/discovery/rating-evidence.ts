// @ts-nocheck
/**
 * Rating evidence read model: everything a surface needs to show a title's Episode Rating
 * Strength and Community Score, with the evidence gating applied once.
 *
 * Callers read `getRatingSignals(anime)` instead of raw `anime.stats` fields. Stored keys keep
 * their legacy names (`stats.retentionScore` holds Episode Rating Strength) because Snapshots,
 * personal-data exports, and the Python catalog build share them.
 */

const hasEpisodeRatingEvidence = (anime) => {
  const evidence = anime?.stats?.ratingEvidence;
  return evidence ? evidence.ratedEpisodes > 0
    : (anime?.episodes || []).some(episode => Number.isFinite(episode?.score));
};

const getRatingEvidenceLabel = (anime) => {
  const evidence = anime?.stats?.ratingEvidence;
  if (!evidence) return 'Limited data · coverage unavailable';
  const coverage = evidence.totalEpisodes
    ? `${evidence.ratedEpisodes}/${evidence.totalEpisodes} episodes rated`
    : `${evidence.ratedEpisodes} episodes rated · total unknown`;
  const unavailable = evidence.ratedEpisodes === 0 ? 'Episode rating data unavailable · ' : '';
  return `${unavailable}${evidence.limited ? 'Limited data · ' : ''}${coverage}${evidence.completion === 'airing' ? ' · Provisional' : ''}`;
};

const getEpisodeRatingStrengthClass = (value) => {
  if (value === null || !Number.isFinite(value)) return '';
  if (value >= 85) return 'score-high';
  if (value >= 70) return 'score-mid';
  if (value >= 55) return 'score-low';
  return 'score-poor';
};

const getCommunityScoreClass = (value) => {
  if (value === null || !Number.isFinite(value)) return '';
  if (value >= 8.5) return 'score-high';
  if (value >= 7.5) return 'score-mid';
  if (value >= 6.5) return 'score-low';
  return 'score-poor';
};

const roundedWhen = (condition, value) => (condition && Number.isFinite(value) ? Math.round(value) : null);

// Opening ratings need episodes 1-3; without known positions a strong opening cannot be shown.
const hasOpeningEvidence = (anime) => {
  const evidence = anime?.stats?.ratingEvidence;
  if (!evidence) return true;
  return Boolean(evidence.positionsKnown) && (anime.episodes || []).some(episode => episode.episode >= 1 && episode.episode <= 3);
};

const buildHeadline = ({ hasEpisodeEvidence, episodeRatingStrength, communityScore, evidenceLabel }) => {
  if (episodeRatingStrength !== null) {
    return {
      value: `${episodeRatingStrength}/100`,
      kind: 'episode',
      label: 'Episode Rating Strength',
      note: evidenceLabel,
      className: getEpisodeRatingStrengthClass(episodeRatingStrength)
    };
  }
  if (communityScore !== null) {
    return {
      value: `${communityScore.toFixed(1)}/10`,
      kind: 'community',
      label: 'Community Score (MAL)',
      note: hasEpisodeEvidence ? 'Use genre fit to decide' : evidenceLabel,
      className: getCommunityScoreClass(communityScore)
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

/**
 * @returns {{
 *   hasEpisodeEvidence: boolean,
 *   episodeRatingStrength: number|null,   rounded 0-100, null without rating evidence
 *   episodeRatingStrengthClass: string,
 *   communityScore: number|null,          0-10
 *   communityScoreClass: string,
 *   evidenceLabel: string,                coverage, limited, and provisional notes
 *   start: number|null, stay: number|null, finish: number|null,   episode rating patterns
 *   headline: { value, kind, label, note, className }             the one signal a card leads with
 * }}
 */
const getRatingSignals = (anime) => {
  const stats = anime?.stats;
  const hasEpisodeEvidence = hasEpisodeRatingEvidence(anime);
  const episodeRatingStrength = roundedWhen(hasEpisodeEvidence, stats?.retentionScore);
  const communityScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
  const evidenceLabel = getRatingEvidenceLabel(anime);
  const churn = stats?.churnRisk?.score;
  return {
    hasEpisodeEvidence,
    episodeRatingStrength,
    episodeRatingStrengthClass: getEpisodeRatingStrengthClass(episodeRatingStrength),
    communityScore,
    communityScoreClass: getCommunityScoreClass(communityScore),
    evidenceLabel,
    start: roundedWhen(hasEpisodeEvidence && hasOpeningEvidence(anime), stats?.threeEpisodeHook),
    stay: roundedWhen(hasEpisodeEvidence && Number.isFinite(churn), 100 - churn),
    finish: roundedWhen(hasEpisodeEvidence, stats?.worthFinishing),
    headline: buildHeadline({ hasEpisodeEvidence, episodeRatingStrength, communityScore, evidenceLabel })
  };
};

export {
  getRatingSignals,
  hasEpisodeRatingEvidence,
  getRatingEvidenceLabel,
  getEpisodeRatingStrengthClass,
  getCommunityScoreClass
};
