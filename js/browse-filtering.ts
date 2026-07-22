// @ts-nocheck
import { CatalogPayload } from './services/catalog-payload.ts';

const FILTER_PARAM_MAP = {
  seasonYear: 'season',
  year: 'year',
  studio: 'studio',
  source: 'source',
  genres: 'genre',
  themes: 'theme',
  demographic: 'demographic'
};

const FILTER_TYPE_LABELS = {
  genres: 'Genre',
  themes: 'Theme',
  demographic: 'Demographic',
  seasonYear: 'Season',
  year: 'Year',
  studio: 'Studio',
  source: 'Source'
};

const FILTER_TYPES = Object.keys(FILTER_PARAM_MAP);

const getDefaultActiveFilters = () => FILTER_TYPES.reduce((filters, type) => {
  filters[type] = [];
  return filters;
}, {});

const getDefaultFilterOptions = () => getDefaultActiveFilters();

const cloneFilterMap = (map, fallback = getDefaultActiveFilters()) => {
  const next = {};
  Object.keys(fallback).forEach((key) => {
    const value = map?.[key];
    next[key] = Array.isArray(value) ? [...value] : [];
  });
  return next;
};

const parseFilterParamValues = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .flatMap(value => String(value || '').split(','))
    .map(value => value.trim())
    .filter(Boolean);
};

const normalizeFilterValues = (type, values, filterOptions = {}) => {
  const cleaned = Array.isArray(values) ? values : [];
  if (cleaned.length === 0) return [];

  const options = Array.isArray(filterOptions?.[type]) ? filterOptions[type] : [];
  const canonicalMap = new Map(options.map(option => [String(option).toLowerCase(), String(option)]));
  const results = [];
  const seen = new Set();

  for (const value of cleaned) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const normalized = raw.toLowerCase();
    const canonical = canonicalMap.size ? (canonicalMap.get(normalized) || raw) : raw;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(canonical);
  }

  return results;
};

const getFiltersFromUrl = (sourceUrl, { filterOptions = {}, fallbackHref = '' } = {}) => {
  const filters = getDefaultActiveFilters();

  try {
    const url = new URL(sourceUrl || fallbackHref);
    Object.entries(FILTER_PARAM_MAP).forEach(([type, param]) => {
      const values = parseFilterParamValues(url.searchParams.getAll(param));
      filters[type] = normalizeFilterValues(type, values, filterOptions);
    });
  } catch (error) {
    return filters;
  }

  return filters;
};

const hasFilterParamsInUrl = (sourceUrl, { fallbackHref = '' } = {}) => {
  try {
    const url = new URL(sourceUrl || fallbackHref);
    return Object.values(FILTER_PARAM_MAP).some(param => url.searchParams.has(param));
  } catch (error) {
    return false;
  }
};

const areFiltersEqual = (left, right, filterTypes = FILTER_TYPES) => {
  for (const type of filterTypes) {
    const a = Array.isArray(left?.[type]) ? left[type] : [];
    const b = Array.isArray(right?.[type]) ? right[type] : [];
    if (a.length !== b.length) return false;
    const setA = new Set(a.map(value => String(value).toLowerCase()));
    for (const value of b) {
      if (!setA.has(String(value).toLowerCase())) return false;
    }
  }
  return true;
};

const getSortedFilterValues = (type, values, filterOptions = {}) => {
  const cleaned = Array.isArray(values) ? values.map(value => String(value)) : [];
  const unique = [...new Set(cleaned)];
  const options = Array.isArray(filterOptions?.[type]) ? filterOptions[type] : [];
  if (options.length === 0) {
    return unique.sort((a, b) => a.localeCompare(b));
  }
  const order = new Map(options.map((option, index) => [String(option), index]));
  return unique.sort((a, b) => {
    const orderA = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
    const orderB = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });
};

const setFiltersOnUrl = (url, filters, { filterOptions = {} } = {}) => {
  if (!url) return;
  Object.values(FILTER_PARAM_MAP).forEach(param => url.searchParams.delete(param));
  Object.entries(FILTER_PARAM_MAP).forEach(([type, param]) => {
    const values = getSortedFilterValues(type, filters?.[type] || [], filterOptions);
    values.forEach(value => url.searchParams.append(param, value));
  });
};

const getActiveFilterGroups = (activeFilters, filterTypeLabels = FILTER_TYPE_LABELS) => {
  const groups = [];
  Object.entries(activeFilters || {}).forEach(([type, values]) => {
    const cleaned = (Array.isArray(values) ? values : [])
      .map(value => String(value ?? '').trim())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    groups.push({
      type,
      label: filterTypeLabels[type] || type,
      values: cleaned
    });
  });
  return groups;
};

