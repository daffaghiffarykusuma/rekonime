const WATCH_STATUS_VALUES = ['planned', 'watching', 'completed', 'dropped'];
const WATCH_STATUS_DISPLAY_OPTIONS = [
  { value: '', label: 'Not saved' },
  { value: 'planned', label: 'Want to watch' },
  { value: 'watching', label: 'Watching now' },
  { value: 'completed', label: 'Finished' },
  { value: 'dropped', label: 'Stopped' }
];
const WATCHLIST_STORAGE_KEY = 'rekonime.watchlist';
const LEGACY_WATCHLIST_STORAGE_KEY = 'rekonime.bookmarks';
const WATCHLIST_VERSION = 1;
const DEFAULT_PLACEHOLDER_COVER = 'https://via.placeholder.com/120x170?text=No+Image';

const normalizeWatchStatus = (value, { fallback = 'planned' } = {}) => {
  const status = String(value || '').trim().toLowerCase();
  if (WATCH_STATUS_VALUES.includes(status)) {
    return status;
  }
  return fallback;
};

const normalizeWatchProgress = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const normalizeWatchId = (value) => String(value || '').trim();

const normalizeWatchTimestamp = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const normalizeSnapshotStats = (stats) => {
  if (!stats || typeof stats !== 'object') return null;
  return {
    retentionScore: Number.isFinite(stats.retentionScore) ? stats.retentionScore : null,
    threeEpisodeHook: Number.isFinite(stats.threeEpisodeHook) ? stats.threeEpisodeHook : null,
    churnRisk: stats.churnRisk && Number.isFinite(stats.churnRisk.score)
      ? { score: stats.churnRisk.score }
      : null,
    worthFinishing: Number.isFinite(stats.worthFinishing) ? stats.worthFinishing : null,
    flowState: Number.isFinite(stats.flowState) ? stats.flowState : null,
    comfortScore: Number.isFinite(stats.comfortScore) ? stats.comfortScore : null,
    episodeCount: Number.isFinite(stats.episodeCount) ? stats.episodeCount : null
  };
};

const buildAnimeSnapshot = (anime, { placeholderCover = '', requireCover = true } = {}) => {
  if (!anime) return null;
  const id = normalizeWatchId(anime.id);
  if (!id) return null;
  const cover = String(anime.cover || '').trim() || placeholderCover;
  if (requireCover && !cover) return null;
  return {
    id,
    title: String(anime.title || 'Unknown title'),
    titleEnglish: anime.titleEnglish || '',
    titleJapanese: anime.titleJapanese || '',
    malId: Number.isFinite(Number(anime.malId)) ? Number(anime.malId) : null,
    anilistId: Number.isFinite(Number(anime.anilistId)) ? Number(anime.anilistId) : null,
    cover,
    year: anime.year || null,
    season: anime.season || '',
    studio: anime.studio || '',
    type: anime.type || '',
    source: anime.source || '',
    demographic: anime.demographic || '',
    genres: Array.isArray(anime.genres) ? [...anime.genres] : [],
    themes: Array.isArray(anime.themes) ? [...anime.themes] : [],
    communityScore: Number.isFinite(anime.communityScore) ? anime.communityScore : null,
    stats: normalizeSnapshotStats(anime.stats || anime.statsSnapshot || null)
  };
};

const normalizeWatchlistSnapshot = (item, { fallbackId = '', placeholderCover = '', requireCover = true } = {}) => {
  if (!item || typeof item !== 'object') return null;
  const id = normalizeWatchId(item.id || fallbackId);
  if (!id) return null;
  const cover = String(item.cover || '').trim() || placeholderCover;
  if (requireCover && !cover) return null;
  return {
    id,
    title: String(item.title || '').trim() || 'Unknown title',
    titleEnglish: item.titleEnglish || '',
    titleJapanese: item.titleJapanese || '',
    malId: Number.isFinite(Number(item.malId)) ? Number(item.malId) : null,
    anilistId: Number.isFinite(Number(item.anilistId)) ? Number(item.anilistId) : null,
    cover,
    year: item.year || null,
    season: item.season || '',
    studio: item.studio || '',
    type: item.type || '',
    source: item.source || '',
    demographic: item.demographic || '',
    genres: Array.isArray(item.genres) ? [...item.genres] : [],
    themes: Array.isArray(item.themes) ? [...item.themes] : [],
    communityScore: Number.isFinite(item.communityScore) ? item.communityScore : null,
    stats: normalizeSnapshotStats(item.stats || item.statsSnapshot || null)
  };
};

