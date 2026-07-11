import type {
  Snapshot,
  WatchlistControlModel,
  WatchlistDisplayModel,
  WatchlistEntry,
  WatchlistPersistedPayload,
  WatchlistTransitionEnvelope,
  WatchlistTransitionResult,
  WatchlistUpdatedEventPayload
} from '../../js/contracts/watchlist-lifecycle.ts';

const snapshot: Snapshot = {
  id: 'show-1',
  title: 'Show 1',
  titleEnglish: '',
  titleJapanese: '',
  malId: 1,
  anilistId: 2,
  cover: 'cover.jpg',
  year: 2026,
  season: 'Spring',
  studio: 'Studio',
  type: 'TV',
  source: 'Manga',
  demographic: 'Shounen',
  genres: ['Comedy'],
  themes: ['School'],
  communityScore: 7.5,
  stats: {
    retentionScore: 76,
    threeEpisodeHook: 80,
    churnRisk: { score: 8 },
    worthFinishing: 44,
    flowState: 100,
    comfortScore: 97,
    episodeCount: 12
  }
};

const entry: WatchlistEntry = {
  id: 'show-1',
  status: 'watching',
  progress: 3,
  updatedAt: 1770000000000,
  startedAt: 1770000000000,
  snapshot
};

const persisted: WatchlistPersistedPayload = {
  version: 1,
  updatedAt: 1770000000000,
  entries: [entry]
};

const transitionResult: WatchlistTransitionResult = {
  changed: true,
  id: 'show-1',
  entry,
  removed: false,
  operation: 'progress',
  previousEntry: { ...entry, progress: 2 },
  statusChanged: false,
  progressChanged: true
};

const controlModel: WatchlistControlModel = {
  status: 'watching',
  progress: 3,
  showProgress: true,
  episodeCount: 12,
  inputMax: '12',
  totalText: 'of 12',
  options: [{
    value: 'watching',
    label: 'Watching now',
    selected: true
  }]
};

const displayModel: WatchlistDisplayModel = {
  entries: [entry],
  visibleEntries: [entry],
  displayItems: [snapshot],
  allDisplayItems: [snapshot],
  counts: {
    all: 1,
    planned: 0,
    watching: 1,
    completed: 0,
    dropped: 0
  }
};

const eventPayload: WatchlistUpdatedEventPayload = {
  id: 'show-1',
  status: 'watching',
  progress: 3,
  removed: false,
  entry,
  snapshot
};

const transitionEnvelope: WatchlistTransitionEnvelope = {
  changed: true,
  id: 'show-1',
  entry,
  removed: false,
  operation: 'progress',
  previousEntry: transitionResult.previousEntry ?? null,
  statusChanged: false,
  progressChanged: true,
  feedback: null,
  event: {
    name: 'rekonime:watchlist-updated',
    payload: eventPayload
  },
  render: {
    controls: {
      shouldUpdate: true,
      id: 'show-1',
      entry
    },
    watchlist: {
      shouldRender: false,
      entries: null,
      visibleEntries: null,
      displayItems: null,
      allDisplayItems: null,
      counts: null
    }
  },
  dashboard: {
    shouldSchedule: false,
    timeout: null
  },
  compatibilityResult: { entry }
};

void persisted;
void transitionResult;
void controlModel;
void displayModel;
void transitionEnvelope;