const buildFilterMeta = ({
  activeFilters,
  searchQuery = '',
  filterTypeLabels = FILTER_TYPE_LABELS,
  siteName,
  defaultTitle,
  defaultDescription,
  buildMetaDescription = value => value
}) => {
  const groups = getActiveFilterGroups(activeFilters, filterTypeLabels);
  const trimmedSearch = String(searchQuery || '').trim();
  if (trimmedSearch.length >= 2) {
    groups.unshift({ type: 'search', label: 'Search', values: [trimmedSearch] });
  }
  const summary = groups.map(group => `${group.label}: ${group.values.join(', ')}`);
  const headline = summary.join(' | ');
  const title = headline ? `${headline} | ${siteName}` : defaultTitle || siteName;
  const prefix = headline ? `Anime filtered by ${summary.join(', ')}.` : '';
  const description = buildMetaDescription(`${prefix} ${defaultDescription || ''}`.trim());
  return { title, description };
};

const extractFilterOptions = (animeData = []) => {
  const seasonYears = new Set();
  const years = new Set();
  const studios = new Set();
  const sources = new Set();
  const genres = new Set();
  const themes = new Set();
  const demographics = new Set();

  animeData.forEach(anime => {
    if (anime?.year && anime?.season) {
      seasonYears.add(`${anime.season} ${anime.year}`);
    }
    if (anime?.year) years.add(anime.year);
    if (anime?.studio) {
      if (Array.isArray(anime.studio)) {
        anime.studio.forEach(studio => studios.add(studio));
      } else {
        studios.add(anime.studio);
      }
    }
    if (anime?.source) sources.add(anime.source);
    if (anime?.genres) anime.genres.forEach(genre => genres.add(genre));
    if (anime?.themes) anime.themes.forEach(theme => themes.add(theme));
    if (anime?.demographic) demographics.add(anime.demographic);
  });

  const seasonOrder = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
  const sortedSeasonYears = [...seasonYears].sort((a, b) => {
    const [seasonA, yearA] = a.split(' ');
    const [seasonB, yearB] = b.split(' ');
    if (yearA !== yearB) return parseInt(yearB, 10) - parseInt(yearA, 10);
    return seasonOrder[seasonB] - seasonOrder[seasonA];
  });

  return {
    seasonYear: sortedSeasonYears,
    year: [...years].sort((a, b) => b - a),
    studio: [...studios].sort(),
    source: [...sources].sort(),
    genres: [...genres].sort(),
    themes: [...themes].sort(),
    demographic: [...demographics].sort()
  };
};

const hasActiveFilters = (activeFilters) => Object.values(activeFilters || {}).some(values =>
  Array.isArray(values) && values.length > 0
);

const matchesActiveFilters = (anime, activeFilters = {}) => {
  if (activeFilters.seasonYear?.length > 0) {
    const animeSeasonYear = `${anime?.season} ${anime?.year}`;
    if (!activeFilters.seasonYear.includes(animeSeasonYear)) return false;
  }
  if (activeFilters.year?.length > 0 && !activeFilters.year.includes(String(anime?.year))) {
    return false;
  }
  if (activeFilters.studio?.length > 0) {
    const animeStudios = Array.isArray(anime?.studio) ? anime.studio : [anime?.studio];
    if (!animeStudios.some(studio => activeFilters.studio.includes(studio))) return false;
  }
  if (activeFilters.source?.length > 0 && !activeFilters.source.includes(anime?.source)) {
    return false;
  }
  if (activeFilters.genres?.length > 0) {
    if (!anime?.genres || !activeFilters.genres.every(genre => anime.genres.includes(genre))) return false;
  }
  if (activeFilters.themes?.length > 0) {
    if (!anime?.themes || !activeFilters.themes.every(theme => anime.themes.includes(theme))) return false;
  }
  if (activeFilters.demographic?.length > 0 && !activeFilters.demographic.includes(anime?.demographic)) {
    return false;
  }
  return true;
};

const prepareSearchQuery = (query) => {
  const normalized = CatalogPayload.normalizeSearchQuery(query);
  const loose = CatalogPayload.normalizeSearchQuery(query, { stripPunctuation: true });
  const compact = CatalogPayload.normalizeSearchQuery(query, { stripPunctuation: true, compact: true });
  return { normalized, loose, compact, tokens: loose.split(' ').filter(Boolean) };
};

const getSearchIndex = (anime) => {
  if (anime?.searchIndex) return anime.searchIndex;
  const index = CatalogPayload.buildSearchIndex(anime?.title, anime?.titleEnglish, anime?.titleJapanese);
  if (anime) {
    anime.searchIndex = index;
    anime.searchText = CatalogPayload.mergeSearchText(anime.searchText, index);
  }
  return index;
};

const scoreSearchMatch = (index, queryInfo) => {
  if (!index || !queryInfo) return 0;
  const { normalized, loose, compact, tokens } = queryInfo;
  if (!normalized && !loose && !compact) return 0;
  const variants = index.variants || [];
  const compactVariants = index.compactVariants || [];
  const tokenSet = index.tokenSet || new Set();
  if (variants.some(value => value === normalized || value === loose)) return 100;
  if (variants.some(value => value.startsWith(normalized) || value.startsWith(loose))) return 90;
  if (variants.some(value => value.includes(normalized) || value.includes(loose))) return 75;
  const tokenMatch = tokens.length > 0 && tokens.every(token => tokenSet.has(token));
  if (tokenMatch) return tokens.length > 1 ? 70 : 60;
  if (compact && compactVariants.some(value => value.includes(compact))) return 55;
  return 0;
};

