// @ts-nocheck
const TASTE_PROFILE_STORAGE_KEY = 'rekonime.tasteProfile';
const TASTE_PROFILE_VERSION = 1;
const DISCOVERY_TASTE_SCORE_SCALE = 10;

const emptyProfile = () => ({
  version: TASTE_PROFILE_VERSION,
  updatedAt: 0,
  explicit: {
    moreLikeTitleIds: [],
    notForMeTitleIds: [],
    preferredGenres: [],
    preferredThemes: [],
    reducedGenres: [],
    reducedThemes: []
  },
  inferred: {
    positiveGenres: [],
    positiveThemes: [],
    negativeGenres: [],
    negativeThemes: []
  }
});

const normalizeId = (value) => String(value || '').trim();
const normalizeTag = (value) => String(value || '').trim();

const unique = (values = []) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = normalizeTag(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
};

const normalizeEvidence = (values = []) => {
  const evidence = new Map();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const label = normalizeTag(value?.label ?? value);
    if (!label) return;
    const key = label.toLowerCase();
    const weight = Number.isFinite(value?.weight) ? value.weight : 0;
    const current = evidence.get(key);
    if (!current || weight > current.weight) evidence.set(key, { label, weight });
  });
  return [...evidence.values()];
};

const normalizeProfile = (value) => {
  const profile = emptyProfile();
  if (!value || typeof value !== 'object') return profile;
  profile.version = TASTE_PROFILE_VERSION;
  profile.updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
  profile.explicit.moreLikeTitleIds = unique(value.explicit?.moreLikeTitleIds).map(normalizeId).filter(Boolean);
  profile.explicit.notForMeTitleIds = unique(value.explicit?.notForMeTitleIds).map(normalizeId).filter(Boolean);
  profile.explicit.preferredGenres = unique(value.explicit?.preferredGenres);
  profile.explicit.preferredThemes = unique(value.explicit?.preferredThemes);
  profile.explicit.reducedGenres = unique(value.explicit?.reducedGenres);
  profile.explicit.reducedThemes = unique(value.explicit?.reducedThemes);
  profile.inferred.positiveGenres = normalizeEvidence(value.inferred?.positiveGenres);
  profile.inferred.positiveThemes = normalizeEvidence(value.inferred?.positiveThemes);
  profile.inferred.negativeGenres = normalizeEvidence(value.inferred?.negativeGenres);
  profile.inferred.negativeThemes = normalizeEvidence(value.inferred?.negativeThemes);
  return profile;
};