const buildWatchlistEntry = ({
  id,
  status,
  progress,
  updatedAt,
  startedAt,
  completedAt,
  snapshot
} = {}, options = {}) => {
  const key = normalizeWatchId(id);
  if (!key) return null;
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  const entry = {
    id: key,
    status: normalizeWatchStatus(status),
    progress: normalizeWatchProgress(progress),
    updatedAt: normalizeWatchTimestamp(updatedAt) || now
  };

  const started = normalizeWatchTimestamp(startedAt);
  if (started) entry.startedAt = started;

  const completed = normalizeWatchTimestamp(completedAt);
  if (completed) entry.completedAt = completed;

  const normalizedSnapshot = normalizeWatchlistSnapshot(snapshot, {
    fallbackId: key,
    placeholderCover: options.placeholderCover || '',
    requireCover: options.requireCover !== false
  });
  if (normalizedSnapshot) {
    entry.snapshot = normalizedSnapshot;
  }

  return entry;
};

const createLocalStorageAdapter = () => ({
  getJSON(key) {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  },
  getRaw(key) {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(key) || '';
  },
  setJSON(key, payload) {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  },
  removeItem(key) {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  }
});

const readStorageJSON = (storage, key, { validate = true } = {}) => {
  if (!storage) return null;
  try {
    if (typeof storage.getJSON === 'function') {
      return storage.getJSON(key, { fallback: null, validate });
    }
    if (typeof storage.getItem === 'function') {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (error) {
    return null;
  }
  return null;
};

const readStorageRaw = (storage, key) => {
  if (!storage) return '';
  try {
    if (typeof storage.getRaw === 'function') {
      return storage.getRaw(key, { fallback: '', allowMemory: false, validate: false }) || '';
    }
    if (typeof storage.getItem === 'function') {
      return storage.getItem(key) || '';
    }
  } catch (error) {
    return '';
  }
  return '';
};

const writeStorageJSON = (storage, key, payload) => {
  if (!storage) return false;
  try {
    if (typeof storage.setJSON === 'function') {
      return storage.setJSON(key, payload, { validate: true });
    }
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, JSON.stringify(payload));
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
};

const removeStorageItem = (storage, key) => {
  if (!storage) return false;
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(key);
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
};

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const createAnimeLookup = (animeItems = []) => Array.isArray(animeItems)
  ? new Map(animeItems.map((anime) => [normalizeWatchId(anime?.id), anime]).filter(([id]) => id))
  : new Map();

const getEpisodeCount = (anime) => {
  const direct = Number(anime?.stats?.episodeCount ?? anime?.episodeCount ?? anime?.episodesTotal);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  if (!Array.isArray(anime?.episodes) || anime.episodes.length === 0) return null;
  const maxEpisode = anime.episodes.reduce((highest, entry, index) => {
    const candidate = Number(entry?.episode);
    if (Number.isFinite(candidate) && candidate > 0) return Math.max(highest, Math.floor(candidate));
    return Math.max(highest, index + 1);
  }, 0);
  return maxEpisode > 0 ? maxEpisode : null;
};

const buildWatchlistControlModel = (entry, { anime, episodeCount } = {}) => {
  const status = normalizeWatchStatus(entry?.status, { fallback: '' });
  const progress = normalizeWatchProgress(entry?.progress);
  const total = Number.isFinite(episodeCount) && episodeCount > 0
    ? Math.floor(episodeCount)
    : getEpisodeCount(anime);
  return {
    status,
    progress,
    showProgress: shouldShowWatchProgress(status),
    episodeCount: total,
    inputMax: total ? String(total) : '',
    totalText: total ? `of ${total}` : '',
    options: WATCH_STATUS_DISPLAY_OPTIONS.map((option) => ({
      ...option,
      selected: option.value === status
    }))
  };
};

const getWatchlistStatus = (entry) => normalizeWatchStatus(entry?.status, { fallback: 'planned' });

const buildWatchlistCounts = (entries = []) => {
  const counts = {
    all: Array.isArray(entries) ? entries.length : 0,
    planned: 0,
    watching: 0,
    completed: 0,
    dropped: 0
  };

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const status = getWatchlistStatus(entry);
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  });

  return counts;
};

