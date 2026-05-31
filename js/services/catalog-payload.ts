// @ts-nocheck
import { DataValidator } from './data-validator.js';

const DEFAULT_ACTIVE_FILTERS = Object.freeze({
  seasonYear: Object.freeze([]),
  year: Object.freeze([]),
  studio: Object.freeze([]),
  source: Object.freeze([]),
  genres: Object.freeze([]),
  themes: Object.freeze([]),
  demographic: Object.freeze([])
});

const cloneDefaultActiveFilters = (filters = DEFAULT_ACTIVE_FILTERS) => Object.fromEntries(
  Object.entries(filters).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []])
);

const isValidScoreProfile = (profile) => Boolean(
  profile &&
  Number.isFinite(profile.p35) &&
  Number.isFinite(profile.p50) &&
  Number.isFinite(profile.p65)
);

const sanitizeTagList = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const cleaned = [];

  for (const tag of tags) {
    const label = String(tag ?? '').trim();
    const normalized = label.toLowerCase();
    if (!label || normalized === 'undefined' || normalized === 'null') continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(label);
  }

  return cleaned;
};

const normalizeSearchQuery = (value, { stripPunctuation = false, compact = false } = {}) => {
  let normalized = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC');

  if (stripPunctuation) {
    normalized = normalized.replace(/[-_/\\:;,.!?'"(){}\[\]<>|~`@#$%^&*=+]/g, ' ');
  }

  normalized = normalized.replace(/\s+/g, ' ').trim();
  return compact ? normalized.replace(/\s+/g, '') : normalized;
};

const buildSearchIndex = (title, titleEnglish, titleJapanese) => {
  const rawParts = [title, titleEnglish, titleJapanese]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  const variants = new Set();
  const compactVariants = new Set();

  rawParts.forEach(value => {
    const normalized = normalizeSearchQuery(value);
    const loose = normalizeSearchQuery(value, { stripPunctuation: true });
    const compact = normalizeSearchQuery(value, { stripPunctuation: true, compact: true });
    if (normalized) variants.add(normalized);
    if (loose) variants.add(loose);
    if (compact) compactVariants.add(compact);
  });

  const tokenSet = new Set();
  variants.forEach(text => {
    text.split(' ').forEach(token => {
      if (token) tokenSet.add(token);
    });
  });

  return {
    variants: Array.from(variants),
    compactVariants: Array.from(compactVariants),
    tokenSet
  };
};

const mergeSearchText = (existingText, searchIndex) => {
  const parts = [];
  if (existingText) parts.push(existingText);
  if (searchIndex?.variants) parts.push(...searchIndex.variants);
  if (searchIndex?.compactVariants) parts.push(...searchIndex.compactVariants);
  return [...new Set(parts.filter(Boolean))].join(' ');
};

const buildSearchText = (title, titleEnglish, titleJapanese) => {
  const searchIndex = buildSearchIndex(title, titleEnglish, titleJapanese);
  return mergeSearchText('', searchIndex);
};

const getEpisodeCount = (anime) => {
  if (!anime) return 0;
  const directCount = [
    anime.episodeCount,
    anime.episodesCount,
    anime.episodes_count,
    anime.metadata?.episodeCount,
    anime.metadata?.episodesCount,
    anime.metadata?.episodes_count
  ].reduce((max, candidate) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed > 0 ? Math.max(max, Math.floor(parsed)) : max;
  }, 0);
  const listCount = Array.isArray(anime.episodes)
    ? anime.episodes.reduce((max, episode, index) => {
      const parsed = Number(episode?.episode);
      const fallback = index + 1;
      const count = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      return Math.max(max, Math.floor(count));
    }, 0)
    : 0;
  const statsCount = Number.isFinite(anime?.stats?.episodeCount) ? anime.stats.episodeCount : 0;
  return Math.max(directCount, listCount, statsCount);
};

const normalizeAnimeData = (animeList = []) => {
  if (!Array.isArray(animeList)) return [];

  return animeList.map(anime => {
    const normalizedGenres = sanitizeTagList(anime?.metadata?.genres || anime?.genres || []);
    const normalizedThemes = sanitizeTagList(anime?.metadata?.themes || anime?.themes || []);
    const normalizedTrailer = anime?.metadata?.trailer || anime?.trailer || null;
    const normalizedSynopsis = anime?.metadata?.synopsis || anime?.synopsis || '';
    const existingStats = anime?.stats || anime?.metadata?.stats || null;
    const existingColorIndex = Number.isFinite(anime?.colorIndex) ? anime.colorIndex : null;
    const existingSearchText = typeof anime?.searchText === 'string' ? anime.searchText : '';
    const existingSearchIndex = anime?.searchIndex || null;
    const normalizedTitleEnglish =
      anime?.metadata?.title_english ||
      anime?.metadata?.titleEnglish ||
      anime?.title_english ||
      anime?.titleEnglish ||
      '';
    const normalizedTitleJapanese =
      anime?.metadata?.title_japanese ||
      anime?.metadata?.titleJapanese ||
      anime?.title_japanese ||
      anime?.titleJapanese ||
      '';
    const normalizedType = anime?.metadata?.type || anime?.type || '';
    const rawCommunityScore = anime?.communityScore ?? anime?.metadata?.score ?? anime?.score;
    const communityScore = Number.isFinite(Number(rawCommunityScore)) ? Number(rawCommunityScore) : null;
    const source = anime?.metadata ? anime.metadata : anime;
    const resolvedTitle = anime?.metadata ? (anime.metadata.title || anime.title) : anime?.title;
    const shouldBuildSearchIndex = !existingSearchIndex && !existingSearchText;
    const searchIndex = shouldBuildSearchIndex
      ? buildSearchIndex(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese)
      : existingSearchIndex;
    const searchText = shouldBuildSearchIndex
      ? mergeSearchText(existingSearchText, searchIndex)
      : existingSearchText;

    return {
      id: source?.id || anime?.id,
      title: resolvedTitle,
      titleEnglish: normalizedTitleEnglish,
      titleJapanese: normalizedTitleJapanese,
      malId: source?.malId || anime?.mal_id || anime?.malId,
      anilistId: source?.anilistId || anime?.anilistId,
      cover: source?.cover || anime?.cover,
      type: normalizedType,
      year: source?.year || anime?.year,
      season: source?.season || anime?.season,
      studio: source?.studio || anime?.studio,
      source: source?.source || anime?.source,
      genres: normalizedGenres,
      themes: normalizedThemes,
      demographic: source?.demographic || anime?.demographic,
      trailer: normalizedTrailer,
      synopsis: normalizedSynopsis,
      communityScore,
      episodeCount: getEpisodeCount(anime),
      searchIndex,
      searchText,
      episodes: Array.isArray(anime?.episodes) ? anime.episodes : [],
      stats: existingStats,
      colorIndex: existingColorIndex,
      franchise: anime?.franchise || anime?.metadata?.franchise || null
    };
  });
};

const validateAnimeData = (animeList) => {
  const errors = [];
  if (!Array.isArray(animeList)) {
    return { isValid: false, errors: ['anime is not an array'] };
  }
  if (animeList.length === 0) {
    return { isValid: true, errors: [], isEmpty: true };
  }

  const sampleSize = Math.min(animeList.length, 5);
  for (let i = 0; i < sampleSize; i += 1) {
    const anime = animeList[i];
    if (!anime) {
      errors.push(`Item ${i} is null or undefined`);
      continue;
    }
    if (typeof anime.id === 'undefined') {
      errors.push(`Item ${i} missing id`);
    }
    if (!anime.title || typeof anime.title !== 'string') {
      errors.push(`Item ${i} missing or invalid title`);
    }
  }

  const isValid = errors.length < Math.ceil(sampleSize * 0.2);
  return { isValid, errors, itemCount: animeList.length };
};

const prepareCatalogPayloadState = (
  payload,
  {
    isFull = false,
    preserveFilters = true,
    defaultActiveFilters = DEFAULT_ACTIVE_FILTERS,
    validator = DataValidator
  } = {}
) => {
  const animeData = normalizeAnimeData(payload?.anime || []);
  const scoreProfile = isValidScoreProfile(payload?.scoreProfile) ? payload.scoreProfile : null;
  const validation = validator?.validateCatalog
    ? validator.validateCatalog(animeData, { source: isFull ? 'full' : 'embedded' })
    : null;

  return {
    animeData,
    scoreProfile,
    validation,
    isFullDataLoaded: Boolean(isFull),
    catalogStatus: isFull ? 'full' : 'embedded',
    catalogReady: true,
    gridState: {
      sortedCache: null,
      sortedKey: '',
      sortedSource: null,
      sortedIsPartial: false
    },
    activeFilters: preserveFilters ? null : cloneDefaultActiveFilters(defaultActiveFilters)
  };
};

const CatalogPayload = {
  prepareState: prepareCatalogPayloadState,
  normalizeAnimeData,
  validateAnimeData,
  sanitizeTagList,
  normalizeSearchQuery,
  buildSearchIndex,
  mergeSearchText,
  buildSearchText,
  getEpisodeCount,
  isValidScoreProfile
};

export {
  CatalogPayload,
  prepareCatalogPayloadState,
  normalizeAnimeData,
  validateAnimeData,
  sanitizeTagList,
  normalizeSearchQuery,
  buildSearchIndex,
  mergeSearchText,
  buildSearchText,
  getEpisodeCount,
  isValidScoreProfile
};
export default CatalogPayload;
