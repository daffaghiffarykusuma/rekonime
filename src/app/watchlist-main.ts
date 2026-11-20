// @ts-nocheck
import { IMAGE_PLACEHOLDER } from '../shared/runtime/image-placeholder.js';
import { updateBackupStatus } from '../features/preferences/backup-status.ts';
import { SidebarPreference } from '../shared/ui/sidebar-preference.ts';
import { Logger } from '../shared/services/logger.ts';
import { initDeferredRuntimeServices } from './bootstrap/deferred-runtime.js';
import { createImageProxyRuntime } from '../shared/runtime/image-proxy-runtime.js';
import { sanitizeImageUrl as sanitizeSafeImageUrl } from '../shared/security/urlSanitizer.ts';
import { createWatchlistAiringDashboardAdapter } from '../features/watchlist/watchlist-airing-dashboard-adapter.ts';
import {
  createWatchlistLifecycle
} from '../features/watchlist/watchlist-state.js';
import { createWatchlistLifecycleRuntime } from '../features/watchlist/watchlist-lifecycle-runtime.ts';
import {
  updateWatchlistControlsElement,
  getEpisodeCountFromCard as getPresentationEpisodeCountFromCard
} from '../features/watchlist/watchlist-entry-presentation.ts';
import { createWatchlistPageInteractions } from '../features/watchlist/watchlist-page-interactions.ts';
import { createWatchlistPageRenderer } from '../features/watchlist/watchlist-page-renderer.ts';
import { createWatchlistPageRuntime } from '../features/watchlist/watchlist-page-runtime.ts';
import { feedbackToastOptions, showToast } from '../shared/ui/toast.ts';
import './bootstrap/watchlist-cover-preload.js';

const PLACEHOLDER_COVER = IMAGE_PLACEHOLDER;
const CARD_DIMENSIONS = { width: 240, height: 360 };
const ALLOWED_IMAGE_HOSTS = [
  'cdn.myanimelist.net',
  'myanimelist.cdn-dena.com',
  'via.placeholder.com',
  'images.weserv.nl'
];
const IMAGE_PROXY_STATUS_KEY = 'rekonime.imageProxyStatus';
const IMAGE_PROXY_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
const IMAGE_PROXY_CHECK_TIMEOUT_MS = 2500;
const DEFERRED_SERVICES_TIMEOUT_MS = 2000;
const IMAGE_PROXY_IDLE_TIMEOUT_MS = 2000;

let appInitPromise = null;
let loadedApp = null;
let applyingOwnTransition = false;
let currentWatchlistFilter = 'all';
let watchlistAiringDashboardAdapter = null;
let watchlistPageInteractions = null;
let watchlistPageRenderer = null;
let watchlistPageRuntime = null;
let watchlistLifecycleRuntime = null;
const imageProxyRuntime = createImageProxyRuntime({
  storageKey: IMAGE_PROXY_STATUS_KEY,
  ttlMs: IMAGE_PROXY_STATUS_TTL_MS,
  timeoutMs: IMAGE_PROXY_CHECK_TIMEOUT_MS,
  waitForLoad: false,
  sanitizeImageUrl: (value) => sanitizeImageUrl(value),
  dimensions: { card: CARD_DIMENSIONS }
});

const getWatchlistLifecycle = () => createWatchlistLifecycle({
  placeholderCover: PLACEHOLDER_COVER
});

const initNonCriticalServices = () => {
  initDeferredRuntimeServices({
    timeoutMs: DEFERRED_SERVICES_TIMEOUT_MS,
    loadModules: async () => Promise.all([import('../shared/runtime/serviceWorker.ts')]),
    onReady: async ([swModule]) => {
      const { ServiceWorkerManager } = swModule;

      ServiceWorkerManager.register();
      ServiceWorkerManager.initConnectivityListeners();
    },
    onError: (error) => {
      Logger?.warn?.('Deferred services failed to init', { error });
    }
  });
};

const scheduleImageProxyCheck = () => {
  imageProxyRuntime.scheduleCheck({ timeout: IMAGE_PROXY_IDLE_TIMEOUT_MS });
};

const loadFullApp = async () => {
  if (appInitPromise) return appInitPromise;
  appInitPromise = import('./app.ts')
    .then(async (module) => {
      const { App } = module;
      if (!App.__appInit) {
        App.__appInit = true;
        await App.init();
      }
      loadedApp = App;
      return App;
    })
    .catch((error) => {
      Logger?.error?.('Failed to load full app', { error });
      throw error;
    });
  return appInitPromise;
};

const sanitizeImageUrl = (rawUrl) => {
  return sanitizeSafeImageUrl(rawUrl, {
    allowRelative: false,
    allowedHosts: ALLOWED_IMAGE_HOSTS
  });
};

const getEpisodeCountFromCard = (card) => getPresentationEpisodeCountFromCard(card);

const getCurrentWatchlistFilter = () => currentWatchlistFilter;

const updateWatchlistUi = (card, entry) => {
  if (!card) return;
  updateWatchlistControlsElement(card, entry, {
    episodeCount: getEpisodeCountFromCard(card)
  });
};