const readStorageJSON = (storage, key) => {
  try {
    if (typeof storage?.getJSON === 'function') return storage.getJSON(key, { fallback: null, validate: true });
    if (typeof storage?.getItem === 'function') {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const readStorageRaw = (storage, key) => {
  try {
    if (typeof storage?.getRaw === 'function') {
      return storage.getRaw(key, { fallback: '', allowMemory: false, validate: false }) || null;
    }
    if (typeof storage?.getItem === 'function') return storage.getItem(key) || null;
  } catch (error) {
    return null;
  }
  return null;
};

const restoreStorageRaw = (storage, key, raw) => {
  try {
    if (raw === null) {
      storage?.removeItem?.(key);
      return readStorageRaw(storage, key) === null;
    }
    if (typeof storage?.setRaw === 'function') return storage.setRaw(key, raw, { validate: false });
    if (typeof storage?.setItem === 'function') return storage.setItem(key, raw) !== false;
  } catch (error) {
    return false;
  }
  return false;
};

const writeStorageJSON = (storage, key, payload) => {
  try {
    if (typeof storage?.setJSON === 'function') return storage.setJSON(key, payload, { validate: true });
    if (typeof storage?.setItem === 'function') {
      return storage.setItem(key, JSON.stringify(payload)) !== false;
    }
  } catch (error) {
    return false;
  }
  return false;
};

const createLocalStorageAdapter = () => ({
  getItem: (key) => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: (key) => typeof localStorage === 'undefined' ? undefined : localStorage.removeItem(key)
});

const addUnique = (values, value) => unique([...values, value]);
const removeValue = (values, value) => {
  const target = normalizeTag(value).toLowerCase();
  return unique(values).filter(item => item.toLowerCase() !== target);
};

const countTags = (target, values = [], weight = 1) => {
  values.forEach((value) => {
    const tag = normalizeTag(value);
    if (!tag) return;
    const key = tag.toLowerCase();
    const current = target.get(key) || { label: tag, weight: 0 };
    current.weight += weight;
    target.set(key, current);
  });
};

const topEvidence = (map) => [...map.values()]
  .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
  .slice(0, 6);

const buildTasteProfileFromWatchlist = (entries: unknown[] = []) => {
  const positiveGenres = new Map();
  const positiveThemes = new Map();
  const negativeGenres = new Map();
  const negativeThemes = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const snapshot = entry?.snapshot || {};
    const genres = Array.isArray(snapshot.genres) ? snapshot.genres : [];
    const themes = Array.isArray(snapshot.themes) ? snapshot.themes : [];
    if (entry?.loved === true) {
      countTags(positiveGenres, genres, 5);
      countTags(positiveThemes, themes, 5);
      return;
    }
    if (entry?.status === 'completed') {
      countTags(positiveGenres, genres, 3);
      countTags(positiveThemes, themes, 3);
    } else if (entry?.status === 'watching') {
      countTags(positiveGenres, genres, 1);
      countTags(positiveThemes, themes, 1);
    } else if (entry?.status === 'dropped') {
      countTags(negativeGenres, genres, 3);
      countTags(negativeThemes, themes, 3);
    }
  });

  return {
    positiveGenres: topEvidence(positiveGenres),
    positiveThemes: topEvidence(positiveThemes),
    negativeGenres: topEvidence(negativeGenres),
    negativeThemes: topEvidence(negativeThemes)
  };
};

const scoreAnimeForTaste = (anime, profile) => {
  const normalized = normalizeProfile(profile);
  const genres = new Set((Array.isArray(anime?.genres) ? anime.genres : []).map(value => normalizeTag(value).toLowerCase()));
  const themes = new Set((Array.isArray(anime?.themes) ? anime.themes : []).map(value => normalizeTag(value).toLowerCase()));
  const id = normalizeId(anime?.id);
  let score = 0;

  if (normalized.explicit.moreLikeTitleIds.includes(id)) score += 15;
  if (normalized.explicit.notForMeTitleIds.includes(id)) score -= 1000;
  normalized.explicit.preferredGenres.forEach(tag => { if (genres.has(tag.toLowerCase())) score += 8; });
  normalized.explicit.preferredThemes.forEach(tag => { if (themes.has(tag.toLowerCase())) score += 6; });
  normalized.explicit.reducedGenres.forEach(tag => { if (genres.has(tag.toLowerCase())) score -= 10; });
  normalized.explicit.reducedThemes.forEach(tag => { if (themes.has(tag.toLowerCase())) score -= 8; });
  normalized.inferred.positiveGenres.forEach(item => { if (genres.has(item.label.toLowerCase())) score += Math.min(item.weight, 10); });
  normalized.inferred.positiveThemes.forEach(item => { if (themes.has(item.label.toLowerCase())) score += Math.min(item.weight, 8); });
  normalized.inferred.negativeGenres.forEach(item => { if (genres.has(item.label.toLowerCase())) score -= Math.min(item.weight, 10); });
  normalized.inferred.negativeThemes.forEach(item => { if (themes.has(item.label.toLowerCase())) score -= Math.min(item.weight, 8); });
  return score;
};

const createTasteProfileStore = ({
  storage = createLocalStorageAdapter(),
  storageKey = TASTE_PROFILE_STORAGE_KEY,
  now = Date.now
} = {}) => {
  let profile = emptyProfile();

  const save = (nextProfile = profile) => {
    profile = normalizeProfile({ ...nextProfile, updatedAt: now() });
    writeStorageJSON(storage, storageKey, profile);
    return profile;
  };

  const commitProfile = (nextProfile) => {
    const normalized = normalizeProfile({ ...nextProfile, updatedAt: now() });
    if (!writeStorageJSON(storage, storageKey, normalized)) {
      writeStorageJSON(storage, storageKey, profile);
      return false;
    }
    profile = normalized;
    return true;
  };

  const restorePersistedRaw = (raw) => {
    if (!restoreStorageRaw(storage, storageKey, raw)) return false;
    load();
    return true;
  };

  const load = () => {
    profile = normalizeProfile(readStorageJSON(storage, storageKey));
    return profile;
  };

  const reset = (watchlistEntries = []) => save({
    ...emptyProfile(),
    inferred: buildTasteProfileFromWatchlist(watchlistEntries)
  });

  const update = (mapper) => save(mapper(normalizeProfile(profile)));

  const addMoreLike = (anime) => update((current) => ({
    ...current,
    explicit: {
      ...current.explicit,
      moreLikeTitleIds: addUnique(current.explicit.moreLikeTitleIds, anime?.id),
      preferredGenres: unique([...current.explicit.preferredGenres, ...(anime?.genres || []).slice(0, 2)]),
      preferredThemes: unique([...current.explicit.preferredThemes, ...(anime?.themes || []).slice(0, 2)]),
      notForMeTitleIds: removeValue(current.explicit.notForMeTitleIds, anime?.id)
    }
  }));

  const addNotForMe = (anime) => update((current) => ({
    ...current,
    explicit: {
      ...current.explicit,
      notForMeTitleIds: addUnique(current.explicit.notForMeTitleIds, anime?.id),
      moreLikeTitleIds: removeValue(current.explicit.moreLikeTitleIds, anime?.id)
    }
  }));

  const reduceGenre = (genre) => update((current) => ({
    ...current,
    explicit: {
      ...current.explicit,
      reducedGenres: addUnique(current.explicit.reducedGenres, genre),
      preferredGenres: removeValue(current.explicit.preferredGenres, genre)
    }
  }));

  const reduceTheme = (theme) => update((current) => ({
    ...current,
    explicit: {
      ...current.explicit,
      reducedThemes: addUnique(current.explicit.reducedThemes, theme),
      preferredThemes: removeValue(current.explicit.preferredThemes, theme)
    }
  }));

  const applyRecommendationFeedback = (action, anime, { genre = '', theme = '' } = {}) => {
    if (!anime) return { changed: false, message: '' };
    if (action === 'rec-more-like') {
      addMoreLike(anime);
      return { changed: true, message: `More like ${anime.title} added to your Taste Profile.` };
    }
    if (action === 'rec-not-for-me') {
      addNotForMe(anime);
      return { changed: true, message: `${anime.title} hidden from recommendations.` };
    }
    if (action === 'rec-less-tag' && genre) {
      reduceGenre(genre);
      return { changed: true, message: `Showing less ${genre}.` };
    }
    if (action === 'rec-less-tag' && theme) {
      reduceTheme(theme);
      return { changed: true, message: `Showing less ${theme}.` };
    }
    return { changed: false, message: '' };
  };

  const prepareTasteCandidates = (animeList, { excludedIds = [] } = {}) => {
    const excluded = new Set([
      ...excludedIds,
      ...normalizeProfile(profile).explicit.notForMeTitleIds
    ].map(normalizeId).filter(Boolean));
    return (Array.isArray(animeList) ? animeList : [])
      .filter(anime => !excluded.has(normalizeId(anime?.id)))
      .map((anime, index) => ({ anime, index, tasteScore: scoreAnimeForTaste(anime, profile) }))
      .sort((left, right) => right.tasteScore - left.tasteScore || left.index - right.index);
  };

  const prepareRecommendationSource = (animeList, options = {}) => (
    prepareTasteCandidates(animeList, options).map(entry => ({
      ...entry.anime,
      tasteScore: entry.tasteScore
    }))
  );

  const prepareDiscoverySource = (animeList, options = {}) => (
    prepareTasteCandidates(animeList, options).map(entry => ({
      anime: entry.anime,
      weight: Math.max(0.1, 1 + (entry.tasteScore / DISCOVERY_TASTE_SCORE_SCALE))
    }))
  );

  const getSettingsSummary = () => {
    const normalized = normalizeProfile(profile);
    return {
      preferredTags: unique([
        ...normalized.explicit.preferredGenres,
        ...normalized.explicit.preferredThemes
      ]),
      reducedTags: unique([
        ...normalized.explicit.reducedGenres,
        ...normalized.explicit.reducedThemes
      ]),
      inferredTags: unique([
        ...normalized.inferred.positiveGenres.map(item => item.label),
        ...normalized.inferred.positiveThemes.map(item => item.label)
      ]).slice(0, 6),
      hiddenCount: normalized.explicit.notForMeTitleIds.length
    };
  };

  const store = {
    load,
    commitProfile,
    getPersistedRaw: () => readStorageRaw(storage, storageKey),
    restorePersistedRaw,
    reset,
    getProfile: () => normalizeProfile(profile),
    updateInferredFromWatchlist: (entries) => update((current) => ({
      ...current,
      inferred: buildTasteProfileFromWatchlist(entries)
    })),
    exportData: (watchlistEntries = []) => ({
      version: 1,
      generatedAt: new Date(now()).toISOString(),
      tasteProfile: normalizeProfile(profile),
      watchlist: Array.isArray(watchlistEntries) ? watchlistEntries : []
    }),
    applyRecommendationFeedback,
    prepareRecommendationSource,
    prepareDiscoverySource,
    getSettingsSummary
  };

  return store;
};

export {
  TASTE_PROFILE_STORAGE_KEY,
  TASTE_PROFILE_VERSION,
  normalizeProfile,
  buildTasteProfileFromWatchlist,
  scoreAnimeForTaste,
  createTasteProfileStore
};