const filterWatchlistEntries = (entries = [], statusFilter = 'all') => {
  const normalizedFilter = String(statusFilter || 'all').trim().toLowerCase();
  if (normalizedFilter === 'all') return Array.isArray(entries) ? [...entries] : [];
  const status = normalizeWatchStatus(normalizedFilter, { fallback: '' });
  if (!status) return [];
  return (Array.isArray(entries) ? entries : []).filter((entry) => getWatchlistStatus(entry) === status);
};

const getDisplayItemForEntry = (entry, lookup, placeholder = DEFAULT_PLACEHOLDER_COVER) => {
  const id = normalizeWatchId(entry?.id);
  const anime = lookup instanceof Map ? lookup.get(id) : null;
  if (anime) return anime;
  const snapshot = normalizeWatchlistSnapshot(entry?.snapshot, {
    fallbackId: id,
    placeholderCover: placeholder,
    requireCover: false
  });
  if (snapshot) return snapshot;
  return {
    id: id || 'unknown',
    title: entry?.snapshot?.title || 'Unknown title',
    cover: entry?.snapshot?.cover || placeholder,
    year: entry?.snapshot?.year || null,
    studio: entry?.snapshot?.studio || '',
    communityScore: Number.isFinite(entry?.snapshot?.communityScore) ? entry.snapshot.communityScore : null,
    stats: entry?.snapshot?.stats || null,
    genres: Array.isArray(entry?.snapshot?.genres) ? [...entry.snapshot.genres] : [],
    themes: Array.isArray(entry?.snapshot?.themes) ? [...entry.snapshot.themes] : []
  };
};

const buildWatchlistDisplayModel = (entries = [], animeItems = [], {
  statusFilter = 'all',
  placeholder = DEFAULT_PLACEHOLDER_COVER
} = {}) => {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const lookup = createAnimeLookup(animeItems);
  const visibleEntries = filterWatchlistEntries(normalizedEntries, statusFilter);
  return {
    entries: normalizedEntries,
    visibleEntries,
    displayItems: visibleEntries.map((entry) => getDisplayItemForEntry(entry, lookup, placeholder)),
    allDisplayItems: normalizedEntries.map((entry) => getDisplayItemForEntry(entry, lookup, placeholder)),
    counts: buildWatchlistCounts(normalizedEntries)
  };
};

const buildWatchlistUpdatePayload = (result = {}) => {
  const entry = result.entry || null;
  const id = normalizeWatchId(result.id || entry?.id);
  const payload = {
    id,
    removed: Boolean(result.removed)
  };
  if (entry) {
    payload.status = entry.status;
    payload.progress = entry.progress;
    payload.entry = entry;
    if (entry.snapshot) payload.snapshot = entry.snapshot;
  }
  return payload;
};