const findWatchlistCard = (animeId) => [...document.querySelectorAll('#watchlist-grid .anime-card')]
  .find(card => card.dataset.animeId === String(animeId)) || null;

// Host ports for the dedicated Watchlist page. The page has no Discovery shortlist or
// promoted Watching entry, and renderWatchlist schedules its own Airing Schedule update.
const watchlistPageHost = {
  updateControls: (animeId, entry) => updateWatchlistUi(findWatchlistCard(animeId), entry),
  renderWatchlist: () => renderWatchlist(),
  emit: (name, payload) => {
    if (typeof window === 'undefined') return;
    applyingOwnTransition = true;
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: payload }));
    } finally {
      applyingOwnTransition = false;
    }
  },
  // A "View watchlist" link is pointless on the Watchlist page itself; keep Undo.
  announce: (feedback) => showToast(feedback.message, {
    ...feedbackToastOptions({ ...feedback, action: feedback.action?.href === '/watchlist.html' ? null : feedback.action }),
    key: 'watchlist',
    type: 'success'
  }),
  announceFailure: (failure) => showToast(failure.message, { key: 'watchlist', type: 'error', duration: 10000 }),
  // Taste Profile lives in the full App, which loads lazily on this page (for settings).
  refreshTasteProfile: () => {
    if (!loadedApp) return;
    loadedApp.loadWatchlist();
    loadedApp.refreshTasteProfileEvidence();
  },
  updateTasteProfileUi: () => loadedApp?.updateTasteProfileUi()
};

const getWatchlistLifecycleRuntime = () => {
  if (!watchlistLifecycleRuntime) {
    watchlistLifecycleRuntime = createWatchlistLifecycleRuntime({
      dashboardTimeout: null,
      getLifecycle: getWatchlistLifecycle,
      host: watchlistPageHost,
      loadBeforeTransition: true,
      renderMode: null
    });
  }
  return watchlistLifecycleRuntime;
};

const getWatchlistPageRuntime = () => {
  if (watchlistPageRuntime) return watchlistPageRuntime;
  watchlistPageRuntime = createWatchlistPageRuntime({
    getEpisodeCountFromCard,
    getWatchlistRuntime: getWatchlistLifecycleRuntime
  });
  return watchlistPageRuntime;
};

const setCurrentWatchlistFilter = (next) => {
  if (!next || next === currentWatchlistFilter) return false;
  currentWatchlistFilter = next;
  renderWatchlist();
  return true;
};

const getWatchlistPageInteractions = () => {
  if (watchlistPageInteractions) return watchlistPageInteractions;
  watchlistPageInteractions = createWatchlistPageInteractions({
    handleWatchlistChange,
    handleWatchlistClick,
    handleImageError: (img) => imageProxyRuntime.handleImageError(img),
    // Transitions made on this page already re-render through the host ports.
    isOwnWatchlistUpdate: () => applyingOwnTransition,
    loadFullApp,
    onFilterChange: setCurrentWatchlistFilter,
    renderWatchlist
  });
  return watchlistPageInteractions;
};

const getWatchlistAiringDashboardAdapter = () => {
  if (watchlistAiringDashboardAdapter) return watchlistAiringDashboardAdapter;
  watchlistAiringDashboardAdapter = createWatchlistAiringDashboardAdapter({
    logger: Logger
  });
  return watchlistAiringDashboardAdapter;
};

const scheduleWatchlistAiringDashboardUpdate = (...args) => {
  return getWatchlistAiringDashboardAdapter().scheduleUpdate(...args);
};

const getWatchlistPageRenderer = () => {
  if (watchlistPageRenderer) return watchlistPageRenderer;
  watchlistPageRenderer = createWatchlistPageRenderer({
    resolveImage: (options) => imageProxyRuntime.resolveImage(options),
    getCurrentFilter: getCurrentWatchlistFilter,
    prepareEntries: (options) => getWatchlistLifecycleRuntime().prepareEntries(options),
    placeholderCover: PLACEHOLDER_COVER,
    scheduleAiringDashboardUpdate: scheduleWatchlistAiringDashboardUpdate
  });
  return watchlistPageRenderer;
};

const renderWatchlist = (options) => {
  return getWatchlistPageRenderer().renderWatchlist(options);
};

const handleWatchlistChange = (target) => {
  return getWatchlistPageRuntime().handleWatchlistChange(target);
};

const handleWatchlistClick = (target) => {
  return getWatchlistPageRuntime().handleWatchlistClick(target);
};

const bootstrap = () => {
  Logger.init({ level: 'info', captureGlobalErrors: true });
  SidebarPreference.init();
  updateBackupStatus();
  for (const id of ['watchlist-grid', 'airing-dashboard-grid']) {
    const grid = document.getElementById(id);
    if (grid) grid.dataset.renderer = 'watchlist-page';
  }
  initNonCriticalServices();
  scheduleImageProxyCheck();
  const watchlistSection = document.getElementById('watchlist-section');
  const airingSection = document.getElementById('airing-dashboard-section');
  if (watchlistSection && airingSection && watchlistSection.nextElementSibling !== airingSection) {
    watchlistSection.after(airingSection);
  }

  renderWatchlist();
  getWatchlistPageInteractions().setupPageHandlers();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
