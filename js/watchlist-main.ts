// @ts-nocheck
import { ThemeManager } from './themeManager.js';
import { Logger } from './services/logger.ts';
import { initDeferredRuntimeServices, queueIdleTask } from './bootstrap/deferred-runtime.js';
import { createImageProxyRuntime } from './image-proxy-runtime.js';
import { sanitizeImageUrl as sanitizeSafeImageUrl } from './urlSanitizer.ts';
import { createWatchlistAiringDashboardAdapter } from './watchlist-airing-dashboard-adapter.ts';
import {
  createWatchlistLifecycle
} from './watchlist-state.js';
import { createWatchlistLifecycleRuntime } from './watchlist-lifecycle-runtime.ts';
import {
  updateWatchlistControlsElement,
  getEpisodeCountFromCard as getPresentationEpisodeCountFromCard
} from './watchlist-entry-presentation.ts';
import { createWatchlistPageInteractions } from './watchlist-page-interactions.ts';
import { createWatchlistPageRenderer } from './watchlist-page-renderer.ts';
import { createWatchlistPageRuntime } from './watchlist-page-runtime.ts';
import { showToast } from './toast.ts';
import './bootstrap/watchlist-cover-preload.js';

const PLACEHOLDER_COVER = 'https://via.placeholder.com/120x170?text=No+Image';
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
  queueTask: (callback, options = {}) => queueIdleTask(callback, options.timeout ?? 2000),
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
    loadModules: async () => Promise.all([
      import('./serviceWorker.ts'),
      import('./services/analytics-service.js'),
      import('./performanceMonitor.js')
    ]),
    onReady: async ([swModule, analyticsModule, perfModule]) => {
      const { ServiceWorkerManager } = swModule;
      const { AnalyticsService } = analyticsModule;
      const { PerformanceMonitor } = perfModule;

      AnalyticsService.init();
      PerformanceMonitor.init();
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

const getWatchlistState = () => {
  const lifecycle = getWatchlistLifecycle();
  const map = lifecycle.load();
  return { map, entries: [...map.values()], version: 1 };
};

const saveWatchlistMap = (map, version = 1) => {
  const lifecycle = createWatchlistLifecycle({ version, placeholderCover: PLACEHOLDER_COVER, entries: map });
  lifecycle.save();
};

const migrateLegacyBookmarksToWatchlist = () => {
  const lifecycle = getWatchlistLifecycle();
  lifecycle.load();
  lifecycle.migrateLegacy();
};

const getEpisodeCountFromCard = (card) => getPresentationEpisodeCountFromCard(card);

const getCurrentWatchlistFilter = () => currentWatchlistFilter;

const updateWatchlistUi = (card, entry) => {
  if (!card) return;
  updateWatchlistControlsElement(card, entry, {
    episodeCount: getEpisodeCountFromCard(card)
  });
};

const getWatchlistPageRuntime = () => {
  if (watchlistPageRuntime) return watchlistPageRuntime;
  watchlistPageRuntime = createWatchlistPageRuntime({
    getEpisodeCountFromCard,
    getWatchlistRuntime: () => {
      if (!watchlistLifecycleRuntime) {
        watchlistLifecycleRuntime = createWatchlistLifecycleRuntime({
          buildSnapshot: () => null,
          dashboardTimeout: null,
          getAnime: () => null,
          getEpisodeLimit: () => null,
          getLifecycle: getWatchlistLifecycle,
          loadBeforeTransition: true,
          renderMode: null
        });
      }
      return watchlistLifecycleRuntime;
    },
    renderWatchlist,
    showFeedback: (feedback) => showToast(feedback.message, { key: 'watchlist', type: 'success' }),
    updateWatchlistUi
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
    loadFullApp,
    onFilterChange: setCurrentWatchlistFilter,
    renderWatchlist
  });
  return watchlistPageInteractions;
};

const getWatchlistAiringDashboardAdapter = () => {
  if (watchlistAiringDashboardAdapter) return watchlistAiringDashboardAdapter;
  watchlistAiringDashboardAdapter = createWatchlistAiringDashboardAdapter({
    logger: Logger,
    queueTask: queueIdleTask
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
    getWatchlistState,
    migrateLegacyBookmarksToWatchlist,
    placeholderCover: PLACEHOLDER_COVER,
    saveWatchlistMap,
    scheduleAiringDashboardUpdate: scheduleWatchlistAiringDashboardUpdate
  });
  return watchlistPageRenderer;
};

const renderWatchlist = () => {
  return getWatchlistPageRenderer().renderWatchlist();
};

const handleWatchlistChange = (target) => {
  return getWatchlistPageRuntime().handleWatchlistChange(target);
};

const handleWatchlistClick = (target) => {
  return getWatchlistPageRuntime().handleWatchlistClick(target);
};

const bootstrap = () => {
  Logger.init({ level: 'info', captureGlobalErrors: true });
  ThemeManager.init();
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
