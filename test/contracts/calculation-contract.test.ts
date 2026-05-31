import type {
  CalculatedStats,
  CalculationAnime,
  CalculationScoreProfile,
  CardStat,
  FilterPresetViewModel,
  RecommendationBadge,
  RecommendationResult,
  SimilarAnimeResult
} from '../../js/contracts/calculations.ts';

const scoreProfile: CalculationScoreProfile = {
  p35: 3.2,
  p50: 3.6,
  p65: 4,
  sampleSize: 3,
  source: 'default'
};

const stats: CalculatedStats = {
  average: 4,
  stdDev: 0.82,
  auc: 75,
  consistency: { label: 'Consistent', class: 'consistency-medium' },
  scoreClass: 'score-good',
  episodeCount: 3,
  highestScore: 5,
  lowestScore: 3,
  retentionScore: 80,
  malSatisfactionScore: 8.6,
  reliabilityScore: 70,
  sessionSafety: 80,
  threeEpisodeHook: 75,
  habitBreakRisk: 0,
  peakScore: 5,
  finaleStrength: 50,
  worthFinishing: 60,
  peakEpisodeCount: 1,
  momentum: 0,
  narrativeAcceleration: 0,
  comfortScore: 90,
  stressSpikes: 0,
  emotionalStability: 90,
  barrierToEntry: 0,
  flowState: 100,
  qualityTrend: { slope: 0, direction: 'stable' },
  qualityDips: [],
  productionQualityIndex: 70,
  rollingAverage: [{ episode: 3, rollingAvg: 4 }],
  controversyPotential: 20,
  sharkJump: null,
  churnRisk: { score: 10, label: 'Low Risk', factors: [] },
  slowBurn: {
    signal: 0,
    isActive: false,
    momentumScore: 50,
    finaleStrength: 50
  }
};

const anime: CalculationAnime = {
  id: 'alpha',
  title: 'Alpha',
  communityScore: 8.6,
  genres: ['Action'],
  themes: ['Fantasy'],
  episodes: [{ episode: 1, score: 4 }],
  stats
};

const recommendation: RecommendationResult = {
  ...anime,
  reason: 'Easy to keep watching'
};

const similar: SimilarAnimeResult = {
  anime,
  sharedGenres: ['Action'],
  sharedThemes: ['Fantasy'],
  retentionAlignment: 1,
  satisfactionAlignment: 1,
  similarityScore: 1,
  score: 1
};

const cardStat: CardStat = {
  label: 'Finish Rate',
  value: 80,
  suffix: '%',
  class: 'score-mid',
  tooltip: { title: 'Finish Rate', text: 'How reliably a show keeps viewers watching.' }
};

const badge: RecommendationBadge = {
  label: 'Hard to stop watching',
  class: 'badge-retention'
};

const preset: FilterPresetViewModel = {
  key: 'binge-worthy',
  label: 'Binge Ready',
  description: 'Smooth pacing and fewer rough patches',
  icon: 'B',
  sort: 'flowState',
  filterFn: (entry) => Number(entry.stats?.flowState) >= 70
};

void scoreProfile;
void recommendation;
void similar;
void cardStat;
void badge;
void preset;