const buildWatchlistTransitionEnvelope = (result = {}, {
  eventName = 'rekonime:watchlist-updated',
  renderMode,
  dashboardTimeout = null
} = {}) => {
  const changed = Boolean(result.changed);
  const entry = result.entry || null;
  const id = normalizeWatchId(result.id || entry?.id);
  const removed = Boolean(result.removed);
  const operation = result.operation || (removed ? 'remove' : 'unknown');
  const previousEntry = result.previousEntry || null;
  const statusChanged = Boolean(
    result.statusChanged ||
    (previousEntry && entry && previousEntry.status !== entry.status) ||
    (removed && previousEntry)
  );
  const progressChanged = Boolean(
    result.progressChanged ||
    (previousEntry && entry && previousEntry.progress !== entry.progress)
  );
  const resolvedRenderMode = renderMode || (operation === 'status' || removed ? 'watchlist' : 'controls');

  return {
    changed,
    id,
    entry,
    removed,
    operation,
    previousEntry,
    statusChanged,
    progressChanged,
    event: changed ? {
      name: eventName,
      payload: buildWatchlistUpdatePayload(result)
    } : null,
    render: {
      controls: {
        shouldUpdate: changed && Boolean(id),
        id,
        entry
      },
      watchlist: {
        shouldRender: changed && resolvedRenderMode === 'watchlist',
        entries: result.entries || null,
        visibleEntries: result.visibleEntries || null,
        displayItems: result.displayItems || null,
        allDisplayItems: result.allDisplayItems || null,
        counts: result.counts || null
      }
    },
    dashboard: {
      shouldSchedule: changed && Number.isFinite(dashboardTimeout),
      timeout: Number.isFinite(dashboardTimeout) ? dashboardTimeout : null
    },
    compatibilityResult: removed ? { removed: true } : (entry ? { entry } : result)
  };
};

