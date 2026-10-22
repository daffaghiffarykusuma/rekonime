import { buildTasteProfileFromWatchlist, normalizeProfile } from './taste-profile.ts';
import {
  WATCH_STATUS_VALUES,
  buildWatchlistEntry
} from '../watchlist/watchlist-state.js';
import type { WatchlistEntry as WatchlistEntryContract } from '../watchlist/contracts/watchlist-lifecycle.ts';
import { MAX_IMPORT_ROWS, MAX_IMPORT_STRING_LENGTH, MAX_PROFILE_ITEMS, MAX_SNAPSHOT_TAGS } from '../../shared/security/import-limits.ts';

const EXPORT_VERSION = 1;
const MAX_WATCHLIST_ENTRIES = MAX_IMPORT_ROWS;
const RESTORE_JOURNAL_KEY = 'rekonime.personalDataRestoreJournal';

type RecordValue = Record<string, unknown>;
type WatchlistEntry = WatchlistEntryContract;
type RestoreFailureReason =
  | 'invalid_file'
  | 'unsupported_version'
  | 'invalid_profile'
  | 'invalid_watchlist'
  | 'storage_failure'
  | 'rollback_failure';

type TasteProfileStore = {
  commitProfile: (profile: unknown) => boolean;
  getPersistedRaw: () => string | null;
  restorePersistedRaw: (raw: string | null) => boolean;
};

type WatchlistLifecycle = {
  getEntries: () => WatchlistEntry[];
  commitEntries: (entries: Map<string, WatchlistEntry>) => boolean;
  getPersistedRaw: () => string | null;
  restorePersistedRaw: (raw: string | null) => boolean;
};

type JournalStorage = {
  getJSON: (key: string, options?: RecordValue) => unknown;
  setJSON: (key: string, value: unknown, options?: RecordValue) => boolean;
  removeItem: (key: string) => unknown;
};

type RestoreResult =
  | { ok: true; mode: 'full' | 'profile-only'; watchlistCount: number }
  | { ok: false; reason: RestoreFailureReason };

type RestorePlan = {
  mode: 'full' | 'profile-only';
  profile: RecordValue;
  watchlistEntries: Map<string, WatchlistEntry> | null;
};

type RestoreJournal = {
  version: 1;
  tasteProfileRaw: string | null;
  watchlistRaw: string | null;
};

const isRecord = (value: unknown): value is RecordValue => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value: RecordValue, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const isSupportedVersion = (value: unknown) => value === undefined || value === EXPORT_VERSION;

const isBoundedString = (value: unknown): value is string => (
  typeof value === 'string' && value.length <= MAX_IMPORT_STRING_LENGTH
);
const explicitFields = new Set(['moreLikeTitleIds', 'notForMeTitleIds', 'preferredGenres', 'preferredThemes', 'reducedGenres', 'reducedThemes']);
const inferredFields = new Set(['positiveGenres', 'positiveThemes', 'negativeGenres', 'negativeThemes']);

const hasValidProfileShape = (value: unknown): value is RecordValue => {
  if (!isRecord(value) || !isSupportedVersion(value.version)) return false;
  if (hasOwn(value, 'explicit') && !isRecord(value.explicit)) return false;
  if (hasOwn(value, 'inferred') && !isRecord(value.inferred)) return false;
  const sections = ['explicit', 'inferred'].filter(key => isRecord(value[key]));
  if (sections.length === 0) return false;

  for (const section of sections) {
    for (const [key, field] of Object.entries(value[section] as RecordValue)) {
      if (!(section === 'explicit' ? explicitFields : inferredFields).has(key) ||
          !Array.isArray(field) || field.length > MAX_PROFILE_ITEMS) return false;
      if (!field.every(item => isBoundedString(item) || (section === 'inferred' && isRecord(item) &&
          isBoundedString(item.label) && Number.isFinite(item.weight)))) return false;
    }
  }
  return true;
};

