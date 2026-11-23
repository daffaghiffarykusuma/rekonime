// Runtime catalog index projection: the per-title fields the app loads up front
// (data/anime.full.index.json). Episode lists and synopses live in per-title detail
// chunks, so anything the index needs about episode evidence must come from stats.
import { compactCatalogColorIndex, compactCatalogStats } from '../src/features/catalog/catalog-stats-defaults.js';

export const toRuntimeStatsSummary = (stats = {}) => ({
  average: stats.average,
  stdDev: stats.stdDev,
  scoreClass: stats.scoreClass,
  episodeCount: stats.episodeCount,
  retentionScore: stats.retentionScore,
  ratingEvidence: stats.ratingEvidence,
  scoringVersion: stats.scoringVersion,
  threeEpisodeHook: stats.threeEpisodeHook,
  worthFinishing: stats.worthFinishing,
  flowState: stats.flowState,
  comfortScore: stats.comfortScore,
  controversyPotential: stats.controversyPotential,
  reliabilityScore: stats.reliabilityScore,
  sessionSafety: stats.sessionSafety,
  churnRisk: stats.churnRisk && Number.isFinite(stats.churnRisk.score)
    ? { score: stats.churnRisk.score, label: stats.churnRisk.label }
    : stats.churnRisk,
  slowBurn: stats.slowBurn && Number.isFinite(stats.slowBurn.signal)
    ? { signal: stats.slowBurn.signal, isActive: Boolean(stats.slowBurn.isActive) }
    : stats.slowBurn
});

export const toFullIndexAnime = (anime) => ({
  id: anime.id,
  title: anime.title,
  titleEnglish: anime.titleEnglish,
  titleJapanese: anime.titleJapanese,
  malId: anime.malId,
  anilistId: anime.anilistId,
  cover: anime.cover,
  type: anime.type,
  year: anime.year,
  season: anime.season,
  studio: anime.studio,
  source: anime.source,
  genres: Array.isArray(anime.genres) ? anime.genres : [],
  themes: Array.isArray(anime.themes) ? anime.themes : [],
  demographic: anime.demographic,
  communityScore: anime.communityScore,
  episodeCount: anime.episodeCount,
  stats: toRuntimeStatsSummary(anime.stats),
  colorIndex: anime.colorIndex
});

export const buildFullIndexPayload = (payload = {}) => {
  const animeList = Array.isArray(payload.anime) ? payload.anime : [];
  const { anime: statsCompacted, statsDefaults } = compactCatalogStats(animeList.map(toFullIndexAnime));
  const { anime, colorIndexFromPosition } = compactCatalogColorIndex(statsCompacted);
  return {
    generatedAt: payload.generatedAt,
    scoreProfile: payload.scoreProfile,
    ...(statsDefaults ? { statsDefaults } : {}),
    ...(colorIndexFromPosition ? { colorIndexFromPosition } : {}),
    anime
  };
};