const createWatchlistLifecycle = ({
  storage = createLocalStorageAdapter(),
  storageKey = WATCHLIST_STORAGE_KEY,
  legacyStorageKey = LEGACY_WATCHLIST_STORAGE_KEY,
  version = WATCHLIST_VERSION,
  placeholderCover = '',
  now = Date.now,
  entries
} = {}) => {
  let watchlistEntries = entries instanceof Map ? entries : new Map();

  const options = () => ({
    now,
    placeholderCover,
    requireCover: !placeholderCover
  });

  const getStoragePayload = () => {
    const normalizedEntries = [];
    watchlistEntries.forEach((entry, id) => {
      const next = buildWatchlistEntry(entry, options());
      if (next) {
        normalizedEntries.push(next);
        watchlistEntries.set(id, next);
      }
    });
    return {
      version,
      updatedAt: now(),
      entries: normalizedEntries
    };
  };

  const save = () => {
    const payload = getStoragePayload();
    const saved = writeStorageJSON(storage, storageKey, payload);
    if (saved) return true;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  };

  const load = () => {
    watchlistEntries = new Map();
    const parsed = readStorageJSON(storage, storageKey, { validate: true });
    if (!parsed) {
      const raw = readStorageRaw(storage, storageKey);
      if (raw && typeof raw === 'string' && !raw.trim().startsWith('{') && !raw.trim().startsWith('[')) {
        removeStorageItem(storage, storageKey);
      }
    }
    const storedEntries = Array.isArray(parsed?.entries)
      ? parsed.entries
      : (Array.isArray(parsed) ? parsed : []);

    storedEntries.forEach((entry) => {
      const normalized = buildWatchlistEntry(entry, options());
      if (!normalized || watchlistEntries.has(normalized.id)) return;
      watchlistEntries.set(normalized.id, normalized);
    });
    return watchlistEntries;
  };

  const setEntries = (nextEntries) => {
    watchlistEntries = nextEntries instanceof Map ? nextEntries : new Map();
    return watchlistEntries;
  };

  const getLegacyPayload = () => {
    const parsed = readStorageJSON(storage, legacyStorageKey, { validate: false });
    if (!parsed) return null;
    const ids = [];
    const items = [];

    if (Array.isArray(parsed)) {
      ids.push(...parsed);
    } else if (isPlainObject(parsed)) {
      if (Array.isArray(parsed.ids)) ids.push(...parsed.ids);
      if (Array.isArray(parsed.items)) items.push(...parsed.items);
    }

    const uniqueIds = [];
    const seen = new Set();
    ids.forEach((id) => {
      const key = normalizeWatchId(id);
      if (!key || seen.has(key)) return;
      seen.add(key);
      uniqueIds.push(key);
    });

    const itemMap = new Map();
    items.forEach((item) => {
      const normalized = normalizeWatchlistSnapshot(item, {
        placeholderCover,
        requireCover: !placeholderCover
      });
      if (!normalized || itemMap.has(normalized.id)) return;
      itemMap.set(normalized.id, normalized);
    });

    if (uniqueIds.length === 0 && itemMap.size > 0) {
      uniqueIds.push(...itemMap.keys());
    }
    return { ids: uniqueIds, items: itemMap };
  };

  const migrateLegacy = () => {
    const legacy = getLegacyPayload();
    if (!legacy || legacy.ids.length === 0) return { changed: false, removedLegacy: false };
    let changed = false;

    legacy.ids.forEach((id) => {
      if (watchlistEntries.has(id)) {
        const existing = watchlistEntries.get(id);
        const snapshot = legacy.items.get(id);
        if (existing && !existing.snapshot && snapshot) {
          watchlistEntries.set(id, { ...existing, snapshot });
          changed = true;
        }
        return;
      }
      const entry = buildWatchlistEntry({
        id,
        status: 'planned',
        progress: 0,
        snapshot: legacy.items.get(id) || null
      }, options());
      if (!entry) return;
      watchlistEntries.set(id, entry);
      changed = true;
    });

    legacy.items.forEach((snapshot, id) => {
      if (watchlistEntries.has(id)) return;
      const entry = buildWatchlistEntry({ id, status: 'planned', progress: 0, snapshot }, options());
      if (!entry) return;
      watchlistEntries.set(id, entry);
      changed = true;
    });

    if (changed) save();
    const removedLegacy = removeStorageItem(storage, legacyStorageKey);
    return { changed, removedLegacy };
  };

  const getEntry = (animeId) => watchlistEntries.get(normalizeWatchId(animeId)) || null;

  const getEntries = ({ statuses } = {}) => {
    const filter = Array.isArray(statuses) && statuses.length > 0
      ? new Set(statuses.map((status) => normalizeWatchStatus(status)))
      : null;
    return [...watchlistEntries.values()].filter((entry) => !filter || filter.has(entry.status));
  };

  const getIds = ({ statuses } = {}) => getEntries({ statuses }).map((entry) => entry.id);

  const getSnapshots = ({ statuses } = {}) => getEntries({ statuses })
    .map((entry) => normalizeWatchlistSnapshot(entry.snapshot, {
      fallbackId: entry.id,
      placeholderCover,
      requireCover: !placeholderCover
    }))
    .filter(Boolean);

  const ensureEntry = (animeId, { status = 'planned', progress = 0, snapshot = null } = {}) => {
    const key = normalizeWatchId(animeId);
    if (!key || watchlistEntries.has(key)) return { changed: false, entry: getEntry(key), id: key, operation: 'ensure' };
    const entry = buildWatchlistEntry({ id: key, status, progress, snapshot }, options());
    if (!entry) return { changed: false, entry: null, id: key, operation: 'ensure' };
    watchlistEntries.set(key, entry);
    save();
    return {
      changed: true,
      entry,
      id: key,
      removed: false,
      operation: 'ensure',
      previousEntry: null,
      statusChanged: true,
      progressChanged: normalizeWatchProgress(progress) > 0
    };
  };

  const removeEntry = (animeId) => {
    const key = normalizeWatchId(animeId);
    if (!key || !watchlistEntries.has(key)) return { changed: false, removed: false, id: key, operation: 'remove' };
    const previousEntry = watchlistEntries.get(key) || null;
    watchlistEntries.delete(key);
    save();
    return {
      changed: true,
      removed: true,
      id: key,
      operation: 'remove',
      previousEntry,
      statusChanged: Boolean(previousEntry),
      progressChanged: false
    };
  };

  const setStatus = (animeId, status, { episodeCount, snapshot } = {}) => {
    const key = normalizeWatchId(animeId);
    if (!key) return { changed: false, entry: null, id: key, operation: 'status' };
    const rawStatus = String(status || '').trim().toLowerCase();
    if (!rawStatus) return removeEntry(key);

    const nextStatus = normalizeWatchStatus(rawStatus);
    const timestamp = now();
    const current = watchlistEntries.get(key);
    const previousEntry = current ? { ...current } : null;
    let entry = current
      ? { ...current, status: nextStatus, updatedAt: timestamp }
      : buildWatchlistEntry({ id: key, status: nextStatus, progress: 0, updatedAt: timestamp, snapshot }, options());

    if (!entry) return { changed: false, entry: null, id: key, operation: 'status' };

    if (nextStatus === 'planned') {
      entry.progress = 0;
      delete entry.startedAt;
      delete entry.completedAt;
    } else {
      if (!entry.startedAt) entry.startedAt = timestamp;
      if (nextStatus === 'completed') {
        entry.completedAt = timestamp;
        if (Number.isFinite(episodeCount) && episodeCount > 0) {
          entry.progress = Math.max(normalizeWatchProgress(entry.progress), episodeCount);
        }
      } else {
        delete entry.completedAt;
      }
    }

    if (!entry.snapshot) {
      const normalizedSnapshot = normalizeWatchlistSnapshot(snapshot, {
        fallbackId: key,
        placeholderCover,
        requireCover: !placeholderCover
      });
      if (normalizedSnapshot) entry.snapshot = normalizedSnapshot;
    }

    watchlistEntries.set(key, entry);
    save();
    return {
      changed: true,
      entry,
      removed: false,
      id: key,
      operation: 'status',
      previousEntry,
      statusChanged: previousEntry ? previousEntry.status !== entry.status : true,
      progressChanged: previousEntry ? previousEntry.progress !== entry.progress : normalizeWatchProgress(entry.progress) > 0
    };
  };

  const setProgress = (animeId, progress, { episodeCount, snapshot } = {}) => {
    const key = normalizeWatchId(animeId);
    if (!key) return { changed: false, entry: null, id: key, operation: 'progress' };
    const timestamp = now();
    const normalized = normalizeWatchProgress(progress);
    const maxEpisodes = Number.isFinite(episodeCount) && episodeCount > 0 ? episodeCount : null;
    const clamped = maxEpisodes ? Math.min(normalized, maxEpisodes) : normalized;

    let entry = watchlistEntries.get(key);
    const previousEntry = entry ? { ...entry } : null;
    if (!entry) {
      entry = buildWatchlistEntry({
        id: key,
        status: 'watching',
        progress: clamped,
        updatedAt: timestamp,
        startedAt: timestamp,
        snapshot
      }, options());
    } else {
      entry = { ...entry, progress: clamped, updatedAt: timestamp };
      if (entry.status === 'planned' && clamped > 0) {
        entry.status = 'watching';
        if (!entry.startedAt) entry.startedAt = timestamp;
      }
      if (!entry.snapshot) {
        const normalizedSnapshot = normalizeWatchlistSnapshot(snapshot, {
          fallbackId: key,
          placeholderCover,
          requireCover: !placeholderCover
        });
        if (normalizedSnapshot) entry.snapshot = normalizedSnapshot;
      }
    }

    if (!entry) return { changed: false, entry: null, id: key, operation: 'progress' };
    if (entry.status === 'completed' && maxEpisodes && clamped >= maxEpisodes) {
      entry.completedAt = entry.completedAt || timestamp;
    }

    watchlistEntries.set(key, entry);
    save();
    return {
      changed: true,
      entry,
      removed: false,
      id: key,
      operation: 'progress',
      previousEntry,
      statusChanged: previousEntry ? previousEntry.status !== entry.status : true,
      progressChanged: previousEntry ? previousEntry.progress !== entry.progress : normalizeWatchProgress(entry.progress) > 0
    };
  };

  const adjustProgress = (animeId, delta, { episodeCount, snapshot } = {}) => {
    const key = normalizeWatchId(animeId);
    if (!key) return { changed: false, entry: null, id: key, operation: 'progress' };
    const entry = watchlistEntries.get(key);
    const current = Number.isFinite(entry?.progress) ? entry.progress : 0;
    return setProgress(key, current + (Number(delta) || 0), { episodeCount, snapshot });
  };

  const refreshSnapshotsFromCatalog = (animeItems = [], { persist = false, replaceExisting = true } = {}) => {
    if (watchlistEntries.size === 0) return false;
    const lookup = createAnimeLookup(animeItems);
    let updated = false;

    watchlistEntries.forEach((entry, id) => {
      if (entry?.snapshot && !replaceExisting) return;
      const anime = lookup.get(id);
      if (!anime) return;
      const snapshot = buildAnimeSnapshot(anime, options());
      if (!snapshot) return;
      if (entry.snapshot && areWatchlistSnapshotsEqual(entry.snapshot, snapshot)) return;
      watchlistEntries.set(id, { ...entry, snapshot });
      updated = true;
    });

    if (updated && persist) save();
    return updated;
  };

  const getAnimeItems = (animeItems = [], { statuses } = {}) => {
    const lookup = createAnimeLookup(animeItems);
    return getIds({ statuses }).map((id) => lookup.get(id)).filter(Boolean);
  };

  const getDisplayItems = (animeItems = [], {
    statuses,
    placeholder = placeholderCover || DEFAULT_PLACEHOLDER_COVER
  } = {}) => {
    const lookup = createAnimeLookup(animeItems);
    return getEntries({ statuses }).map((entry) => {
      const anime = lookup.get(entry.id);
      if (anime) return anime;
      const snapshot = normalizeWatchlistSnapshot(entry.snapshot, {
        fallbackId: entry.id,
        placeholderCover: placeholder,
        requireCover: false
      });
      if (snapshot) return snapshot;
      return {
        id: entry.id,
        title: entry?.snapshot?.title || 'Unknown title',
        cover: entry?.snapshot?.cover || placeholder,
        year: entry?.snapshot?.year || null,
        studio: entry?.snapshot?.studio || '',
        communityScore: Number.isFinite(entry?.snapshot?.communityScore) ? entry.snapshot.communityScore : null,
        stats: entry?.snapshot?.stats || null,
        genres: Array.isArray(entry?.snapshot?.genres) ? [...entry.snapshot.genres] : [],
        themes: Array.isArray(entry?.snapshot?.themes) ? [...entry.snapshot.themes] : []
      };
    });
  };

  return {
    get entries() {
      return watchlistEntries;
    },
    setEntries,
    load,
    save,
    getStoragePayload,
    getLegacyPayload,
    migrateLegacy,
    getEntry,
    getEntries,
    getIds,
    getSnapshots,
    getAnimeItems,
    getDisplayItems,
    ensureEntry,
    removeEntry,
    setStatus,
    setProgress,
    adjustProgress,
    refreshSnapshotsFromCatalog
  };
};

