// Compacts the runtime catalog index by moving the most common value of each
// stats field into one payload-level `statsDefaults` object. The build omits
// values equal to their default, and the loader restores them, so consumers
// always see complete stats objects.
//
// A field is only compacted when every title defines it, so a field that is
// genuinely absent can never be mistaken for one that was omitted.

const STATS_DEFAULTS_KEY = 'statsDefaults';
const NESTED_STATS_KEYS = ['ratingEvidence'];

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cloneValue = (value) => (value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);
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
 * Restores omitted stats values in place. Payloads without `statsDefaults`
 * (embedded data, the raw dev catalog, older caches) are returned unchanged.
 * @template T
 * @param {T} payload
 * @returns {T}
 */
const expandCatalogStats = (payload) => {
  const statsDefaults = payload?.[STATS_DEFAULTS_KEY];
  if (!isPlainObject(statsDefaults) || !Array.isArray(payload?.anime)) return payload;

  for (const anime of payload.anime) {
    if (!isPlainObject(anime?.stats)) continue;
    const stats = anime.stats;
    for (const [key, value] of Object.entries(statsDefaults)) {
      if (NESTED_STATS_KEYS.includes(key) && isPlainObject(value)) {
        if (stats[key] !== undefined && !isPlainObject(stats[key])) continue;
        const nested = isPlainObject(stats[key]) ? stats[key] : {};
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (!hasOwn(nested, nestedKey)) nested[nestedKey] = cloneValue(nestedValue);
        }
        stats[key] = nested;
      } else if (!hasOwn(stats, key)) {
        stats[key] = cloneValue(value);
      }
    }
  }
  delete payload[STATS_DEFAULTS_KEY];
  return payload;
};

export {
  STATS_DEFAULTS_KEY,
  compactCatalogStats,
  expandCatalogStats
};
