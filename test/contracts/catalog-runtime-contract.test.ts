import type {
  CatalogCacheEventPayload,
  CatalogDataLoadCompletePayload,
  CatalogDataLoadStartPayload,
  CatalogPayload,
  CatalogValidationIssue,
  DetailChunkPayload,
  FullCatalogPayload,
  PreviewCatalogPayload,
  ScoreProfile
} from '../../js/contracts/catalog-runtime.ts';

const scoreProfile: ScoreProfile = {
  p35: 4.15,
  p50: 4.29,
  p65: 4.41,
  sampleSize: 66945,
  source: 'derived'
};

const previewCatalog: PreviewCatalogPayload = {
  generatedAt: '2026-05-12T10:29:52.416Z',
  scoreProfile,
  anime: [{
    id: 'doraemon',
    title: 'Doraemon',
    episodes: [{ episode: 1, score: 5 }],
    stats: { average: 5, episodeCount: 26 },
    trailer: null
  }]
};

const fullCatalog: FullCatalogPayload = {
  generatedAt: '2026-05-12T10:29:52.416Z',
  scoreProfile,
  anime: [{
    id: 'doraemon',
    title: 'Doraemon',
    detailPath: 'data/anime.detail/doraemon.json',
    episodeCount: 26,
    stats: { average: 5, episodeCount: 26 }
  }]
};

const detailChunk: DetailChunkPayload = {
  generatedAt: '2026-05-12T10:29:52.416Z',
  scoreProfile,
  anime: [{
    id: 'doraemon',
    title: 'Doraemon',
    synopsis: 'Detail chunk synopsis.',
    episodes: [{ episode: 1, score: 5 }]
  }]
};

const payloads: CatalogPayload[] = [previewCatalog, fullCatalog, detailChunk];

const validationIssue: CatalogValidationIssue = {
  severity: 'warning',
  code: 'missingTrailer',
  message: 'Trailer is missing.',
  path: 'anime[0].trailer',
  source: 'full'
};

const dataLoadStart: CatalogDataLoadStartPayload = {
  source: 'full',
  timestamp: '2026-05-31T00:00:00.000Z'
};

const dataLoadComplete: CatalogDataLoadCompletePayload = {
  source: 'full',
  count: 1,
  durationMs: 42
};

const catalogCacheEvent: CatalogCacheEventPayload = {
  type: 'detail-chunk-loaded',
  at: '2026-05-31T00:00:00.000Z',
  path: 'data/anime.detail/doraemon.json'
};

void payloads;
void validationIssue;
void dataLoadStart;
void dataLoadComplete;
void catalogCacheEvent;