const areWatchlistSnapshotsEqual = (left, right) => {
  if (!left || !right) return false;
  return left.id === right.id &&
    left.title === right.title &&
    left.cover === right.cover &&
    left.year === right.year &&
    left.studio === right.studio &&
    left.communityScore === right.communityScore &&
    left.malId === right.malId &&
    left.anilistId === right.anilistId;
};

const shouldShowWatchProgress = (status) => {
  return status === 'watching' || status === 'completed' || status === 'dropped';
};

export {
  WATCH_STATUS_VALUES,
  WATCH_STATUS_DISPLAY_OPTIONS,
  WATCHLIST_STORAGE_KEY,
  LEGACY_WATCHLIST_STORAGE_KEY,
  WATCHLIST_VERSION,
  normalizeWatchStatus,
  normalizeWatchProgress,
  normalizeWatchId,
  normalizeWatchTimestamp,
  normalizeSnapshotStats,
  buildAnimeSnapshot,
  normalizeWatchlistSnapshot,
  buildWatchlistEntry,
  buildWatchlistControlModel,
  buildWatchlistCounts,
  filterWatchlistEntries,
  buildWatchlistDisplayModel,
  buildWatchlistUpdatePayload,
  buildWatchlistTransitionEnvelope,
  areWatchlistSnapshotsEqual,
  shouldShowWatchProgress,
  createLocalStorageAdapter,
  createWatchlistLifecycle
};
