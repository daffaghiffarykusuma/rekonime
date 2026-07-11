export type WatchStatus = 'planned' | 'watching' | 'completed' | 'dropped';

export type WatchStatusControlValue = '' | WatchStatus;

export type WatchlistOperation = 'ensure' | 'remove' | 'status' | 'progress' | 'unknown';

export interface SnapshotStats {
  retentionScore: number | null;
  threeEpisodeHook: number | null;
  churnRisk: { score: number } | null;
  worthFinishing: number | null;
  flowState: number | null;
  comfortScore: number | null;
  episodeCount: number | null;
}

export interface Snapshot {
  id: string;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  malId?: number | null;
  anilistId?: number | null;
  cover: string;
  year?: number | null;
  season?: string;
  studio?: string;
  type?: string;
  source?: string;
  demographic?: string;
  genres?: string[];
  themes?: string[];
  communityScore?: number | null;
  stats?: SnapshotStats | null;
}

export interface WatchlistEntry {
  id: string;
  status: WatchStatus;
  progress: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  snapshot?: Snapshot;
}

export interface WatchlistPersistedPayload {
  version: number;
  updatedAt: number;
  entries: WatchlistEntry[];
}

export interface WatchlistLegacyPayload {
  ids: string[];
  items: Map<string, Snapshot>;
}

export interface WatchlistTransitionResult {
  changed: boolean;
  id: string;
  entry?: WatchlistEntry | null;
  removed?: boolean;
  operation: WatchlistOperation;
  previousEntry?: WatchlistEntry | null;
  statusChanged?: boolean;
  progressChanged?: boolean;
  entries?: WatchlistEntry[] | null;
  visibleEntries?: WatchlistEntry[] | null;
  displayItems?: WatchlistDisplayItem[] | null;
  allDisplayItems?: WatchlistDisplayItem[] | null;
  counts?: WatchlistCounts | null;
}

export interface WatchlistStatusOption {
  value: WatchStatusControlValue;
  label: string;
  selected?: boolean;
}

export interface WatchlistControlModel {
  status: WatchStatusControlValue;
  progress: number;
  showProgress: boolean;
  episodeCount: number | null;
  inputMax: string;
  totalText: string;
  options: WatchlistStatusOption[];
}

export type WatchlistDisplayItem = Snapshot;

export interface WatchlistCounts {
  all: number;
  planned: number;
  watching: number;
  completed: number;
  dropped: number;
}

export interface WatchlistDisplayModel {
  entries: WatchlistEntry[];
  visibleEntries: WatchlistEntry[];
  displayItems: WatchlistDisplayItem[];
  allDisplayItems: WatchlistDisplayItem[];
  counts: WatchlistCounts;
}

export interface WatchlistUpdatedEventPayload {
  id: string;
  status?: WatchStatus;
  progress?: number;
  removed: boolean;
  entry?: WatchlistEntry;
  snapshot?: Snapshot;
}

export interface WatchlistTransitionEnvelope {
  changed: boolean;
  id: string;
  entry: WatchlistEntry | null;
  removed: boolean;
  operation: WatchlistOperation;
  previousEntry: WatchlistEntry | null;
  statusChanged: boolean;
  progressChanged: boolean;
  feedback: {
    message: string;
    action: { label: string; href: string } | null;
  } | null;
  event: {
    name: 'rekonime:watchlist-updated';
    payload: WatchlistUpdatedEventPayload;
  } | null;
  render: {
    controls: {
      shouldUpdate: boolean;
      id: string;
      entry: WatchlistEntry | null;
    };
    watchlist: {
      shouldRender: boolean;
      entries: WatchlistEntry[] | null;
      visibleEntries: WatchlistEntry[] | null;
      displayItems: WatchlistDisplayItem[] | null;
      allDisplayItems: WatchlistDisplayItem[] | null;
      counts: WatchlistCounts | null;
    };
  };
  dashboard: {
    shouldSchedule: boolean;
    timeout: number | null;
  };
  compatibilityResult: { removed: true } | { entry: WatchlistEntry } | WatchlistTransitionResult;
}

export interface WatchlistLifecycleEventMap {
  'rekonime:watchlist-updated': WatchlistUpdatedEventPayload;
}
