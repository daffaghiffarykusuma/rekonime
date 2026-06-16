// @ts-nocheck
const TASTE_PROFILE_STORAGE_KEY = 'rekonime.tasteProfile';
const TASTE_PROFILE_VERSION = 1;

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

const normalizeEvidence = (values = []) => unique(values)
  .map((label) => ({ label, weight: 0 }))
  .filter(item => item.label);

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

const writeStorageJSON = (storage, key, payload) => {
  try {
    if (typeof storage?.setJSON === 'function') return storage.setJSON(key, payload, { validate: true });
    if (typeof storage?.setItem === 'function') {
      storage.setItem(key, JSON.stringify(payload));
      return true;
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
  }
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

const buildTasteProfileFromWatchlist = (entries = []) => {
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

  const load = () => {
    profile = normalizeProfile(readStorageJSON(storage, storageKey));
    return profile;
  };

  const reset = () => save(emptyProfile());

  const update = (mapper) => save(mapper(normalizeProfile(profile)));

  return {
    load,
    save,
    reset,
    getProfile: () => normalizeProfile(profile),
    replaceProfile: (nextProfile) => save(nextProfile),
    addMoreLike: (anime) => update((current) => ({
      ...current,
      explicit: {
        ...current.explicit,
        moreLikeTitleIds: addUnique(current.explicit.moreLikeTitleIds, anime?.id),
        preferredGenres: unique([...current.explicit.preferredGenres, ...(anime?.genres || []).slice(0, 2)]),
        preferredThemes: unique([...current.explicit.preferredThemes, ...(anime?.themes || []).slice(0, 2)]),
        notForMeTitleIds: removeValue(current.explicit.notForMeTitleIds, anime?.id)
      }
    })),
    addNotForMe: (anime) => update((current) => ({
      ...current,
      explicit: {
        ...current.explicit,
        notForMeTitleIds: addUnique(current.explicit.notForMeTitleIds, anime?.id),
        moreLikeTitleIds: removeValue(current.explicit.moreLikeTitleIds, anime?.id)
      }
    })),
    reduceGenre: (genre) => update((current) => ({
      ...current,
      explicit: {
        ...current.explicit,
        reducedGenres: addUnique(current.explicit.reducedGenres, genre),
        preferredGenres: removeValue(current.explicit.preferredGenres, genre)
      }
    })),
    reduceTheme: (theme) => update((current) => ({
      ...current,
      explicit: {
        ...current.explicit,
        reducedThemes: addUnique(current.explicit.reducedThemes, theme),
        preferredThemes: removeValue(current.explicit.preferredThemes, theme)
      }
    })),
    updateInferredFromWatchlist: (entries) => update((current) => ({
      ...current,
      inferred: buildTasteProfileFromWatchlist(entries)
    })),
    getExcludedIds: () => new Set(normalizeProfile(profile).explicit.notForMeTitleIds),
    exportData: (watchlistEntries = []) => ({
      version: 1,
      generatedAt: new Date(now()).toISOString(),
      tasteProfile: normalizeProfile(profile),
      watchlist: Array.isArray(watchlistEntries) ? watchlistEntries : []
    }),
    importData: (payload) => {
      const nextProfile = payload?.tasteProfile || payload;
      return save(nextProfile);
    }
  };
};

export {
  TASTE_PROFILE_STORAGE_KEY,
  TASTE_PROFILE_VERSION,
  normalizeProfile,
  buildTasteProfileFromWatchlist,
  scoreAnimeForTaste,
  createTasteProfileStore
};
