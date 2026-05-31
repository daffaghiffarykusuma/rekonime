export type CatalogEntryId = string | number;

export type CatalogDataSource = 'preview' | 'full' | 'embedded';

export type CatalogValidationSeverity = 'error' | 'warning' | 'info';

export type CatalogCacheEventType =
  | 'network-full-loaded'
  | 'indexeddb-full-hit'
  | 'indexeddb-full-miss'
  | 'indexeddb-full-used'
  | 'indexeddb-full-read-failed'
  | 'embedded-fallback-used'
  | 'cache-write-ok'
  | 'cache-write-failed'
  | 'full-load-timeout'
  | 'detail-chunk-loaded';

export interface ScoreProfile {
  p35: number;
  p50: number;
  p65: number;
  sampleSize?: number;
  source?: string;
}

export interface TrailerPolicyPayload {
  site?: string;
  id?: string;
  url?: string;
  embedUrl?: string;
  thumbnail?: string;
  source?: string;
}

export interface CatalogEpisodeScore {
  episode: number;
  score: number;
  [key: string]: unknown;
}

export interface CatalogStats {
  average?: number;
  stdDev?: number;
  scoreClass?: string;
  episodeCount?: number;
  retentionScore?: number;
  threeEpisodeHook?: number;
  worthFinishing?: number;
  flowState?: number;
  comfortScore?: number;
  controversyPotential?: number;
  reliabilityScore?: number;
  sessionSafety?: number;
  rollingAverage?: Array<{ episode: number; rollingAvg: number }>;
  churnRisk?: {
    score?: number;
    label?: string;
    factors?: string[];
  };
  slowBurn?: {
    signal?: number;
    isActive?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CatalogFranchiseItem {
  animeId: CatalogEntryId | null;
  externalKey?: string | null;
  title: string;
  year?: number | null;
  format?: string;
  bucket?: string;
  relationType?: string;
  isEntry?: boolean;
  isInCatalog?: boolean;
  anchorAnimeId?: CatalogEntryId | null;
  anchorTitle?: string;
  mainOrder?: number | null;
  order?: number;
}

export interface CatalogFranchise {
  id: string;
  title: string;
  mode?: string;
  entryAnimeId?: CatalogEntryId | null;
  entryTitle?: string;
  totalCount?: number;
  catalogCount?: number;
  mainCount?: number;
  items?: CatalogFranchiseItem[];
}

export interface CatalogAnimeBase {
  id: CatalogEntryId;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  malId?: number;
  anilistId?: number;
  cover?: string;
  type?: string;
  year?: number;
  season?: string;
  studio?: string;
  source?: string;
  genres?: string[];
  themes?: string[];
  demographic?: string;
  trailer?: TrailerPolicyPayload | null;
  synopsis?: string;
  communityScore?: number | null;
  episodeCount?: number;
  searchText?: string;
  episodes?: CatalogEpisodeScore[];
  franchise?: CatalogFranchise | null;
  stats?: CatalogStats | null;
  colorIndex?: number | null;
  [key: string]: unknown;
}

export interface PreviewCatalogEntry extends CatalogAnimeBase {
  episodes?: CatalogEpisodeScore[];
}

export interface FullCatalogEntry extends CatalogAnimeBase {
  detailPath?: string;
  episodes?: [];
}

export interface DetailChunkEntry extends CatalogAnimeBase {
  episodes: CatalogEpisodeScore[];
  synopsis?: string;
}

export interface CatalogPayloadBase<TEntry extends CatalogAnimeBase = CatalogAnimeBase> {
  generatedAt?: string;
  scoreProfile?: ScoreProfile;
  anime: TEntry[];
}

export type PreviewCatalogPayload = CatalogPayloadBase<PreviewCatalogEntry>;

export type FullCatalogPayload = CatalogPayloadBase<FullCatalogEntry>;

export type DetailChunkPayload = CatalogPayloadBase<DetailChunkEntry>;

export type CatalogPayload = PreviewCatalogPayload | FullCatalogPayload | DetailChunkPayload;

export interface CatalogValidationIssue {
  severity: CatalogValidationSeverity;
  code: string;
  message: string;
  path?: string;
  source?: CatalogDataSource | 'detail';
  itemId?: CatalogEntryId;
}

export interface CatalogValidationHandoff {
  isValid: boolean;
  errors?: CatalogValidationIssue[];
  warnings?: CatalogValidationIssue[];
  itemCount?: number;
  source?: CatalogDataSource | 'detail';
}

export interface CatalogDataLoadStartPayload {
  source: CatalogDataSource;
  timestamp?: string;
}

export interface CatalogDataLoadEndPayload {
  source: CatalogDataSource;
  count?: number;
  durationMs?: number;
  status?: 'ok' | 'error' | 'fallback';
}

export type CatalogDataLoadCompletePayload = CatalogDataLoadEndPayload;

export interface CatalogCacheEventPayload {
  type: CatalogCacheEventType;
  at?: string;
  path?: string;
  phase?: 'initial' | 'full';
  reason?: string;
  source?: string;
  animeId?: CatalogEntryId;
  timeoutMs?: number;
}

export interface CatalogRuntimeEventMap {
  'rekonime:data-load-start': CatalogDataLoadStartPayload;
  'rekonime:data-load-end': CatalogDataLoadEndPayload;
  'rekonime:catalog-cache': CatalogCacheEventPayload;
}