const hasValidSnapshotShape = (snapshot: RecordValue) => {
  if (!['id', 'title', 'cover'].every(key => isBoundedString(snapshot[key]) && snapshot[key].trim())) return false;
  if (!['titleEnglish', 'titleJapanese', 'season', 'studio', 'type', 'source', 'demographic']
    .every(key => !hasOwn(snapshot, key) || isBoundedString(snapshot[key]))) return false;
  if (hasOwn(snapshot, 'year') && snapshot.year !== null &&
      !(Number.isSafeInteger(snapshot.year) || (isBoundedString(snapshot.year) && /^\d{4}$/.test(snapshot.year)))) return false;
  if (!['malId', 'anilistId'].every(key => !hasOwn(snapshot, key) || snapshot[key] === null ||
      (Number.isSafeInteger(snapshot[key]) && Number(snapshot[key]) > 0))) return false;
  if (!['genres', 'themes'].every(key => !hasOwn(snapshot, key) || (Array.isArray(snapshot[key]) &&
      snapshot[key].length <= MAX_SNAPSHOT_TAGS && snapshot[key].every(isBoundedString)))) return false;
  if (hasOwn(snapshot, 'communityScore') && snapshot.communityScore !== null && !Number.isFinite(snapshot.communityScore)) return false;
  for (const key of ['stats', 'statsSnapshot']) {
    const stats = snapshot[key];
    if (!hasOwn(snapshot, key) || stats === null) continue;
    if (!isRecord(stats)) return false;
    if (!['retentionScore', 'threeEpisodeHook', 'worthFinishing', 'flowState', 'comfortScore', 'episodeCount']
      .every(field => !hasOwn(stats, field) || stats[field] === null || Number.isFinite(stats[field]))) return false;
    if (hasOwn(stats, 'churnRisk') && stats.churnRisk !== null &&
        (!isRecord(stats.churnRisk) || !Number.isFinite(stats.churnRisk.score))) return false;
  }
  return true;
};

const hasValidOptionalTimestamp = (entry: RecordValue, key: string) => (
  !hasOwn(entry, key) || (Number.isFinite(entry[key]) && Number(entry[key]) > 0)
);

const normalizeRestoreEntry = (value: unknown): WatchlistEntry | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!id || !isBoundedString(value.id) || typeof value.status !== 'string' || !WATCH_STATUS_VALUES.includes(value.status)) return null;
  if (!Number.isSafeInteger(value.progress) || Number(value.progress) < 0) return null;
  if (!Number.isFinite(value.updatedAt) || Number(value.updatedAt) <= 0) return null;
  if (!hasValidOptionalTimestamp(value, 'startedAt') ||
      !hasValidOptionalTimestamp(value, 'completedAt') ||
      !hasValidOptionalTimestamp(value, 'lovedAt')) return null;
  if (hasOwn(value, 'loved') && typeof value.loved !== 'boolean') return null;

  if (hasOwn(value, 'snapshot')) {
    const snapshot = value.snapshot;
    if (!isRecord(snapshot) || !hasValidSnapshotShape(snapshot) ||
        String(snapshot.id || '').trim() !== id ||
        !String(snapshot.title || '').trim() ||
        !String(snapshot.cover || '').trim()) return null;
  }

  const normalized = buildWatchlistEntry(value, {
    now: () => Number(value.updatedAt),
    requireCover: true
  }) as WatchlistEntry | null;
  return normalized?.id === id ? normalized : null;
};

const buildRestorePlan = (payload: unknown): RestorePlan | RestoreResult => {
  if (!isRecord(payload)) return { ok: false, reason: 'invalid_file' };

  const isFullExport = hasOwn(payload, 'tasteProfile') || hasOwn(payload, 'watchlist') || hasOwn(payload, 'generatedAt');
  if (!isSupportedVersion(payload.version)) return { ok: false, reason: 'unsupported_version' };

  if (!isFullExport) {
    if (!hasValidProfileShape(payload)) return { ok: false, reason: 'invalid_profile' };
    return { mode: 'profile-only', profile: payload, watchlistEntries: null };
  }

  if (payload.version !== EXPORT_VERSION) return { ok: false, reason: 'invalid_file' };
  if (!hasValidProfileShape(payload.tasteProfile)) return { ok: false, reason: 'invalid_profile' };
  if (!Array.isArray(payload.watchlist) || payload.watchlist.length > MAX_WATCHLIST_ENTRIES) {
    return { ok: false, reason: 'invalid_watchlist' };
  }

  const entries = new Map<string, WatchlistEntry>();
  for (const value of payload.watchlist) {
    const entry = normalizeRestoreEntry(value);
    if (!entry || entries.has(entry.id)) return { ok: false, reason: 'invalid_watchlist' };
    entries.set(entry.id, entry);
  }

  return { mode: 'full', profile: payload.tasteProfile, watchlistEntries: entries };
};

