// Compacts the runtime catalog index by moving the most common value of each
// stats field into one payload-level `statsDefaults` object. The build omits
// values equal to their default, and the loader restores them, so consumers
// always see complete stats objects.
//
// A field is only compacted when every title defines it, so a field that is
// genuinely absent can never be mistaken for one that was omitted.
//
// A title's `colorIndex` is likewise omitted when it equals the title's
// position, and `colorIndexFromPosition` tells the loader to restore it.

const STATS_DEFAULTS_KEY = 'statsDefaults';
const COLOR_INDEX_KEY = 'colorIndexFromPosition';
const NESTED_STATS_KEYS = ['ratingEvidence'];

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// Defaults are parsed JSON, so a plain recursive copy is exact. It runs once
// per title per object default, where JSON round trips or structuredClone
// cost far more than the copy itself.
const cloneValue = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = cloneValue(value[key]);
  return copy;
};
const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

const pickDefaults = (records, { exclude = [] } = {}) => {
  const defaults = {};
  if (!records.length) return defaults;
  const keys = new Set(records.flatMap((record) => Object.keys(record)));
  exclude.forEach((key) => keys.delete(key));
  for (const key of keys) {
    if (!records.every((record) => hasOwn(record, key) && record[key] !== undefined)) continue;
    const counts = new Map();
    for (const record of records) {
      const serialized = JSON.stringify(record[key]);
      counts.set(serialized, (counts.get(serialized) || 0) + 1);
    }
    let best = null;
    let bestCount = 0;
    counts.forEach((count, serialized) => {
      if (count > bestCount) {
        best = serialized;
        bestCount = count;
      }
    });
    // Only worth a default when it replaces at least half of the values.
    if (best !== null && bestCount * 2 >= records.length) defaults[key] = JSON.parse(best);
  }
  return defaults;
};

const omitDefaults = (record, defaults) => {
  const compacted = {};
  for (const [key, value] of Object.entries(record)) {
    if (hasOwn(defaults, key) && JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
    compacted[key] = value;
  }
  return compacted;
};

/**
 * @param {Array<Record<string, any>>} animeList Runtime index entries.
 * @returns {{ anime: Array<Record<string, any>>, statsDefaults: Record<string, any> | null }}
 */
const compactCatalogStats = (animeList = []) => {
  const list = Array.isArray(animeList) ? animeList : [];
  const statsRecords = list.map((anime) => anime?.stats).filter(isPlainObject);
  if (!statsRecords.length) return { anime: list, statsDefaults: null };

  const statsDefaults = pickDefaults(statsRecords, { exclude: NESTED_STATS_KEYS });
  for (const nestedKey of NESTED_STATS_KEYS) {
    if (!statsRecords.every((stats) => isPlainObject(stats[nestedKey]))) continue;
    const nestedDefaults = pickDefaults(statsRecords.map((stats) => stats[nestedKey]));
    if (Object.keys(nestedDefaults).length) statsDefaults[nestedKey] = nestedDefaults;
  }
  if (!Object.keys(statsDefaults).length) return { anime: list, statsDefaults: null };

  const anime = list.map((entry) => {
    if (!isPlainObject(entry?.stats)) return entry;
    const stats = omitDefaults(entry.stats, statsDefaults);
    for (const nestedKey of NESTED_STATS_KEYS) {
      if (!isPlainObject(statsDefaults[nestedKey])) continue;
      const nested = omitDefaults(entry.stats[nestedKey], statsDefaults[nestedKey]);
      if (Object.keys(nested).length) stats[nestedKey] = nested;
      else delete stats[nestedKey];
    }
    return { ...entry, stats };
  });
  return { anime, statsDefaults };
};

/**
 * @param {Array<Record<string, any>>} animeList Runtime index entries.
 * @returns {{ anime: Array<Record<string, any>>, colorIndexFromPosition: boolean }}
 */
const compactCatalogColorIndex = (animeList = []) => {
  const list = Array.isArray(animeList) ? animeList : [];
  let omitted = false;
  const anime = list.map((entry, index) => {
    if (!isPlainObject(entry) || entry.colorIndex !== index) return entry;
    omitted = true;
    const { colorIndex, ...rest } = entry;
    return rest;
  });
  return { anime: omitted ? anime : list, colorIndexFromPosition: omitted };
};

const expandCatalogColorIndex = (payload) => {
  if (payload?.[COLOR_INDEX_KEY] !== true || !Array.isArray(payload.anime)) return;
  payload.anime.forEach((anime, index) => {
    if (isPlainObject(anime) && !hasOwn(anime, 'colorIndex')) anime.colorIndex = index;
  });
  delete payload[COLOR_INDEX_KEY];
};

/**
 * Restores omitted stats values (and position color indexes) in place. Payloads without `statsDefaults`
 * (embedded data, the raw dev catalog, older caches) are returned unchanged.
 * @template T
 * @param {T} payload
 * @returns {T}
 */
const expandCatalogStats = (payload) => {
  expandCatalogColorIndex(payload);
  const statsDefaults = payload?.[STATS_DEFAULTS_KEY];
  if (!isPlainObject(statsDefaults) || !Array.isArray(payload?.anime)) return payload;

  // Read the defaults once; the loop below runs for every title in the catalog.
  const defaults = Object.entries(statsDefaults).map(([key, value]) => ({
    key,
    value,
    isObject: value !== null && typeof value === 'object',
    nested: NESTED_STATS_KEYS.includes(key) && isPlainObject(value)
      ? Object.entries(value).map(([nestedKey, nestedValue]) => ({
        key: nestedKey,
        value: nestedValue,
        isObject: nestedValue !== null && typeof nestedValue === 'object'
      }))
      : null
  }));

  for (const anime of payload.anime) {
    if (!isPlainObject(anime?.stats)) continue;
    const stats = anime.stats;
    for (const entry of defaults) {
      if (entry.nested) {
        const current = stats[entry.key];
        if (current !== undefined && !isPlainObject(current)) continue;
        const nested = isPlainObject(current) ? current : {};
        for (const nestedEntry of entry.nested) {
          if (!hasOwn(nested, nestedEntry.key)) {
            nested[nestedEntry.key] = nestedEntry.isObject ? cloneValue(nestedEntry.value) : nestedEntry.value;
          }
        }
        stats[entry.key] = nested;
      } else if (!hasOwn(stats, entry.key)) {
        stats[entry.key] = entry.isObject ? cloneValue(entry.value) : entry.value;
      }
    }
  }
  delete payload[STATS_DEFAULTS_KEY];
  return payload;
};

export {
  COLOR_INDEX_KEY,
  STATS_DEFAULTS_KEY,
  compactCatalogColorIndex,
  compactCatalogStats,
  expandCatalogStats
};
