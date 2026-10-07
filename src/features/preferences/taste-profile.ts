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
  const feedbackReceipts = new Map();
  let nextReceipt = 0;
  let persistedRaw = readStorageRaw(storage, storageKey);

  const save = (nextProfile = profile) => {
    feedbackReceipts.clear();
    profile = normalizeProfile({ ...nextProfile, updatedAt: now() });
    writeStorageJSON(storage, storageKey, { ...profile, inferred: undefined });
    persistedRaw = readStorageRaw(storage, storageKey);
    return profile;
  };

  const commitProfile = (nextProfile) => {
    const normalized = normalizeProfile({ ...nextProfile, updatedAt: now() });
    if (!writeStorageJSON(storage, storageKey, { ...normalized, inferred: undefined })) {
      writeStorageJSON(storage, storageKey, { ...profile, inferred: undefined });
      return false;
    }
    profile = normalized;
    persistedRaw = readStorageRaw(storage, storageKey);
    return true;
  };

  const restorePersistedRaw = (raw) => {
    if (!restoreStorageRaw(storage, storageKey, raw)) return false;
    load();
    return true;
  };

  const load = () => {
    feedbackReceipts.clear();
    const saved = readStorageJSON(storage, storageKey);
    persistedRaw = readStorageRaw(storage, storageKey);
    profile = normalizeProfile(saved && { ...saved, inferred: undefined });
    return profile;
  };

  const reset = (watchlistEntries = []) => save({
    ...emptyProfile(),
    inferred: buildTasteProfileFromWatchlist(watchlistEntries)
  });

  const proposeEvidence = (updates) => {
    const next = normalizeProfile(profile);
    const touched = [];
    updates.forEach(([field, value, present]) => {
      next.explicit[field] = present
        ? addUnique(next.explicit[field], value)
        : removeValue(next.explicit[field], value);
      // Even an already-present value represents newer intent for Undo safety.
      touched.push(`${field}:${normalizeTag(value).toLowerCase()}`);
    });
    return { next, touched };
  };

  const addMoreLike = (anime) => proposeEvidence([
    ['moreLikeTitleIds', anime.id, true],
    ['notForMeTitleIds', anime.id, false],
    ...(anime.genres || []).slice(0, 2).map(value => ['preferredGenres', value, true]),
    ...(anime.themes || []).slice(0, 2).map(value => ['preferredThemes', value, true])
  ]);

  const addNotForMe = (anime) => proposeEvidence([
    ['notForMeTitleIds', anime.id, true],
    ['moreLikeTitleIds', anime.id, false]
  ]);

  const reduceGenre = (genre) => proposeEvidence([
    ['reducedGenres', genre, true], ['preferredGenres', genre, false]
  ]);

  const reduceTheme = (theme) => proposeEvidence([
    ['reducedThemes', theme, true], ['preferredThemes', theme, false]
  ]);

  const applyRecommendationFeedback = (action, anime, { genre = '', theme = '' } = {}) => {
    if (!anime) return { changed: false, message: '' };
    if (readStorageRaw(storage, storageKey) !== persistedRaw) {
      const inferred = profile.inferred;
      load();
      profile.inferred = inferred;
    }
    let proposal;
    let message;
    if (action === 'rec-more-like') {
      proposal = addMoreLike(anime);
      message = `More like ${anime.title} added to your Taste Profile.`;
    } else if (action === 'rec-not-for-me') {
      proposal = addNotForMe(anime);
      message = `${anime.title} hidden from future recommendations. This preference stays saved.`;
    } else if (action === 'rec-less-tag' && genre) {
      proposal = reduceGenre(genre);
      message = `Showing less ${genre}.`;
    } else if (action === 'rec-less-tag' && theme) {
      proposal = reduceTheme(theme);
      message = `Showing less ${theme}.`;
    } else {
      return { changed: false, message: '' };
    }
    const { next, touched } = proposal;
    const changes = [];
    Object.keys(profile.explicit).forEach(field => {
      const before = profile.explicit[field];
      const after = next.explicit[field];
      unique([...before, ...after]).forEach(value => {
        const had = before.some(item => item.toLowerCase() === value.toLowerCase());
        const has = after.some(item => item.toLowerCase() === value.toLowerCase());
        if (had !== has) changes.push({ field, value, before: had, after: has });
      });
    });
    if (!commitProfile(next)) return { changed: false, message: "Couldn't save your taste preference. Try again." };
    feedbackReceipts.forEach(receipt => {
      if (receipt.changes.some(change => touched.includes(`${change.field}:${change.value.toLowerCase()}`))) receipt.conflicted = true;
    });
    const undoToken = ++nextReceipt;
    feedbackReceipts.set(undoToken, { changes, conflicted: false });
    return { changed: true, message, undoToken };
  };

  const undoRecommendationFeedback = (undoToken) => {
    if (readStorageRaw(storage, storageKey) !== persistedRaw) {
      const inferred = profile.inferred;
      load();
      profile.inferred = inferred;
      return { changed: false, message: 'Your taste preferences changed. Undo was not applied.' };
    }
    const receipt = feedbackReceipts.get(undoToken);
    if (!receipt) return { changed: false, message: 'This preference can no longer be undone.' };
    if (receipt.conflicted) return { changed: false, message: 'Your taste preferences changed. Undo was not applied.' };
    const { changes } = receipt;
    const next = normalizeProfile(profile);
    for (const change of changes) {
      const values = next.explicit[change.field];
      const has = values.some(value => value.toLowerCase() === change.value.toLowerCase());
      if (has !== change.after) return { changed: false, message: 'Your taste preferences changed. Undo was not applied.' };
      next.explicit[change.field] = change.before ? addUnique(values, change.value) : removeValue(values, change.value);
    }
    if (!commitProfile(next)) return { changed: false, message: "Couldn't save Undo. Try again." };
    feedbackReceipts.delete(undoToken);
    return { changed: true, message: 'Taste preference undone.' };
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
      tasteScore: entry.tasteScore,
      tasteReason: entry.tasteScore > 0 ? getTasteReason(entry.anime) : ''
    }))
  );

  const getTasteReason = (anime) => {
    const tags = new Set([...(anime.genres || []), ...(anime.themes || [])].map(tag => tag.toLowerCase()));
    const matches = values => values.find(tag => tags.has(tag.toLowerCase()));
    const explicitTag = matches([...profile.explicit.preferredGenres, ...profile.explicit.preferredThemes]);
    if (explicitTag) return `Matches your preference for ${explicitTag}`;
    if (profile.explicit.moreLikeTitleIds.includes(anime.id)) return 'You asked for more like this title';
    const inferredTag = matches([...profile.inferred.positiveGenres, ...profile.inferred.positiveThemes].map(item => item.label));
    return inferredTag ? `${inferredTag}, based on your watchlist` : '';
  };

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
    commitProfile: (next) => {
      if (!commitProfile(next)) return false;
      feedbackReceipts.clear();
      return true;
    },
    getPersistedRaw: () => readStorageRaw(storage, storageKey),
    restorePersistedRaw,
    reset,
    getProfile: () => normalizeProfile(profile),
    updateInferredFromWatchlist: (entries) => {
      profile = { ...profile, inferred: buildTasteProfileFromWatchlist(entries) };
      return profile;
    },
    exportData: (watchlistEntries = []) => ({
      version: 1,
      generatedAt: new Date(now()).toISOString(),
      tasteProfile: normalizeProfile(profile),
      watchlist: Array.isArray(watchlistEntries) ? watchlistEntries : []
    }),
    applyRecommendationFeedback,
    undoRecommendationFeedback,
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