const toEntryMap = (entries: WatchlistEntry[]) => new Map(
  entries.map(entry => [entry.id, entry])
);

const isRestoreJournal = (value: unknown): value is RestoreJournal => (
  isRecord(value) &&
  value.version === 1 &&
  (value.tasteProfileRaw === null || typeof value.tasteProfileRaw === 'string') &&
  (value.watchlistRaw === null || typeof value.watchlistRaw === 'string')
);

const clearRestoreJournal = (storage: JournalStorage) => {
  storage.removeItem(RESTORE_JOURNAL_KEY);
  return storage.getJSON(RESTORE_JOURNAL_KEY, { fallback: null, allowRaw: true, validate: false }) === null;
};

const recoverPendingPersonalDataRestore = (
  storage: JournalStorage,
  { tasteProfileStore, watchlistLifecycle }: {
    tasteProfileStore: TasteProfileStore;
    watchlistLifecycle: WatchlistLifecycle;
  }
) => {
  const value = storage.getJSON(RESTORE_JOURNAL_KEY, {
    fallback: null,
    allowRaw: true,
    validate: false
  });
  if (value === null) return { ok: true, recovered: false } as const;
  if (!isRestoreJournal(value)) return { ok: false, recovered: false } as const;

  const tasteRestored = tasteProfileStore.restorePersistedRaw(value.tasteProfileRaw);
  const watchlistRestored = watchlistLifecycle.restorePersistedRaw(value.watchlistRaw);
  const cleared = tasteRestored && watchlistRestored && clearRestoreJournal(storage);
  return { ok: cleared, recovered: cleared } as const;
};

const beginRestoreJournal = (
  storage: JournalStorage,
  tasteProfileStore: TasteProfileStore,
  watchlistLifecycle: WatchlistLifecycle
) => {
  const journal: RestoreJournal = {
    version: 1,
    tasteProfileRaw: tasteProfileStore.getPersistedRaw(),
    watchlistRaw: watchlistLifecycle.getPersistedRaw()
  };
  const saved = storage.setJSON(RESTORE_JOURNAL_KEY, journal, { validate: false });
  if (!saved) clearRestoreJournal(storage);
  return saved;
};

const restorePersonalData = (
  payload: unknown,
  {
    tasteProfileStore,
    watchlistLifecycle,
    storage
  }: {
    tasteProfileStore: TasteProfileStore;
    watchlistLifecycle: WatchlistLifecycle;
    storage: JournalStorage;
  }
): RestoreResult => {
  const owners = { tasteProfileStore, watchlistLifecycle };
  const recovery = recoverPendingPersonalDataRestore(storage, owners);
  if (!recovery.ok) return { ok: false, reason: 'rollback_failure' };

  const plan = buildRestorePlan(payload);
  if ('ok' in plan) return plan;

  const previousEntries = toEntryMap(watchlistLifecycle.getEntries());
  const evidenceEntries = plan.watchlistEntries
    ? [...plan.watchlistEntries.values()]
    : [...previousEntries.values()];
  const nextProfile = normalizeProfile({
    ...plan.profile,
    inferred: buildTasteProfileFromWatchlist(evidenceEntries)
  });

  if (plan.watchlistEntries && !beginRestoreJournal(storage, tasteProfileStore, watchlistLifecycle)) {
    return { ok: false, reason: 'storage_failure' };
  }

  const rollback = (): RestoreResult => {
    const result = recoverPendingPersonalDataRestore(storage, owners);
    return result.ok
      ? { ok: false, reason: 'storage_failure' }
      : { ok: false, reason: 'rollback_failure' };
  };

  if (plan.watchlistEntries && !watchlistLifecycle.commitEntries(plan.watchlistEntries)) {
    return rollback();
  }

  if (!tasteProfileStore.commitProfile(nextProfile)) {
    if (plan.watchlistEntries) {
      return rollback();
    }
    return { ok: false, reason: 'storage_failure' };
  }

  if (plan.watchlistEntries && !clearRestoreJournal(storage)) return rollback();

  return {
    ok: true,
    mode: plan.mode,
    watchlistCount: plan.watchlistEntries?.size || 0
  };
};

export {
  recoverPendingPersonalDataRestore,
  restorePersonalData
};