const matchesSearch = (anime, queryInfo) => {
  if (!anime || !queryInfo) return false;
  if (scoreSearchMatch(getSearchIndex(anime), queryInfo) > 0) return true;
  const searchableText = [
    anime.searchText,
    anime.title,
    anime.titleEnglish,
    anime.titleJapanese,
    anime.studio,
    anime.source,
    anime.demographic,
    ...(Array.isArray(anime.genres) ? anime.genres : []),
    ...(Array.isArray(anime.themes) ? anime.themes : [])
  ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
  const looseText = CatalogPayload.normalizeSearchQuery(searchableText, { stripPunctuation: true });
  const compactText = CatalogPayload.normalizeSearchQuery(searchableText, { stripPunctuation: true, compact: true });
  if (queryInfo.loose && looseText.includes(queryInfo.loose)) return true;
  if (queryInfo.compact && compactText.includes(queryInfo.compact)) return true;
  return queryInfo.tokens.length > 0 && queryInfo.tokens.every(token => looseText.includes(token));
};

const filterBySearch = (animeData, query) => {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return animeData;
  const queryInfo = prepareSearchQuery(trimmed);
  return animeData.filter(anime => matchesSearch(anime, queryInfo));
};

const findSearchMatches = ({ animeData = [], query = '', limit = 8 } = {}) => {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];
  const queryInfo = prepareSearchQuery(trimmed);
  return animeData
    .map(anime => ({ anime, score: scoreSearchMatch(getSearchIndex(anime), queryInfo) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.anime.title || '').localeCompare(String(b.anime.title || '')))
    .slice(0, limit)
    .map(item => item.anime);
};

const applyFilters = ({
  animeData = [],
  activeFilters = getDefaultActiveFilters(),
  searchQuery = ''
} = {}) => {
  const filteredByFacets = hasActiveFilters(activeFilters)
    ? animeData.filter(anime => matchesActiveFilters(anime, activeFilters))
    : animeData;
  const filteredData = filterBySearch(filteredByFacets, searchQuery);
  return {
    filteredData,
    lastAppliedSearchQuery: String(searchQuery || '').trim().length >= 2 ? String(searchQuery || '').trim() : ''
  };
};

const toggleFilterValue = (activeFilters, type, value) => {
  const valueStr = String(value);
  const currentValues = Array.isArray(activeFilters?.[type]) ? activeFilters[type] : [];
  const index = currentValues.indexOf(valueStr);
  const nextValues = index > -1
    ? currentValues.filter(item => item !== valueStr)
    : [...currentValues, valueStr];
  const nextFilters = { ...cloneFilterMap(activeFilters), [type]: nextValues };
  return {
    activeFilters: nextFilters,
    isActive: nextValues.includes(valueStr),
    value: valueStr
  };
};

const getActiveFilterCount = (activeFilters) => Object.values(activeFilters || {}).reduce((total, values) => {
  if (!Array.isArray(values)) return total;
  return total + values.filter(value => value !== null && value !== undefined && value !== '').length;
}, 0);

const buildActiveFilterItems = ({
  activeFilters,
  searchQuery = '',
  filterTypeLabels = FILTER_TYPE_LABELS
}) => {
  const active = [];
  Object.entries(activeFilters || {}).forEach(([type, values]) => {
    (Array.isArray(values) ? values : []).forEach(value => {
      if (value === null || value === undefined || value === '') return;
      active.push({
        type,
        value,
        label: filterTypeLabels[type] || type
      });
    });
  });
  const trimmedSearch = String(searchQuery || '').trim();
  if (trimmedSearch.length >= 2) {
    active.unshift({
      type: 'search',
      value: trimmedSearch,
      label: 'Search'
    });
  }
  return active;
};

const BrowseFiltering = {
  filterParamMap: FILTER_PARAM_MAP,
  filterTypeLabels: FILTER_TYPE_LABELS,
  filterTypes: FILTER_TYPES,
  getDefaultActiveFilters,
  getDefaultFilterOptions,
  cloneFilterMap,
  parseFilterParamValues,
  normalizeFilterValues,
  getFiltersFromUrl,
  hasFilterParamsInUrl,
  areFiltersEqual,
  getSortedFilterValues,
  setFiltersOnUrl,
  getActiveFilterGroups,
  buildFilterMeta,
  extractFilterOptions,
  hasActiveFilters,
  matchesActiveFilters,
  prepareSearchQuery,
  getSearchIndex,
  scoreSearchMatch,
  matchesSearch,
  filterBySearch,
  findSearchMatches,
  applyFilters,
  toggleFilterValue,
  getActiveFilterCount,
  buildActiveFilterItems
};

export { BrowseFiltering };
