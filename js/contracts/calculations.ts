import type { CatalogAnimeBase, CatalogStats, ScoreProfile } from './catalog-runtime.ts';

export type CalculationScoreProfile = ScoreProfile;

export interface EpisodeScore {
  episode: number;
  score: number;
  [key: string]: unknown;
}

export interface CalculationAnime extends CatalogAnimeBase {
  episodes?: EpisodeScore[];
  stats?: CatalogStats | null;
  communityScore?: number | null;
}

export interface ChurnRiskResult {
  score: number;
  label: string;
  factors: string[];
}

export interface QualityTrend {
  slope: number;
  direction: 'improving' | 'declining' | 'stable';
}

export interface QualityDip {
  episode?: number;
  score: number;
  deviation: number;
}

export interface RollingAveragePoint {
  episode: number;
  rollingAvg: number;
}

export interface CalculatedStats extends CatalogStats {
  average: number;
  stdDev: number;
  auc: number;
  consistency: { label: string; class: string };
  scoreClass: string;
  episodeCount: number;
  highestScore: number;
  lowestScore: number;
  retentionScore: number;
  malSatisfactionScore: number;
  reliabilityScore: number;
  sessionSafety: number;
  threeEpisodeHook: number;
  habitBreakRisk: number;
  peakScore: number;
  finaleStrength: number;
  worthFinishing: number;
  peakEpisodeCount: number;
  momentum: number;
  narrativeAcceleration: number;
  comfortScore: number;
  stressSpikes: number;
  emotionalStability: number;
  barrierToEntry: number;
  flowState: number;
  qualityTrend: QualityTrend;
  qualityDips: QualityDip[];
  productionQualityIndex: number;
  rollingAverage: RollingAveragePoint[];
  controversyPotential: number;
  sharkJump: { episode: number; dropAmount: number } | null;
  churnRisk: ChurnRiskResult;
  slowBurn: {
    signal: number;
    isActive: boolean;
    momentumScore: number;
    finaleStrength: number;
  };
}

export interface RecommendationResult extends CalculationAnime {
  reason: string;
}

export interface SimilarAnimeResult {
  anime: CalculationAnime;
  sharedGenres: string[];
  sharedThemes: string[];
  retentionAlignment: number | null;
  satisfactionAlignment: number | null;
  similarityScore: number;
  score: number;
}

export interface CardStat {
  label: string;
  value: number | string;
  suffix: string;
  class: string;
  tooltip: { title: string; text: string } | null;
}

export interface RecommendationBadge {
  label: string;
  class: string;
}

export type RecommendationModeKey = 'balanced' | 'binge' | 'quality' | 'discovery' | 'comfort';

export interface FilterPresetDefinition {
  label: string;
  description: string;
  icon: string;
  sort: string;
  minRetention?: number;
  minMalScore?: number;
  filterFn: (anime: CalculationAnime) => boolean;
}

export interface FilterPresetViewModel extends FilterPresetDefinition {
  key: string;
}
