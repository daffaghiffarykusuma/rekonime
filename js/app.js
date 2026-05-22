import { Recommendations } from './recommendations.js';
import { Discovery } from './discovery.js';
import { FilterPresets } from './filterPresets.js';
import { MetricGlossary } from './metricGlossary.js';
import { Onboarding } from './onboarding.js';
import { ThemeManager } from './themeManager.js';
import { CacheManager } from './services/cache-manager.js';
import { CatalogLoader } from './services/catalog-loader.js';
import { AnalyticsService } from './services/analytics-service.js';
import { ApiClient } from './services/api-client.js';
import { DataValidator } from './services/data-validator.js';
import { Logger } from './services/logger.js';
import { Store } from './core/store.js';
import { DependencyContainer } from './core/dependency-container.js';
import { HealthMonitor } from './healthMonitor.js';
import { createImageProxyRuntime } from './image-proxy-runtime.js';
import { createDetailExperience } from './detail-experience.js';
import { createRuntimeCapabilities } from './runtime-capabilities.js';
import { sanitizeUrl as sanitizeSafeUrl, sanitizeImageUrl as sanitizeSafeImageUrl } from './urlSanitizer.js';
import {
  buildTrailerUrls as buildTrustedTrailerUrls,
  sanitizeTrailerUrl as sanitizeTrustedTrailerUrl,
  sanitizeTrailerEmbedUrl as sanitizeTrustedTrailerEmbedUrl,
  resolveTrustedTrailerMessageOrigin
} from './security/trailer-url-policy.js';
import {
  setHTML,
  insertHTML,
  setScriptText,
  setScriptSource
} from './security/trusted-types.js';
import {
  isProxyImageUrl as isSharedProxyImageUrl,
  buildImageProxyUrl as buildSharedImageProxyUrl
} from './image-proxy.js';
import {
  WATCH_STATUS_VALUES,
  normalizeWatchStatus as normalizeWatchStatusValue,
  normalizeWatchProgress as normalizeWatchProgressValue,
  normalizeWatchTimestamp as normalizeWatchTimestampValue,
  normalizeSnapshotStats as normalizeWatchlistSnapshotStats,
  buildAnimeSnapshot as buildWatchlistAnimeSnapshot,
  normalizeWatchlistSnapshot,
  buildWatchlistEntry as buildLifecycleWatchlistEntry,
  areWatchlistSnapshotsEqual as areLifecycleWatchlistSnapshotsEqual,
  shouldShowWatchProgress as shouldShowLifecycleWatchProgress,
  createWatchlistLifecycle
} from './watchlist-state.js';

/**
 * Main application logic for Anime Scoring Dashboard
 */

const App = {
  animeData: [],
  filteredData: [],
  currentSort: 'retention',
  filterPanelOpen: false,
  filterPanelRendered: false,
  filterPanelRenderHandle: null,
  currentAnimeId: null,
  siteName: 'Rekonime',
  preferredHomePath: '/',
  basePageUrl: '',
  embeddedDataPromise: null,
  statsModule: null,
  statsModulePromise: null,
  reviewsService: null,
  reviewsServicePromise: null,
  dataSources: {
    full: 'data/anime.full.index.json',
    detailBase: 'data/anime.detail'
  },
  fetchConfig: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 4000,
    timeoutMs: 12000
  },
  fullCatalogTimeoutMs: 30000,
  isFullDataLoaded: false,
  loadingFullCatalog: false,
  fullCatalogPromise: null,
  animeDetailChunkPromises: new Map(),
  animeDetailChunkLoadedIds: new Set(),
  fullCatalogPreloadPromise: null,
  fullCatalogScheduleHandle: null,
  fullCatalogInteractionCaptured: false,
  fullCatalogInteractionListeners: [],
  preloadHintsAdded: false,
  defaultMeta: {
    title: '',
    description: '',
    image: '',
    url: ''
  },
  trailerObserver: null,
  trailerScrollHandler: null,
  trailerScrollRoot: null,
  trailerCleanup: null,
  legacyWatchlistStorageKey: 'rekonime.bookmarks',
  watchlistStorageKey: 'rekonime.watchlist',
  settingsStorageKey: 'rekonime.settings',
  catalogCacheMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  watchlistVersion: 1,
  settings: null,
  settingsRendered: false,
  watchlistEntries: new Map(),
  watchlistStatusOptions: WATCH_STATUS_VALUES,
  seoInitialized: false,
  urlFiltersApplied: false,
  filterQueryMap: {
    seasonYear: 'season',
    year: 'year',
    studio: 'studio',
    source: 'source',
    genres: 'genre',
    themes: 'theme',
    demographic: 'demographic'
  },
  filterTypeLabels: {
    genres: 'Genre',
    themes: 'Theme',
    demographic: 'Demographic',
    seasonYear: 'Season',
    year: 'Year',
    studio: 'Studio',
    source: 'Source'
  },
  quickFilterState: {
    genres: { expanded: false },
    themes: { expanded: false }
  },
  moodFilterClusterDefinitions: [
    {
      key: 'comfort',
      label: 'Comfort watch',
      description: 'Gentler picks for familiar, low-friction viewing.',
      genres: ['Slice of Life', 'Comedy'],
      themes: ['Iyashikei', 'CGDCT', 'School']
    },
    {
      key: 'high-energy',
      label: 'High energy',
      description: 'Fast starts, action, and momentum-heavy series.',
      genres: ['Action', 'Adventure', 'Sports'],
      themes: ['Combat Sports', 'Super Power', 'Team Sports']
    },
    {
      key: 'emotional',
      label: 'Emotional payoff',
      description: 'Drama-forward stories where the ending matters.',
      genres: ['Drama', 'Romance'],
      themes: ['Love Polygon', 'Psychological', 'Performing Arts']
    },
    {
      key: 'escape',
      label: 'Escapist worlds',
      description: 'Fantasy, adventure, and alternate-world hooks.',
      genres: ['Fantasy', 'Adventure'],
      themes: ['Isekai', 'Reincarnation', 'Mythology']
    },
    {
      key: 'suspense',
      label: 'Tense and clever',
      description: 'Mystery, strategy, and sharper-edged viewing.',
      genres: ['Mystery', 'Suspense'],
      themes: ['Psychological', 'Detective', 'Strategy Game']
    }
  ],
  headerSearchState: {
    query: '',
    results: [],
    activeIndex: -1
  },
  lastAppliedSearchQuery: '',
  searchMaxResults: 8,
  modalFocusState: {
    activeId: null,
    lastFocused: null,
    handler: null
  },
  registeredListeners: [],
  healthMonitorUnsubscribe: null,
  animeCardTemplate: null,
  gridDomCache: new Map(),
  detailCache: new Map(),
  detailCacheMaxSize: 10,
  toastRegionId: 'toast-region',
  toastTimers: new Map(),
  gridObserver: null,
  visibleCardIds: new Set(),
  prefetchObserver: null,
  prefetchQueue: new Set(),
  prefetchLimit: 10,
  eagerImageCount: 4,
  highPriorityImageCount: 2,
  secondaryRenderHandle: null,
  secondaryRenderInFlight: false,
  secondaryDeferredTimeoutId: null,
  gridVirtualScrollHandle: null,
  deferFilterUiOnce: false,
  deferFilterUiHandle: null,
  deferFilterUiUsed: false,
  features: {
    diffRendering: true,
    templatePooling: true,
    virtualScrolling: true,
    parallelLoading: true,
    smartImageLoading: true,
    intelligentPrefetching: true,
    lazyGridSort: true,
    imageProxy: true
  },
  imageDimensions: {
    card: { width: 240, height: 360 },
    recommendation: { width: 320, height: 190 },
    trending: { width: 280, height: 140 },
    ranking: { width: 64, height: 90 },
    search: { width: 40, height: 56 },
    similar: { width: 200, height: 140 },
    detail: { width: 150, height: 210 },
    seed: { width: 32, height: 45 }
  },
  imageProxyStatusKey: 'rekonime.imageProxyStatus',
  imageProxyStatusTtlMs: 6 * 60 * 60 * 1000,
  imageProxyCheckTimeoutMs: 2500,
  imageProxyRuntime: null,
  airingDashboardModulePromise: null,
  airingDashboardController: null,
  airingDashboardRenderHandle: null,

  store: null,
  storeBindingsApplied: false,

  getDefaultActiveFilters() {
    return {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: [],
      themes: [],
      demographic: []
    };
  },

  getDefaultFilterOptions() {
    return {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: [],
      themes: [],
      demographic: []
    };
  },

  cloneFilterMap(map, fallback) {
    const base = fallback || this.getDefaultActiveFilters();
    const next = {};
    Object.keys(base).forEach((key) => {
      const value = map?.[key];
      next[key] = Array.isArray(value) ? [...value] : [];
    });
    return next;
  },

  getCache() {
    return CacheManager;
  },

  getCatalogRuntime() {
    return CatalogLoader.createRuntime(this);
  },

  getDetailExperience() {
    return createDetailExperience(this);
  },

  getRuntimeCapabilities() {
    return createRuntimeCapabilities({
      modalFocusState: this.modalFocusState,
      closeModalById: (modalId) => {
        if (modalId === 'detail-modal') {
          this.closeDetailModal();
          return true;
        }
        if (modalId === 'filter-modal') {
          this.closeFilterModal();
          return true;
        }
        if (modalId === 'settings-modal') {
          this.closeSettingsModal();
          return true;
        }
        if (modalId === 'metric-help-modal') {
          this.closeMetricHelpModal();
          return true;
        }
        return false;
      }
    });
  },

  getWatchlistLifecycle() {
    return createWatchlistLifecycle({
      storage: this.getCache(),
      storageKey: this.watchlistStorageKey,
      legacyStorageKey: this.legacyWatchlistStorageKey,
      version: this.watchlistVersion,
      entries: this.watchlistEntries,
      now: () => Date.now()
    });
  },

  getAnalytics() {
    return AnalyticsService;
  },

  getLogger() {
    return Logger;
  },

  getApiClient() {
    return ApiClient;
  },

  async loadStatsModule() {
    if (this.statsModule) return this.statsModule;
    if (this.statsModulePromise) return this.statsModulePromise;
    this.statsModulePromise = import('./stats.js')
      .then((module) => {
        this.statsModule = module.Stats;
        return this.statsModule;
      })
      .catch((error) => {
        this.statsModulePromise = null;
        throw error;
      });
    return this.statsModulePromise;
  },

  async loadReviewsService() {
    if (this.reviewsService) return this.reviewsService;
    if (this.reviewsServicePromise) return this.reviewsServicePromise;
    this.reviewsServicePromise = import('./reviews.js')
      .then((module) => {
        this.reviewsService = module.ReviewsService;
        return this.reviewsService;
      })
      .catch((error) => {
        this.reviewsServicePromise = null;
        throw error;
      });
    return this.reviewsServicePromise;
  },

  getPerformanceNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  },

  queueIdleTask(callback, { timeout = 1500 } = {}) {
    return this.getRuntimeCapabilities().queueIdleTask(callback, { timeout });
  },

  cancelIdleTask(handle) {
    return this.getRuntimeCapabilities().cancelIdleTask(handle);
  },

  getConnectionInfo() {
    if (typeof navigator === 'undefined') return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  },

  isCoarsePointer() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  },

  prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  shouldEnableLowMotionMode() {
    const connection = this.getConnectionInfo();
    const saveData = Boolean(connection?.saveData);
    return saveData || this.isCoarsePointer() || this.prefersReducedMotion();
  },

  shouldDeferHeavyContent() {
    const connection = this.getConnectionInfo();
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const lowBandwidth = effectiveType.includes('2g') || effectiveType.includes('3g') || effectiveType === 'slow-4g';
    const lowMemory = typeof navigator !== 'undefined' && Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
    return Boolean(connection?.saveData) || lowBandwidth || lowMemory || this.isMobileViewport() || this.isCoarsePointer();
  },

  applyPerformancePreferences() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const enableLowMotion = this.shouldEnableLowMotionMode();
    if (enableLowMotion) {
      root.setAttribute('data-low-motion', 'true');
    } else {
      root.removeAttribute('data-low-motion');
    }
    this.features.virtualScrolling = !enableLowMotion;
  },

  updateGridPageSize() {
    const connection = this.getConnectionInfo();
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const isSlow = Boolean(connection?.saveData) || effectiveType.includes('2g') || effectiveType.includes('3g') || effectiveType === 'slow-4g';
    const isMobile = this.isMobileViewport();
    let nextSize = 24;
    if (isMobile) {
      nextSize = 12;
    }
    if (isSlow) {
      nextSize = Math.min(nextSize, isMobile ? 10 : 12);
    }
    this.gridPageSize = nextSize;
  },

  getInitialGridBatchSize() {
    const isMobile = this.isMobileViewport();
    const baseSize = isMobile ? this.initialGridBatchSizeMobile : this.initialGridBatchSize;
    const clamped = Math.max(1, Math.min(baseSize, this.gridPageSize));
    return clamped;
  },

  getImageProxyRuntime() {
    if (!this.imageProxyRuntime) {
      this.imageProxyRuntime = createImageProxyRuntime({
        storageKey: this.imageProxyStatusKey,
        ttlMs: this.imageProxyStatusTtlMs,
        timeoutMs: this.imageProxyCheckTimeoutMs,
        queueTask: (callback, options = {}) => this.queueIdleTask(callback, { timeout: options.timeout ?? 1500 }),
        waitForLoad: true
      });
    }
    return this.imageProxyRuntime;
  },

  loadImageProxyStatus() {
    this.getImageProxyRuntime().loadStatus();
  },

  getImageProxyStatus() {
    return this.getImageProxyRuntime().getStatus();
  },

  storeImageProxyStatus(ok) {
    this.getImageProxyRuntime().storeStatus(ok);
  },

  scheduleImageProxyCheck() {
    this.getImageProxyRuntime().scheduleCheck({ timeout: 5000 });
  },

  checkImageProxyAvailability() {
    return this.getImageProxyRuntime().checkAvailability();
  },

  shouldUseImageProxy() {
    if (!this.features.imageProxy) return false;
    return this.getImageProxyRuntime().shouldUseProxy();
  },

  isProxyImageUrl(url) {
    return isSharedProxyImageUrl(url);
  },

  markImageProxyFailed() {
    this.getImageProxyRuntime().markFailed();
  },

  getImageDimensions(kind) {
    const dims = this.imageDimensions?.[kind];
    if (!dims) return null;
    const width = Number(dims.width);
    const height = Number(dims.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { width, height };
  },

  shouldPrefetchFullCatalog() {
    const connection = this.getConnectionInfo();
    if (!connection) return true;
    if (connection.saveData) return false;
    const type = String(connection.effectiveType || '').toLowerCase();
    if (type.includes('2g') || type.includes('3g')) return false;
    return true;
  },

  setupFullCatalogInteractionTriggers() {
    if (this.fullCatalogInteractionCaptured || this.isFullDataLoaded) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.fullCatalogInteractionListeners.length > 0) return;

    const handler = () => this.handleFullCatalogInteraction();
    const passiveOptions = { passive: true };

    const register = (target, event, options = passiveOptions) => {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(event, handler, options);
      this.fullCatalogInteractionListeners.push({ target, event, options, handler });
    };

    register(window, 'scroll', passiveOptions);
    register(window, 'wheel', passiveOptions);
    register(window, 'touchstart', passiveOptions);
    register(document, 'pointerdown', passiveOptions);
    register(document, 'keydown');
  },

  teardownFullCatalogInteractionTriggers() {
    if (this.fullCatalogInteractionListeners.length === 0) return;
    this.fullCatalogInteractionListeners.forEach(({ target, event, options, handler }) => {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(event, handler, options);
      }
    });
    this.fullCatalogInteractionListeners = [];
  },

  handleFullCatalogInteraction() {
    if (this.fullCatalogInteractionCaptured || this.isFullDataLoaded) return;
    this.fullCatalogInteractionCaptured = true;
    this.teardownFullCatalogInteractionTriggers();
    this.queueIdleTask(() => {
      this.loadFullCatalog();
    }, { timeout: 2000 });
  },

  emitAppEvent(name, detail = {}) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  },

  emitCatalogEvent(type, detail = {}) {
    const payload = {
      type,
      ...detail,
      at: new Date().toISOString()
    };
    this.emitAppEvent('rekonime:catalog-cache', payload);
    const logger = this.getLogger();
    logger?.info?.('[catalog]', payload);
  },

  dispatchStore(action) {
    if (this.store && typeof this.store.dispatch === 'function') {
      this.store.dispatch(action);
    }
  },

  bindStoreState() {
    if (!this.store || this.storeBindingsApplied) return;
    this.storeBindingsApplied = true;

    const bindings = {
      animeData: { slice: 'catalog', key: 'items', action: 'catalog/setItems' },
      filteredData: { slice: 'catalog', key: 'filtered', action: 'catalog/setFiltered' },
      scoreProfile: { slice: 'catalog', key: 'scoreProfile', action: 'catalog/setScoreProfile' },
      isFullDataLoaded: { slice: 'catalog', key: 'isFullLoaded', action: 'catalog/setFullLoaded' },
      loadingFullCatalog: { slice: 'catalog', key: 'isLoadingFull', action: 'catalog/setLoadingFull' },
      activeFilters: { slice: 'filters', key: 'active', action: 'filters/setActive' },
      filterOptions: { slice: 'filters', key: 'options', action: 'filters/setOptions' },
      currentSort: { slice: 'ui', key: 'currentSort', action: 'ui/setSort' },
      filterPanelOpen: { slice: 'ui', key: 'filterPanelOpen', action: 'ui/setFilterPanelOpen' },
      currentAnimeId: { slice: 'ui', key: 'currentAnimeId', action: 'ui/setCurrentAnimeId' }
    };

    Object.entries(bindings).forEach(([prop, config]) => {
      let localValue = this[prop];
      Object.defineProperty(this, prop, {
        configurable: true,
        enumerable: true,
        get: () => {
          if (!this.store) return localValue;
          const state = this.store.getState();
          const slice = state?.[config.slice];
          if (!slice || !(config.key in slice)) return localValue;
          return slice[config.key];
        },
        set: (value) => {
          localValue = value;
          if (this.store) {
            this.dispatchStore({ type: config.action, payload: value });
          }
        }
      });
    });
  },

  initializeStore() {
    if (this.store) return;

    const defaultSettings = this.getDefaultSettings();
    const defaultActiveFilters = this.getDefaultActiveFilters();
    const defaultFilterOptions = this.getDefaultFilterOptions();

    const normalizeFilters = (value, fallback) => this.cloneFilterMap(value, fallback);

    const reducers = {
      settings: (state = defaultSettings, action) => {
        if (!action) return state;
        if (action.type === 'settings/loaded') {
          return { ...state, ...(action.payload || {}) };
        }
        if (action.type === 'settings/updated') {
          return { ...state, ...(action.payload || {}) };
        }
        return state;
      },
      catalog: (state = {
        items: Array.isArray(this.animeData) ? this.animeData : [],
        filtered: Array.isArray(this.filteredData) ? this.filteredData : [],
        scoreProfile: this.scoreProfile || null,
        isFullLoaded: Boolean(this.isFullDataLoaded),
        isLoadingFull: Boolean(this.loadingFullCatalog)
      }, action) => {
        if (!action) return state;
        switch (action.type) {
          case 'catalog/setItems':
            return { ...state, items: Array.isArray(action.payload) ? action.payload : [] };
          case 'catalog/setFiltered':
            return { ...state, filtered: Array.isArray(action.payload) ? action.payload : [] };
          case 'catalog/setScoreProfile':
            return { ...state, scoreProfile: action.payload || null };
          case 'catalog/setFullLoaded':
            return { ...state, isFullLoaded: Boolean(action.payload) };
          case 'catalog/setLoadingFull':
            return { ...state, isLoadingFull: Boolean(action.payload) };
          default:
            return state;
        }
      },
      filters: (state = {
        active: normalizeFilters(this.activeFilters, defaultActiveFilters),
        options: normalizeFilters(this.filterOptions, defaultFilterOptions)
      }, action) => {
        if (!action) return state;
        switch (action.type) {
          case 'filters/setActive':
            return { ...state, active: normalizeFilters(action.payload, defaultActiveFilters) };
          case 'filters/setOptions':
            return { ...state, options: normalizeFilters(action.payload, defaultFilterOptions) };
          case 'filters/reset':
            return { ...state, active: normalizeFilters(defaultActiveFilters, defaultActiveFilters) };
          default:
            return state;
        }
      },
      ui: (state = {
        currentSort: this.currentSort,
        filterPanelOpen: Boolean(this.filterPanelOpen),
        currentAnimeId: this.currentAnimeId || null
      }, action) => {
        if (!action) return state;
        switch (action.type) {
          case 'ui/setSort':
            return { ...state, currentSort: action.payload || state.currentSort };
          case 'ui/setFilterPanelOpen':
            return { ...state, filterPanelOpen: Boolean(action.payload) };
          case 'ui/setCurrentAnimeId':
            return { ...state, currentAnimeId: action.payload || null };
          default:
            return state;
        }
      }
    };

    this.store = Store.createStore({
      initialState: {
        settings: defaultSettings,
        catalog: {
          items: Array.isArray(this.animeData) ? this.animeData : [],
          filtered: Array.isArray(this.filteredData) ? this.filteredData : [],
          scoreProfile: this.scoreProfile || null,
          isFullLoaded: Boolean(this.isFullDataLoaded),
          isLoadingFull: Boolean(this.loadingFullCatalog)
        },
        filters: {
          active: normalizeFilters(this.activeFilters, defaultActiveFilters),
          options: normalizeFilters(this.filterOptions, defaultFilterOptions)
        },
        ui: {
          currentSort: this.currentSort,
          filterPanelOpen: Boolean(this.filterPanelOpen),
          currentAnimeId: this.currentAnimeId || null
        }
      },
      reducers
    });

    this.bindStoreState();

    DependencyContainer.register('appStore', this.store);
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        default: return char;
      }
    });
  },

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  },

  decodeHtmlEntities(value) {
    if (!value) return '';
    const named = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: '\'',
      nbsp: ' ',
      rsquo: '\'',
      lsquo: '\'',
      ldquo: '"',
      rdquo: '"',
      mdash: '-',
      ndash: '-',
      hellip: '...'
    };

    let decoded = String(value);
    for (let i = 0; i < 2; i += 1) {
      decoded = decoded
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
          const code = Number.parseInt(hex, 16);
          return Number.isFinite(code) ? String.fromCharCode(code) : _;
        })
        .replace(/&#(\d+);/g, (_, num) => {
          const code = Number.parseInt(num, 10);
          return Number.isFinite(code) ? String.fromCharCode(code) : _;
        })
        .replace(/&([a-z]+);/gi, (match, name) => {
          const key = String(name || '').toLowerCase();
          return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
        });
    }
    return decoded;
  },

  escapeCssValue(value) {
    const raw = String(value ?? '');
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(raw);
    }
    return raw.replace(/["\\]/g, '\\$&');
  },

  sanitizeClassToken(value) {
    const token = String(value ?? '').trim();
    if (!token) return '';
    return /^[A-Za-z0-9_-]+$/.test(token) ? token : '';
  },

  sanitizeClassList(...values) {
    const tokens = [];
    values.flat().forEach((value) => {
      String(value ?? '')
        .split(/\s+/)
        .forEach((token) => {
          const safeToken = this.sanitizeClassToken(token);
          if (safeToken && !tokens.includes(safeToken)) {
            tokens.push(safeToken);
          }
        });
    });
    return tokens.join(' ');
  },

  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  },

  normalizeBookmarkId(value) {
    const key = String(value ?? '').trim();
    return key || '';
  },

  getSynopsisCacheKey(cacheKey) {
    if (cacheKey === null || cacheKey === undefined || cacheKey === '') return '';
    return `rekonime:description:${String(cacheKey)}`;
  },

  getCachedSynopsis(cacheKey) {
    const key = this.getSynopsisCacheKey(cacheKey);
    if (!key) return '';
    const cache = this.getCache();
    const cached = cache.getJSON(key, { fallback: '' });
    if (typeof cached === 'string') {
      return cached;
    }
    if (cached && typeof cached.description === 'string') {
      return cached.description;
    }
    return '';
  },

  renderSynopsis(description) {
    if (!description) {
      return '';
    }

    const cleanDescription = this.decodeHtmlEntities(description)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanDescription) {
      return '';
    }

    const safeDescription = this.escapeHtml(cleanDescription);

    return `
      <div class="anime-synopsis">
        <h3>Synopsis</h3>
        <p class="synopsis-text">${safeDescription}</p>
      </div>
    `;
  },

  renderSynopsisLoading() {
    return `
      <div class="anime-synopsis">
        <h3>Synopsis</h3>
        <div class="synopsis-loading">
          <div class="loading-shimmer"></div>
          <div class="loading-shimmer"></div>
          <div class="loading-shimmer short"></div>
        </div>
      </div>
    `;
  },

  renderReviewsLoading() {
    return `
      <div class="community-reviews">
        <h3>Community Reviews</h3>
        <div class="reviews-loading">
          <div class="loading-spinner"></div>
          <p>Loading reviews...</p>
        </div>
      </div>
    `;
  },

  renderWatchlistControls(anime) {
    if (!anime) return '';
    const entry = this.getWatchlistEntry(anime.id);
    const status = entry?.status || '';
    const progress = Number.isFinite(entry?.progress) ? entry.progress : 0;
    const episodeCount = this.getEpisodeCount(anime);
    const showProgress = this.shouldShowWatchProgress(status);
    const safeId = this.escapeAttr(anime.id);
    const maxAttr = Number.isFinite(episodeCount) && episodeCount > 0 ? `max="${episodeCount}"` : '';
    const totalText = Number.isFinite(episodeCount) && episodeCount > 0 ? `of ${episodeCount}` : '';

    const options = [
      { value: '', label: 'Not saved' },
      { value: 'planned', label: 'Want to watch' },
      { value: 'watching', label: 'Watching now' },
      { value: 'completed', label: 'Finished' },
      { value: 'dropped', label: 'Stopped' }
    ];

    const optionsHtml = options.map((option) => {
      const selected = option.value === status ? 'selected' : '';
      return `<option value="${this.escapeAttr(option.value)}" ${selected}>${this.escapeHtml(option.label)}</option>`;
    }).join('');

    return `
      <div class="detail-watchlist">
        <div class="detail-watchlist-label">
          <span class="detail-watchlist-title">Your watch status</span>
          <span class="detail-watchlist-subtitle">Save progress and pick up where you left off</span>
        </div>
        <div class="detail-watchlist-controls">
          <label class="watchlist-select-wrapper">
            <span class="visually-hidden">Choose your watch status</span>
            <select class="watchlist-select" id="watchlist-select" data-action="watch-status" data-anime-id="${safeId}">
              ${optionsHtml}
            </select>
          </label>
          <div class="watchlist-progress ${showProgress ? '' : 'is-hidden'}" id="watchlist-progress">
            <span class="watchlist-progress-label">Episodes watched</span>
            <div class="watchlist-progress-stepper">
              <button class="watchlist-stepper" type="button" data-action="watch-progress-dec" data-anime-id="${safeId}" aria-label="Decrease watched episodes">
                <span aria-hidden="true">−</span>
              </button>
              <input class="watchlist-progress-input" id="watchlist-progress-input" type="number" min="0" step="1" ${maxAttr}
                value="${this.escapeAttr(String(progress))}" data-action="watch-progress" data-anime-id="${safeId}" inputmode="numeric" aria-label="Episodes watched">
              <span class="watchlist-progress-total" id="watchlist-progress-total">${this.escapeHtml(totalText)}</span>
              <button class="watchlist-stepper" type="button" data-action="watch-progress-inc" data-anime-id="${safeId}" aria-label="Increase watched episodes">
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  normalizeSnapshotStats(stats) {
    return normalizeWatchlistSnapshotStats(stats);
  },

  buildAnimeSnapshot(anime) {
    return buildWatchlistAnimeSnapshot(anime);
  },

  normalizeAnimeSnapshot(item) {
    return normalizeWatchlistSnapshot(item);
  },

  getWatchlistSnapshot(animeId) {
    const key = this.normalizeBookmarkId(animeId);
    if (!key) return null;
    const entry = this.watchlistEntries.get(key);
    if (!entry?.snapshot) return null;
    return this.normalizeAnimeSnapshot(entry.snapshot) || null;
  },

  normalizeWatchStatus(value) {
    return normalizeWatchStatusValue(value, { fallback: 'planned' });
  },

  normalizeWatchProgress(value) {
    return normalizeWatchProgressValue(value);
  },

  normalizeWatchTimestamp(value) {
    return normalizeWatchTimestampValue(value);
  },

  buildWatchlistEntry({ id, status, progress, updatedAt, startedAt, completedAt, snapshot } = {}) {
    return buildLifecycleWatchlistEntry({ id, status, progress, updatedAt, startedAt, completedAt, snapshot });
  },

  normalizeWatchlistEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return this.buildWatchlistEntry({
      id: entry.id,
      status: entry.status,
      progress: entry.progress,
      updatedAt: entry.updatedAt,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      snapshot: entry.snapshot
    });
  },

  loadWatchlist() {
    if (typeof window === 'undefined') return;
    const lifecycle = this.getWatchlistLifecycle();
    this.watchlistEntries = lifecycle.load();
  },

  refreshWatchlistSnapshots() {
    this.getWatchlistLifecycle().refreshSnapshotsFromCatalog(this.animeData, { persist: true, replaceExisting: false });
  },

  getWatchlistStoragePayload() {
    return this.getWatchlistLifecycle().getStoragePayload();
  },

  saveWatchlist() {
    if (typeof window === 'undefined') return false;
    return this.getWatchlistLifecycle().save();
  },

  getWatchlistEntry(animeId) {
    return this.getWatchlistLifecycle().getEntry(animeId);
  },

  getWatchlistIds({ statuses } = {}) {
    return this.getWatchlistLifecycle().getIds({ statuses });
  },

  getWatchlistEntries({ statuses } = {}) {
    return this.getWatchlistLifecycle().getEntries({ statuses });
  },

  getWatchlistAnime({ statuses } = {}) {
    return this.getWatchlistLifecycle().getAnimeItems(this.animeData, { statuses });
  },

  getAiringDashboardAnimeItems({ statuses } = {}) {
    return this.getWatchlistLifecycle().getDisplayItems(this.animeData, { statuses });
  },

  async loadAiringDashboardModule() {
    if (this.airingDashboardModulePromise) return this.airingDashboardModulePromise;
    this.airingDashboardModulePromise = import('./airing-dashboard.js')
      .then((module) => module.createAiringDashboardController)
      .catch((error) => {
        this.airingDashboardModulePromise = null;
        throw error;
      });
    return this.airingDashboardModulePromise;
  },

  async ensureAiringDashboardController() {
    if (typeof document === 'undefined') return null;
    if (this.airingDashboardController) return this.airingDashboardController;
    const createAiringDashboardController = await this.loadAiringDashboardModule();
    this.airingDashboardController = createAiringDashboardController({
      sectionId: 'airing-dashboard-section',
      subtitleId: 'airing-dashboard-subtitle',
      summaryId: 'airing-dashboard-summary',
      gridId: 'airing-dashboard-grid',
      emptyId: 'airing-dashboard-empty',
      hideWhenNoEntries: true
    });
    return this.airingDashboardController;
  },

  async renderAiringDashboard() {
    const controller = await this.ensureAiringDashboardController();
    if (!controller) return;

    const entries = this.getWatchlistEntries({ statuses: ['planned', 'watching'] });
    await controller.update({
      entries,
      animeItems: this.getAiringDashboardAnimeItems({ statuses: ['planned', 'watching'] })
    });
  },

  scheduleAiringDashboardRender({ timeout = 2500 } = {}) {
    if (typeof document === 'undefined') return;
    if (this.airingDashboardRenderHandle) {
      this.cancelIdleTask(this.airingDashboardRenderHandle);
      this.airingDashboardRenderHandle = null;
    }
    this.airingDashboardRenderHandle = this.queueIdleTask(() => {
      this.airingDashboardRenderHandle = null;
      void this.renderAiringDashboard();
    }, { timeout });
  },

  getWatchlistSnapshots({ statuses } = {}) {
    return this.getWatchlistLifecycle().getSnapshots({ statuses });
  },

  ensureWatchlistEntry(animeId, { status = 'planned', progress = 0 } = {}) {
    return this.getWatchlistLifecycle().ensureEntry(animeId, { status, progress }).changed;
  },

  removeWatchlistEntry(animeId) {
    return this.getWatchlistLifecycle().removeEntry(animeId).removed;
  },

  getLegacyBookmarksPayload() {
    return this.getWatchlistLifecycle().getLegacyPayload();
  },

  migrateLegacyBookmarksToWatchlist() {
    if (typeof window === 'undefined') return;
    this.getWatchlistLifecycle().migrateLegacy();
  },

  shouldShowWatchProgress(status) {
    return shouldShowLifecycleWatchProgress(status);
  },

  getEpisodeLimitForAnime(animeId) {
    const anime = this.animeData.find(item => item?.id === animeId);
    if (!anime) return null;
    const total = this.getEpisodeCount(anime);
    if (!Number.isFinite(total) || total <= 0) return null;
    return total;
  },

  setWatchStatus(animeId, status, { episodeCount } = {}) {
    const key = this.normalizeBookmarkId(animeId);
    if (!key) return null;
    const anime = this.animeData.find(item => item?.id === key);
    const result = this.getWatchlistLifecycle().setStatus(key, status, {
      episodeCount,
      snapshot: this.buildAnimeSnapshot(anime)
    });
    if (!result.changed) return result;
    this.updateWatchlistControls(key);
    if (result.removed) {
      this.emitAppEvent('rekonime:watchlist-updated', { id: key, removed: true });
    } else {
      this.emitAppEvent('rekonime:watchlist-updated', {
        id: key,
        status: result.entry.status,
        progress: result.entry.progress,
        removed: false
      });
    }
    this.scheduleAiringDashboardRender({ timeout: 500 });
    return result.removed ? { removed: true } : { entry: result.entry };
  },

  setWatchProgress(animeId, progress, { episodeCount } = {}) {
    const key = this.normalizeBookmarkId(animeId);
    if (!key) return null;
    const anime = this.animeData.find(item => item?.id === key);
    const result = this.getWatchlistLifecycle().setProgress(key, progress, {
      episodeCount,
      snapshot: this.buildAnimeSnapshot(anime)
    });
    if (!result.changed) return result;
    this.updateWatchlistControls(key);
    this.emitAppEvent('rekonime:watchlist-updated', {
      id: key,
      status: result.entry.status,
      progress: result.entry.progress,
      removed: false
    });
    this.scheduleAiringDashboardRender({ timeout: 500 });
    return { entry: result.entry };
  },

  adjustWatchProgress(animeId, delta) {
    const key = this.normalizeBookmarkId(animeId);
    if (!key) return null;
    const episodeCount = this.getEpisodeLimitForAnime(key);
    const anime = this.animeData.find(item => item?.id === key);
    const result = this.getWatchlistLifecycle().adjustProgress(key, delta, {
      episodeCount,
      snapshot: this.buildAnimeSnapshot(anime)
    });
    if (!result.changed) return result;
    this.updateWatchlistControls(key);
    this.emitAppEvent('rekonime:watchlist-updated', {
      id: key,
      status: result.entry.status,
      progress: result.entry.progress,
      removed: false
    });
    this.scheduleAiringDashboardRender({ timeout: 500 });
    return { entry: result.entry };
  },

  updateWatchlistControls(animeId) {
    if (typeof document === 'undefined') return;
    if (!animeId || this.currentAnimeId !== animeId) return;
    const select = document.getElementById('watchlist-select');
    const progressWrap = document.getElementById('watchlist-progress');
    const progressInput = document.getElementById('watchlist-progress-input');
    const progressTotal = document.getElementById('watchlist-progress-total');
    if (!select || !progressWrap || !progressInput) return;

    const entry = this.getWatchlistEntry(animeId);
    const status = entry?.status || '';
    select.value = status;

    const showProgress = this.shouldShowWatchProgress(status);
    progressWrap.classList.toggle('is-hidden', !showProgress);

    const progressValue = Number.isFinite(entry?.progress) ? entry.progress : 0;
    progressInput.value = String(progressValue);

    const total = this.getEpisodeLimitForAnime(animeId);
    if (Number.isFinite(total) && total > 0) {
      progressInput.setAttribute('max', String(total));
      if (progressTotal) {
        progressTotal.textContent = `of ${total}`;
      }
    } else {
      progressInput.removeAttribute('max');
      if (progressTotal) {
        progressTotal.textContent = '';
      }
    }
  },

  sanitizeUrl(rawUrl, { allowRelative = false } = {}) {
    return sanitizeSafeUrl(rawUrl, { allowRelative });
  },

  sanitizeImageUrl(rawUrl, { allowRelative = false } = {}) {
    return sanitizeSafeImageUrl(rawUrl, {
      allowRelative,
      allowedHosts: [
        'cdn.myanimelist.net',
        'myanimelist.cdn-dena.com',
        'via.placeholder.com',
        'i.ytimg.com',
        'images.weserv.nl'
      ]
    });
  },

  getAssetPath(path) {
    if (!path) return '';
    if (window.location.protocol === 'file:') {
      return path;
    }
    return path.startsWith('/') ? path : `/${path}`;
  },

  shouldUseHomeAlias() {
    if (!this.preferredHomePath) return false;
    if (window.location.protocol === 'file:') return false;
    const hostname = window.location.hostname || '';
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
    return !localHosts.has(hostname);
  },

  normalizeHomePath(url) {
    if (!this.shouldUseHomeAlias() || !url || !this.isCatalogPage()) return;
    const homePath = this.preferredHomePath.startsWith('/') ? this.preferredHomePath : `/${this.preferredHomePath}`;
    const path = url.pathname || '/';
    const normalizedPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

    if (normalizedPath === '/home') {
      url.pathname = homePath;
      return;
    }

    if (path.endsWith('/index.html')) {
      url.pathname = path.replace(/\/index\.html$/, homePath);
      return;
    }

    if (path.endsWith('/') && !path.endsWith(`${homePath}/`) && !path.endsWith(homePath)) {
      url.pathname = `${path.replace(/\/$/, '')}${homePath}`;
    }
  },

  syncHomePath({ replace = true } = {}) {
    if (!this.shouldUseHomeAlias()) return '';
    try {
      const url = new URL(window.location.href);
      const original = url.toString();
      this.normalizeHomePath(url);
      const nextUrl = url.toString();
      if (nextUrl !== original) {
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method](window.history.state || {}, '', nextUrl);
      }
      return nextUrl;
    } catch (error) {
      return '';
    }
  },

  getHomeUrl(sourceUrl) {
    if (window.location.protocol === 'file:') {
      return 'index.html';
    }
    try {
      const url = new URL(sourceUrl || window.location.href);
      const homePath = this.preferredHomePath.startsWith('/') ? this.preferredHomePath : `/${this.preferredHomePath}`;
      const directory = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/\/[^/]*$/, '/');
      url.pathname = `${directory.replace(/\/$/, '')}${homePath}`;
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateHomeLinks() {
    if (!this.shouldUseHomeAlias()) return;
    const homeUrl = this.getHomeUrl();
    if (!homeUrl) return;
    document.querySelectorAll('[data-home-link]').forEach(link => {
      link.setAttribute('href', homeUrl);
    });
  },

  getFilterParamMap() {
    return this.filterQueryMap;
  },

  getFilterParamNames() {
    return Object.values(this.filterQueryMap);
  },

  parseFilterParamValues(values) {
    if (!Array.isArray(values)) return [];
    return values
      .flatMap(value => String(value || '').split(','))
      .map(value => value.trim())
      .filter(Boolean);
  },

  normalizeFilterValues(type, values) {
    const cleaned = Array.isArray(values) ? values : [];
    if (cleaned.length === 0) return [];

    const options = Array.isArray(this.filterOptions?.[type]) ? this.filterOptions[type] : [];
    const canonicalMap = new Map(options.map(option => [String(option).toLowerCase(), String(option)]));
    const results = [];
    const seen = new Set();

    for (const value of cleaned) {
      const raw = String(value || '').trim();
      if (!raw) continue;
      const normalized = raw.toLowerCase();
      const canonical = canonicalMap.size ? (canonicalMap.get(normalized) || raw) : raw;
      const key = canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(canonical);
    }

    return results;
  },

  getFiltersFromUrl(sourceUrl) {
    const filters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: [],
      themes: [],
      demographic: []
    };

    try {
      const url = new URL(sourceUrl || window.location.href);
      const paramMap = this.getFilterParamMap();
      Object.entries(paramMap).forEach(([type, param]) => {
        const values = this.parseFilterParamValues(url.searchParams.getAll(param));
        filters[type] = this.normalizeFilterValues(type, values);
      });
    } catch (error) {
      return filters;
    }

    return filters;
  },

  getSearchQueryFromUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      return String(url.searchParams.get('search') || '').trim();
    } catch (error) {
      return '';
    }
  },

  hasFilterParamsInUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      return this.getFilterParamNames().some(param => url.searchParams.has(param));
    } catch (error) {
      return false;
    }
  },

  areFiltersEqual(left, right) {
    const types = Object.keys(this.activeFilters);
    for (const type of types) {
      const a = Array.isArray(left?.[type]) ? left[type] : [];
      const b = Array.isArray(right?.[type]) ? right[type] : [];
      if (a.length !== b.length) return false;
      const setA = new Set(a.map(value => String(value).toLowerCase()));
      for (const value of b) {
        if (!setA.has(String(value).toLowerCase())) return false;
      }
    }
    return true;
  },

  setActiveFiltersFromUrl({ updateUi = false } = {}) {
    const nextFilters = this.getFiltersFromUrl();
    const changed = !this.areFiltersEqual(this.activeFilters, nextFilters);
    this.activeFilters = nextFilters;
    if (updateUi) {
      this.renderFilterPanel();
      this.renderQuickFilters();
    }
    return changed;
  },

  getSortedFilterValues(type, values) {
    const cleaned = Array.isArray(values) ? values.map(value => String(value)) : [];
    const unique = [...new Set(cleaned)];
    const options = Array.isArray(this.filterOptions?.[type]) ? this.filterOptions[type] : [];
    if (options.length === 0) {
      return unique.sort((a, b) => a.localeCompare(b));
    }
    const order = new Map(options.map((option, index) => [String(option), index]));
    return unique.sort((a, b) => {
      const orderA = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
      const orderB = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  },

  setFiltersOnUrl(url, filters) {
    if (!url) return;
    const paramMap = this.getFilterParamMap();
    Object.values(paramMap).forEach(param => url.searchParams.delete(param));
    Object.entries(paramMap).forEach(([type, param]) => {
      const values = this.getSortedFilterValues(type, filters?.[type] || []);
      values.forEach(value => url.searchParams.append(param, value));
    });
  },

  buildFilterStateUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      this.normalizeHomePath(url);
      this.setFiltersOnUrl(url, this.activeFilters);
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateUrlForSearch(query, { replace = false } = {}) {
    if (!this.isCatalogPage()) return '';
    try {
      const url = new URL(window.location.href);
      this.normalizeHomePath(url);
      const trimmed = String(query || '').trim();
      if (trimmed) {
        url.searchParams.set('search', trimmed);
      } else {
        url.searchParams.delete('search');
      }
      const nextUrl = url.toString();
      if (nextUrl === window.location.href) {
        return nextUrl;
      }
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](window.history.state || {}, '', nextUrl);
      this.setCanonicalUrl(this.buildCanonicalUrl(nextUrl));
      return nextUrl;
    } catch (error) {
      return '';
    }
  },

  updateUrlForFilters({ replace = false } = {}) {
    if (!this.isCatalogPage()) return '';
    try {
      const url = new URL(window.location.href);
      this.normalizeHomePath(url);
      this.setFiltersOnUrl(url, this.activeFilters);
      const nextUrl = url.toString();
      if (nextUrl === window.location.href) {
        return nextUrl;
      }
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](window.history.state || {}, '', nextUrl);
      this.setCanonicalUrl(this.buildCanonicalUrl(nextUrl));
      return nextUrl;
    } catch (error) {
      return '';
    }
  },

  getActiveFilterGroups() {
    const groups = [];
    Object.entries(this.activeFilters).forEach(([type, values]) => {
      const cleaned = values
        .map(value => String(value ?? '').trim())
        .filter(Boolean);
      if (cleaned.length === 0) return;
      groups.push({
        type,
        label: this.filterTypeLabels[type] || type,
        values: cleaned
      });
    });
    return groups;
  },

  buildFilterMeta() {
    const groups = this.getActiveFilterGroups();
    const summary = groups.map(group => `${group.label}: ${group.values.join(', ')}`);
    const headline = summary.join(' | ');
    const title = headline ? `${headline} | ${this.siteName}` : this.defaultMeta.title || this.siteName;
    const prefix = headline ? `Anime filtered by ${summary.join(', ')}.` : '';
    const baseDescription = this.defaultMeta.description || '';
    const description = this.buildMetaDescription(`${prefix} ${baseDescription}`.trim());
    return { title, description };
  },

  updateMetaForFilters() {
    if (!this.seoInitialized || this.currentAnimeId) return;
    const hasFilters = this.getActiveFilterGroups().length > 0;
    if (!hasFilters) {
      this.resetMetaToDefault();
      return;
    }

    const { title, description } = this.buildFilterMeta();
    const url = this.buildCanonicalUrl(this.buildFilterStateUrl());
    this.applyMetaTags({
      title,
      description: description || this.defaultMeta.description,
      image: this.defaultMeta.image,
      url,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title,
      description: description || this.defaultMeta.description,
      url,
      image: this.defaultMeta.image
    });
  },

  isCatalogPage() {
    return Boolean(document.getElementById('catalog-section'));
  },

  getEpisodeCount(anime) {
    if (!anime) return 0;
    const directCount = [
      anime.episodeCount,
      anime.episodesCount,
      anime.episodes_count,
      anime.metadata?.episodeCount,
      anime.metadata?.episodesCount,
      anime.metadata?.episodes_count
    ].reduce((max, candidate) => {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) && parsed > 0 ? Math.max(max, Math.floor(parsed)) : max;
    }, 0);
    const listCount = Array.isArray(anime.episodes)
      ? anime.episodes.reduce((max, episode, index) => {
        const parsed = Number(episode?.episode);
        const fallback = index + 1;
        const count = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
        return Math.max(max, Math.floor(count));
      }, 0)
      : 0;
    const statsCount = Number.isFinite(anime?.stats?.episodeCount) ? anime.stats.episodeCount : 0;
    return Math.max(directCount, listCount, statsCount);
  },

  isMobileViewport() {
    if (typeof window === 'undefined') return false;
    const query = window.matchMedia?.('(max-width: 640px)');
    if (query) return query.matches;
    return window.innerWidth <= 640;
  },

  getDefaultSettings() {
    return {
      trailerAutoplay: !this.isMobileViewport(),
      dataSaver: false,
      // Accessibility settings
      reducedMotion: false,
      highContrast: false,
      largeText: false
    };
  },

  getSettings() {
    if (!this.settings) {
      this.settings = this.getDefaultSettings();
    }
    return this.settings;
  },

  loadSettings() {
    const defaults = this.getDefaultSettings();
    this.settings = { ...defaults };
    if (typeof window === 'undefined') return;
    const cache = this.getCache();
    const parsed = cache.getJSON(this.settingsStorageKey, { fallback: null, validate: true });

    if (!parsed || typeof parsed !== 'object') {
      this.applyAccessibilityAttributes();
      return;
    }

    // Load all settings with defaults fallback
    this.settings.trailerAutoplay = typeof parsed.trailerAutoplay === 'boolean'
      ? parsed.trailerAutoplay
      : defaults.trailerAutoplay;
    this.settings.dataSaver = typeof parsed.dataSaver === 'boolean'
      ? parsed.dataSaver
      : defaults.dataSaver;
    this.settings.reducedMotion = typeof parsed.reducedMotion === 'boolean'
      ? parsed.reducedMotion
      : defaults.reducedMotion;
    this.settings.highContrast = typeof parsed.highContrast === 'boolean'
      ? parsed.highContrast
      : defaults.highContrast;
    this.settings.largeText = typeof parsed.largeText === 'boolean'
      ? parsed.largeText
      : defaults.largeText;

    this.applyAccessibilityAttributes();
    this.dispatchStore({ type: 'settings/loaded', payload: { ...this.settings } });
  },

  /**
   * Apply accessibility settings as data attributes on document
   */
  applyAccessibilityAttributes() {
    if (typeof document === 'undefined') return;

    const settings = this.getSettings();
    const root = document.documentElement;

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }

    // Apply high contrast
    if (settings.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }

    // Apply large text
    if (settings.largeText) {
      root.setAttribute('data-large-text', 'true');
    } else {
      root.removeAttribute('data-large-text');
    }

    // Apply data saver
    if (settings.dataSaver) {
      root.setAttribute('data-data-saver', 'true');
    } else {
      root.removeAttribute('data-data-saver');
    }
  },

  saveSettings() {
    if (typeof window === 'undefined') return;
    if (!this.settings) return;
    const cache = this.getCache();
    cache.setJSON(this.settingsStorageKey, this.settings, { validate: true });
  },

  updateSettingsUi() {
    const settings = this.getSettings();
    document.querySelectorAll('.settings-toggle-input').forEach(input => {
      const key = input.dataset.settingKey;
      if (!key || !Object.prototype.hasOwnProperty.call(settings, key)) return;
      input.checked = Boolean(settings[key]);
    });
  },

  updateSetting(key, value) {
    const settings = this.getSettings();
    if (!Object.prototype.hasOwnProperty.call(settings, key)) return;
    settings[key] = Boolean(value);
    this.saveSettings();
    this.updateSettingsUi();
    this.dispatchStore({ type: 'settings/updated', payload: { [key]: settings[key] } });

    // Apply accessibility attributes if needed
    if (['reducedMotion', 'highContrast', 'largeText', 'dataSaver'].includes(key)) {
      this.applyAccessibilityAttributes();
    }

    // Refresh trailer if relevant setting changed
    if (['trailerAutoplay', 'dataSaver'].includes(key)) {
      this.refreshTrailerSection();
    }
  },

  shouldEmbedTrailers() {
    const settings = this.getSettings();
    return !settings.dataSaver;
  },

  shouldAutoplayTrailers() {
    const settings = this.getSettings();
    return settings.trailerAutoplay && !settings.dataSaver;
  },

  loadTrailerEmbed(iframe) {
    if (!iframe || iframe.dataset.embedLoaded === '1') return;
    const embedSrc = iframe.dataset.embedSrc;
    if (!embedSrc) return;
    const safeEmbedSrc = this.buildEmbedUrlWithApi(embedSrc);
    if (!safeEmbedSrc) return;
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = safeEmbedSrc;
    this.setTrailerPaused(iframe, true);
  },

  refreshTrailerSection() {
    return this.getDetailExperience().refreshTrailerSection();
  },

  getModalElement(modalId) {
    return this.getRuntimeCapabilities().getModalElement(modalId);
  },

  getModalContent(modal) {
    return this.getRuntimeCapabilities().getModalContent(modal);
  },

  isModalVisible(modalId) {
    return this.getRuntimeCapabilities().isModalVisible(modalId);
  },

  getOpenModalId() {
    return this.getRuntimeCapabilities().getOpenModalId();
  },

  updateBodyScrollLock() {
    return this.getRuntimeCapabilities().updateBodyScrollLock();
  },

  isElementVisible(element) {
    return this.getRuntimeCapabilities().isElementVisible(element);
  },

  getFocusableElements(container) {
    return this.getRuntimeCapabilities().getFocusableElements(container);
  },

  activateModalFocus(modalId, { initialFocusSelector } = {}) {
    return this.getRuntimeCapabilities().activateModalFocus(modalId, { initialFocusSelector });
  },

  deactivateModalFocus(modalId, { returnFocus = true } = {}) {
    return this.getRuntimeCapabilities().deactivateModalFocus(modalId, { returnFocus });
  },

  setModalVisibility(modalId, isOpen, { initialFocusSelector, returnFocus = true } = {}) {
    return this.getRuntimeCapabilities().setModalVisibility(modalId, isOpen, { initialFocusSelector, returnFocus });
  },

  handleGlobalEscape(event) {
    return this.getRuntimeCapabilities().handleGlobalEscape(event);
  },

  toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const isOpen = modal.classList.contains('visible');
    if (!isOpen) {
      this.ensureSettingsRendered();
    }
    this.setModalVisibility('settings-modal', !isOpen, { initialFocusSelector: '#close-settings' });
  },

  closeSettingsModal() {
    this.setModalVisibility('settings-modal', false);
  },

  ensureSettingsRendered() {
    if (this.settingsRendered) return;
    this.renderSettingsModal();
  },

  renderSettingsModal() {
    const container = document.getElementById('settings-content');
    if (!container) return;
    setHTML(container, this.renderSettingsPanel({ includeTitle: false }));
    this.updateSettingsUi();
    this.settingsRendered = true;
  },


  areWatchlistSnapshotsEqual(left, right) {
    return areLifecycleWatchlistSnapshotsEqual(left, right);
  },

  refreshWatchlistSnapshotsFromCatalog({ persist = false } = {}) {
    return this.getWatchlistLifecycle().refreshSnapshotsFromCatalog(this.animeData, { persist, replaceExisting: true });
  },

  getWatchlistDisplayItems() {
    if (this.watchlistEntries.size === 0) return [];
    return this.getWatchlistLifecycle().getDisplayItems(this.animeData);
  },

  renderWatchlist() {
    const section = document.getElementById('watchlist-section');
    const grid = document.getElementById('watchlist-grid');
    const empty = document.getElementById('watchlist-empty');
    if (!section || !grid || !empty) return;

    const items = this.getWatchlistDisplayItems();
    if (items.length === 0) {
      section.classList.add('is-empty');
      grid.replaceChildren();
      return;
    }

    section.classList.remove('is-empty');
    if (this.features.templatePooling) {
      grid.replaceChildren(this.renderAnimeCardsDom(items, { startIndex: 0 }));
    } else {
      setHTML(grid, this.renderAnimeCards(items, { startIndex: 0 }));
    }
  },

  // Pagination state
  gridPageSize: 24,
  gridCurrentPage: 1,
  gridRenderedCount: 0,
  gridInitialBatchRendered: false,
  gridDeferredRenderHandle: null,
  initialGridBatchSize: 4,
  initialGridBatchSizeMobile: 3,
  gridSortedCache: null,
  gridSortedKey: '',
  gridSortedSource: null,
  gridSortedIsPartial: false,
  gridSortHandle: null,

  // Active filters state
  activeFilters: {
    seasonYear: [],
    year: [],
    studio: [],
    source: [],
    genres: [],
    themes: [],
    demographic: []
  },

  // Filter options (populated from data)
  filterOptions: {
    seasonYear: [],
    year: [],
    studio: [],
    source: [],
    genres: [],
    themes: [],
    demographic: []
  },

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.syncHomePath();
      this.renderLoadingState();
      this.initializeStore();
      this.loadWatchlist();
      this.migrateLegacyBookmarksToWatchlist();
      Discovery.setWatchlistProvider({
        getWatchlistAnime: () => this.getWatchlistAnime({ statuses: ['planned', 'watching', 'completed'] })
      });
      this.loadSettings();
      this.updateGridPageSize();
      this.applyPerformancePreferences();
      this.scheduleImageProxyCheck();

      // Check and trigger onboarding for first-time users
      if (!Onboarding.hasCompleted()) {
        this.queueIdleTask(() => Onboarding.startTour(), { timeout: 3000 });
      }

      const isCatalogPage = this.isCatalogPage();
      const requestedAnimeId = this.getAnimeIdFromUrl();

      if (!isCatalogPage) {
        this.renderWatchlist();
        this.scheduleAiringDashboardRender({ timeout: 2000 });
        if (requestedAnimeId) {
          this.showAnimeDetail(requestedAnimeId);
        }
      } else {
        const loaded = await this.loadInitialData();
        if (!loaded) {
          throw new Error('Failed to load catalog');
        }
        if (requestedAnimeId) {
          await this.handleDeepLink(requestedAnimeId);
        }
      }

      this.setupEventListeners();
      this.setupFullCatalogInteractionTriggers();
      this.queueIdleTask(() => this.setupHealthMonitoring(), { timeout: 2000 });
      this.queueIdleTask(() => this.setupIntelligentPrefetching(), { timeout: 2000 });
      this.initSeo();
      this.updateHomeLinks();

      // Only sync modal with URL if not handling deep link
      // (deep link is already handled above)
      if (!requestedAnimeId) {
        this.syncSearchWithUrl();
        this.syncModalWithUrl();
      }
      this.updateMetaForFilters();

    } catch (error) {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('Failed to initialize app', { error });
      } else {
        console.error('Failed to initialize app:', error);
      }
      this.showError('We could not load the catalog right now. Refresh to try again. If it still fails, the catalog may be updating.');
    }
  },


  /**
   * Update sort dropdown options
   */
  updateSortOptions() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    const options = Recommendations.getSortOptions();
    setHTML(select, options.map(opt =>
      `<option value="${opt.value}">${opt.label}</option>`
    ).join(''));

    if (!options.some(option => option.value === this.currentSort)) {
      this.currentSort = options[0]?.value || 'retention';
    }
    select.value = this.currentSort;
  },

  addTrackedListener(target, event, handler, options) {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(event, handler, options);
    this.registeredListeners.push({ target, event, handler, options });
  },

  removeAllListeners() {
    this.registeredListeners.forEach(({ target, event, handler, options }) => {
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener(event, handler, options);
      }
    });
    this.registeredListeners = [];
  },

  addPreloadHints() {
    if (this.preloadHintsAdded || typeof document === 'undefined') return;
    const fullIndexPath = this.getAssetPath(this.dataSources.full);
    const hints = [
      { rel: 'preconnect', href: 'https://cdn.myanimelist.net', crossorigin: 'anonymous' },
      { rel: 'dns-prefetch', href: 'https://api.jikan.moe' },
      { rel: 'preload', href: fullIndexPath, as: 'fetch', crossorigin: 'anonymous' }
    ];

    hints.forEach((hint) => {
      if (!hint.href) return;
      if (document.querySelector(`link[rel="${hint.rel}"][href="${hint.href}"]`)) return;
      const link = document.createElement('link');
      Object.entries(hint).forEach(([key, value]) => {
        link.setAttribute(key, value);
      });
      document.head.appendChild(link);
    });

    this.preloadHintsAdded = true;
  },

  preloadFullCatalog() {
    if (this.fullCatalogPreloadPromise || this.isFullDataLoaded) return;
    if (!this.shouldPrefetchFullCatalog()) return;
    this.fullCatalogPreloadPromise = (async () => {
      await new Promise(resolve => {
        this.queueIdleTask(resolve, { timeout: 2000 });
      });
      await this.loadFullCatalog();
    })()
      .catch(() => null)
      .finally(() => {
        this.fullCatalogPreloadPromise = null;
      });
  },

  scheduleFullCatalogLoad() {
    if (this.fullCatalogScheduleHandle || this.isFullDataLoaded) return;
    if (typeof window === 'undefined') {
      this.loadFullCatalog();
      return;
    }
    const delayMs = this.shouldPrefetchFullCatalog() ? 0 : 8000;
    const schedule = () => {
      this.fullCatalogScheduleHandle = this.queueIdleTask(() => {
        this.fullCatalogScheduleHandle = null;
        this.loadFullCatalog();
      }, { timeout: 2000 });
    };

    if (delayMs > 0) {
      this.fullCatalogScheduleHandle = window.setTimeout(schedule, delayMs);
      return;
    }
    schedule();
  },

  async loadInitialData() {
    return this.getCatalogRuntime().loadInitialData();
  },

  async loadFullCatalog(options = {}) {
    return this.getCatalogRuntime().loadFullCatalog(options);
  },

  async cacheFullCatalog(payload) {
    return this.getCatalogRuntime().cacheFullCatalog(payload);
  },

  async loadCachedFullCatalog() {
    return this.getCatalogRuntime().loadCachedFullCatalog();
  },

  async fetchCatalog(path, options = {}) {
    return this.getCatalogRuntime().fetchCatalog(path, options);
  },

  getAnimeDetailChunkPath(animeId) {
    return this.getCatalogRuntime().getAnimeDetailChunkPath(animeId);
  },

  hasFullAnimeDetail(anime) {
    if (!anime) return false;
    return Array.isArray(anime.episodes) && anime.episodes.length > 0;
  },

  mergeAnimeDetail(detailAnime) {
    const existingIndex = this.animeData.findIndex((anime) => String(anime.id) === String(detailAnime?.id));
    const existingAnime = existingIndex >= 0 ? this.animeData[existingIndex] : {};
    const normalized = this.normalizeAnimeData([{ ...existingAnime, ...detailAnime }])[0];
    if (!normalized?.id) return null;

    if (existingIndex >= 0) {
      this.animeData[existingIndex] = {
        ...this.animeData[existingIndex],
        ...normalized
      };
    } else {
      this.animeData.push(normalized);
    }

    this.detailCache.delete(normalized.id);
    this.gridSortedCache = null;
    this.gridSortedKey = '';
    this.gridSortedSource = null;
    this.refreshWatchlistSnapshotsFromCatalog({ persist: true });
    return normalized;
  },

  async loadAnimeDetailChunk(animeId) {
    return this.getCatalogRuntime().loadAnimeDetailChunk(animeId);
  },

  async applyCatalogPayload(payload, { isFull = false, preserveFilters = true } = {}) {
    const catalog = payload?.anime || [];
    this.scoreProfile = this.isValidScoreProfile(payload?.scoreProfile) ? payload.scoreProfile : null;
    this.animeData = this.normalizeAnimeData(catalog);
    if (DataValidator?.validateCatalog) {
      DataValidator.validateCatalog(this.animeData, { source: isFull ? 'full' : 'embedded' });
    }
    this.isFullDataLoaded = isFull;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.catalogStatus = isFull ? 'full' : 'embedded';
      root.dataset.catalogReady = 'true';
    }
    this.gridSortedCache = null;
    this.gridSortedKey = '';
    this.gridSortedSource = null;
    this.gridSortedIsPartial = false;
    if (this.gridSortHandle) {
      this.cancelIdleTask(this.gridSortHandle);
      this.gridSortHandle = null;
    }
    this.gridDomCache.clear();
    this.detailCache.clear();
    this.visibleCardIds.clear();

    if (HealthMonitor?.markDataFresh) {
      HealthMonitor.markDataFresh('catalog');
      if (HealthMonitor.performHealthChecks) {
        HealthMonitor.performHealthChecks();
      }
    }

    if (!preserveFilters) {
      this.activeFilters = this.getDefaultActiveFilters();
    }

    await this.ensureStats();
    this.refreshWatchlistSnapshotsFromCatalog({ persist: true });
    this.scheduleAiringDashboardRender({ timeout: 3500 });
    this.extractFilterOptions();
    this.deferFilterUiOnce = !this.deferFilterUiUsed && this.shouldEnableLowMotionMode();

    if (!this.urlFiltersApplied && this.isCatalogPage()) {
      const hasFilterParams = this.hasFilterParamsInUrl();
      this.setActiveFiltersFromUrl();
      this.urlFiltersApplied = true;
      if (hasFilterParams) {
        this.updateUrlForFilters({ replace: true });
      }
    }

    if (!this.deferFilterUiOnce) {
      this.updateSortOptions();
      if (this.filterPanelRendered || this.filterPanelOpen) {
        this.renderFilterPanel({ force: true });
      } else {
        this.scheduleFilterPanelRender();
      }
      this.renderQuickFilters();
    }
    this.applyFilters({ syncUrl: false, updateMeta: false });
  },

  renderCardSkeleton(type = 'catalog') {
    if (type === 'recommendation') {
      return `
        <div class="recommendation-card skeleton-card skeleton-recommendation">
          <div class="recommendation-media"></div>
          <div class="recommendation-info">
            <span class="skeleton-line skeleton-title"></span>
            <span class="skeleton-line skeleton-meta"></span>
            <span class="skeleton-line skeleton-copy"></span>
          </div>
        </div>
      `;
    }

    return `
      <div class="anime-card skeleton-card skeleton-grid">
        <div class="card-media"></div>
        <div class="card-body">
          <span class="skeleton-line skeleton-title"></span>
          <span class="skeleton-line skeleton-meta"></span>
          <span class="skeleton-line skeleton-signal"></span>
          <div class="card-badges">
            <span class="skeleton-pill"></span>
            <span class="skeleton-pill"></span>
          </div>
          <div class="card-stats">
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
          </div>
          <span class="skeleton-meter"></span>
          <span class="skeleton-line skeleton-copy"></span>
        </div>
      </div>
    `;
  },

  renderLoadingState() {
    const recommendations = document.getElementById('recommendations-grid');
    const rankings1 = document.getElementById('best-ranking-1');
    const rankings2 = document.getElementById('best-ranking-2');
    const grid = document.getElementById('anime-grid');

    if (recommendations) {
      recommendations.classList.add('is-loading');
      recommendations.setAttribute('aria-busy', 'true');
      setHTML(recommendations, Array.from({ length: 6 }, () => this.renderCardSkeleton('recommendation')).join(''));
    }

    if (grid) {
      grid.classList.add('is-loading');
      grid.setAttribute('aria-busy', 'true');
      setHTML(grid, Array.from({ length: 6 }, () => this.renderCardSkeleton('catalog')).join(''));
    }

    if (rankings1) {
      rankings1.setAttribute('aria-busy', 'true');
    }

    if (rankings2) {
      rankings2.setAttribute('aria-busy', 'true');
    }

    this.renderDeferredUiLoadingState();
  },

  renderDeferredUiLoadingState() {
    const genreContainer = document.getElementById('genre-chips');
    const themeContainer = document.getElementById('theme-chips');
    const seasonalContainer = document.getElementById('seasonal-chips');
    const modeContainer = document.getElementById('mode-chips');

    if (genreContainer) {
      genreContainer.setAttribute('aria-busy', 'true');
      setHTML(genreContainer, `
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">Action</button>
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">Drama</button>
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">Fantasy</button>
      `);
    }

    if (themeContainer) {
      themeContainer.setAttribute('aria-busy', 'true');
      setHTML(themeContainer, `
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">School</button>
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">Isekai</button>
        <button class="quick-chip is-loading-chip" type="button" disabled aria-hidden="true">Music</button>
      `);
    }

    if (seasonalContainer) {
      seasonalContainer.setAttribute('aria-busy', 'true');
      setHTML(seasonalContainer, `
        <button class="seasonal-chip is-loading-chip" type="button" disabled aria-hidden="true">Spring 2026</button>
      `);
    }

    if (modeContainer) {
      modeContainer.setAttribute('aria-busy', 'true');
      setHTML(modeContainer, `
        <button class="mode-chip is-loading-chip" type="button" disabled aria-hidden="true">Personalized</button>
        <button class="mode-chip is-loading-chip" type="button" disabled aria-hidden="true">Safe picks</button>
        <button class="mode-chip is-loading-chip" type="button" disabled aria-hidden="true">Hidden gems</button>
      `);
    }
  },

  setupHealthMonitoring() {
    if (!HealthMonitor?.init || typeof document === 'undefined') return;
    HealthMonitor.init();

    if (typeof this.healthMonitorUnsubscribe === 'function') {
      this.healthMonitorUnsubscribe();
      this.healthMonitorUnsubscribe = null;
    }

    this.healthMonitorUnsubscribe = HealthMonitor.subscribe((event, data) => {
      if (event === 'connectivity' && data?.online && HealthMonitor.isDataStale?.('catalog')) {
        this.setupFullCatalogInteractionTriggers();
      }
      this.renderHealthIndicator();
    });

    this.renderHealthIndicator();
  },

  renderHealthIndicator() {
    if (!HealthMonitor?.getStatus || typeof document === 'undefined') return;
    const status = HealthMonitor.getStatus();
    const existing = document.getElementById('health-indicator');

    if (status.online && status.healthy) {
      if (existing) {
        existing.remove();
      }
      return;
    }

    const indicator = existing || document.createElement('div');
    indicator.id = 'health-indicator';
    indicator.className = `health-indicator ${status.online ? 'degraded' : 'offline'}`;
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');

    const unhealthyServices = status.services
      .filter(service => !service.healthy)
      .map(service => service.label || service.name);

    let title = 'Service degraded';
    let detail = 'Some services are temporarily unavailable.';
    let icon = '!';

    if (!status.online) {
      title = 'Offline';
      detail = 'Using cached data until you reconnect.';
      icon = 'x';
    } else if (unhealthyServices.length > 0) {
      detail = `Unavailable: ${unhealthyServices.join(', ')}`;
    }

    const retryButton = '<button class="health-retry" type="button" data-action="check-connectivity">Retry</button>';
    setHTML(indicator, `
      <span class="health-icon" aria-hidden="true">${icon}</span>
      <div class="health-message">
        <div class="health-title">${title}</div>
        <div class="health-detail">${detail}</div>
      </div>
      ${retryButton}
    `);

    if (!existing) {
      document.body.appendChild(indicator);
    }
  },

  async ensureStats() {
    if (!Array.isArray(this.animeData) || this.animeData.length === 0) return;
    let needsStats = false;
    let needsColorIndex = false;

    for (let i = 0; i < this.animeData.length; i += 1) {
      const anime = this.animeData[i];
      if (!anime?.stats) needsStats = true;
      if (!Number.isFinite(anime?.colorIndex)) needsColorIndex = true;
      if (needsStats && needsColorIndex) break;
    }

    if (!needsStats) {
      if (!needsColorIndex) return;
      this.animeData.forEach((anime, index) => {
        if (!Number.isFinite(anime.colorIndex)) {
          anime.colorIndex = index;
        }
      });
      return;
    }

    let Stats = null;
    try {
      Stats = await this.loadStatsModule();
    } catch (error) {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('[ensureStats] Failed to load stats module', { error });
      } else {
        console.error('[ensureStats] Failed to load stats module:', error);
      }
      return;
    }
    const scoreProfile = this.isValidScoreProfile(this.scoreProfile)
      ? this.scoreProfile
      : Stats.buildScoreProfile(this.animeData);

    this.scoreProfile = scoreProfile;

    this.animeData.forEach((anime, index) => {
      if (!anime.stats) {
        anime.stats = Stats.calculateAllStats(anime, scoreProfile);
      }
      if (!Number.isFinite(anime.colorIndex)) {
        anime.colorIndex = index;
      }
    });
  },

  isValidScoreProfile(profile) {
    return Boolean(profile && Number.isFinite(profile.p35) && Number.isFinite(profile.p50) && Number.isFinite(profile.p65));
  },

  /**
   * Load embedded data only when fetch fails (keeps initial load light).
   */
  async loadEmbeddedData() {
    if (typeof ANIME_DATA !== 'undefined') {
      const validation = this.validateAnimeData(ANIME_DATA.anime);
      if (validation.isValid) {
        this.animeData = this.normalizeAnimeData(ANIME_DATA.anime || []);
        return true;
      }
      console.warn('[loadEmbeddedData] Existing embedded data invalid:', validation.errors);
    }

    try {
      await this.loadEmbeddedDataScript();
    } catch (error) {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('[loadEmbeddedData] Failed to load embedded data script', { error });
      } else {
        console.error('[loadEmbeddedData] Failed to load embedded data script:', error);
      }
      return false;
    }

    if (typeof ANIME_DATA === 'undefined') {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('[loadEmbeddedData] ANIME_DATA not defined after script load');
      } else {
        console.error('[loadEmbeddedData] ANIME_DATA not defined after script load');
      }
      return false;
    }

    const validation = this.validateAnimeData(ANIME_DATA.anime);
    if (!validation.isValid) {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('[loadEmbeddedData] Embedded data validation failed', { errors: validation.errors });
      } else {
        console.error('[loadEmbeddedData] Embedded data validation failed:', validation.errors);
      }
      return false;
    }

    this.animeData = this.normalizeAnimeData(ANIME_DATA.anime || []);
    return true;
  },

  loadEmbeddedDataScript() {
    if (this.embeddedDataPromise) {
      return this.embeddedDataPromise;
    }

    this.embeddedDataPromise = new Promise((resolve, reject) => {
      const timeoutMs = 10000;
      const script = document.createElement('script');
      setScriptSource(script, this.getAssetPath('js/data.js'));
      script.async = true;
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Embedded data script load timed out'));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timeoutId);
        script.onload = null;
        script.onerror = null;
      };
      script.onload = () => {
        cleanup();
        resolve();
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to load embedded anime data'));
      };
      document.head.appendChild(script);
    });

    return this.embeddedDataPromise
      .catch((error) => {
        this.embeddedDataPromise = null;
        throw error;
      });
  },

  validateAnimeData(animeList) {
    const errors = [];
    if (!Array.isArray(animeList)) {
      return { isValid: false, errors: ['anime is not an array'] };
    }
    if (animeList.length === 0) {
      return { isValid: true, errors: [], isEmpty: true };
    }

    const sampleSize = Math.min(animeList.length, 5);
    for (let i = 0; i < sampleSize; i += 1) {
      const anime = animeList[i];
      if (!anime) {
        errors.push(`Item ${i} is null or undefined`);
        continue;
      }
      if (typeof anime.id === 'undefined') {
        errors.push(`Item ${i} missing id`);
      }
      if (!anime.title || typeof anime.title !== 'string') {
        errors.push(`Item ${i} missing or invalid title`);
      }
    }

    const isValid = errors.length < Math.ceil(sampleSize * 0.2);
    return { isValid, errors, itemCount: animeList.length };
  },

  /**
   * Normalize anime data to handle both flat and nested (metadata) structures
   * This ensures compatibility with both old format and new scraper output
   */
  normalizeAnimeData(animeList) {
    return animeList.map(anime => {
      const normalizedGenres = this.sanitizeTagList(anime?.metadata?.genres || anime?.genres || []);
      const normalizedThemes = this.sanitizeTagList(anime?.metadata?.themes || anime?.themes || []);
      const normalizedTrailer = anime?.metadata?.trailer || anime?.trailer || null;
      const normalizedSynopsis = anime?.metadata?.synopsis || anime?.synopsis || '';
      const existingStats = anime?.stats || anime?.metadata?.stats || null;
      const existingColorIndex = Number.isFinite(anime?.colorIndex) ? anime.colorIndex : null;
      const existingSearchText = typeof anime?.searchText === 'string' ? anime.searchText : '';
      const existingSearchIndex = anime?.searchIndex || null;
      const normalizedTitleEnglish =
        anime?.metadata?.title_english ||
        anime?.metadata?.titleEnglish ||
        anime?.title_english ||
        anime?.titleEnglish ||
        '';
      const normalizedTitleJapanese =
        anime?.metadata?.title_japanese ||
        anime?.metadata?.titleJapanese ||
        anime?.title_japanese ||
        anime?.titleJapanese ||
        '';
      const normalizedType = anime?.metadata?.type || anime?.type || '';
      const rawCommunityScore = anime?.communityScore ?? anime?.metadata?.score ?? anime?.score;
      const communityScore = Number.isFinite(Number(rawCommunityScore)) ? Number(rawCommunityScore) : null;

      // If data has nested metadata structure, flatten it
      if (anime.metadata) {
        const resolvedTitle = anime.metadata.title || anime.title;
        const shouldBuildSearchIndex = !existingSearchIndex && !existingSearchText;
        const searchIndex = shouldBuildSearchIndex
          ? this.buildSearchIndex(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese)
          : existingSearchIndex;
        const searchText = shouldBuildSearchIndex
          ? this.mergeSearchText(existingSearchText, searchIndex)
          : existingSearchText;
        return {
          id: anime.metadata.id || anime.id,
          title: resolvedTitle,
          titleEnglish: normalizedTitleEnglish,
          titleJapanese: normalizedTitleJapanese,
          malId: anime.metadata.malId || anime.mal_id || anime.malId,
          anilistId: anime.metadata.anilistId || anime.anilistId,
          cover: anime.metadata.cover || anime.cover,
          type: normalizedType,
          year: anime.metadata.year || anime.year,
          season: anime.metadata.season || anime.season,
          studio: anime.metadata.studio || anime.studio,
          source: anime.metadata.source || anime.source,
          genres: normalizedGenres,
          themes: normalizedThemes,
          demographic: anime.metadata.demographic || anime.demographic,
          trailer: normalizedTrailer,
          synopsis: normalizedSynopsis,
          communityScore: communityScore,
          episodeCount: this.getEpisodeCount(anime),
          searchIndex: searchIndex,
          searchText: searchText,
          episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
          stats: existingStats,
          colorIndex: existingColorIndex,
          franchise: anime.franchise || anime.metadata.franchise || null
        };
      }
      // Already flat structure, ensure all fields exist
      const resolvedTitle = anime.title;
      const shouldBuildSearchIndex = !existingSearchIndex && !existingSearchText;
      const searchIndex = shouldBuildSearchIndex
        ? this.buildSearchIndex(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese)
        : existingSearchIndex;
      const searchText = shouldBuildSearchIndex
        ? this.mergeSearchText(existingSearchText, searchIndex)
        : existingSearchText;
      return {
        id: anime.id,
        title: resolvedTitle,
        titleEnglish: normalizedTitleEnglish,
        titleJapanese: normalizedTitleJapanese,
        malId: anime.malId,
        anilistId: anime.anilistId,
        cover: anime.cover,
        type: normalizedType,
        year: anime.year,
        season: anime.season,
        studio: anime.studio,
        source: anime.source,
        genres: normalizedGenres,
        themes: normalizedThemes,
        demographic: anime.demographic,
        trailer: normalizedTrailer,
        synopsis: normalizedSynopsis,
        communityScore: communityScore,
        episodeCount: this.getEpisodeCount(anime),
        searchIndex: searchIndex,
        searchText: searchText,
        episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
        stats: existingStats,
        colorIndex: existingColorIndex,
        franchise: anime.franchise || null
      };
    });
  },

  /**
   * Normalize tag arrays to avoid empty or undefined labels
   * @param {Array} tags - Raw tag list
   * @returns {Array} Cleaned tag list
   */
  sanitizeTagList(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const cleaned = [];

    for (const tag of tags) {
      const label = String(tag ?? '').trim();
      const normalized = label.toLowerCase();
      if (!label || normalized === 'undefined' || normalized === 'null') continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      cleaned.push(label);
    }

    return cleaned;
  },

  normalizeSearchQuery(value, { stripPunctuation = false, compact = false } = {}) {
    let normalized = String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFKC');

    if (stripPunctuation) {
      normalized = normalized.replace(/[-_/\\:;,.!?'"(){}\[\]<>|~`@#$%^&*=+]/g, ' ');
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (compact) {
      return normalized.replace(/\s+/g, '');
    }
    return normalized;
  },

  buildSearchIndex(title, titleEnglish, titleJapanese) {
    const rawParts = [title, titleEnglish, titleJapanese]
      .map(value => String(value || '').trim())
      .filter(Boolean);

    const variants = new Set();
    const compactVariants = new Set();

    rawParts.forEach(value => {
      const normalized = this.normalizeSearchQuery(value);
      const loose = this.normalizeSearchQuery(value, { stripPunctuation: true });
      const compact = this.normalizeSearchQuery(value, { stripPunctuation: true, compact: true });
      if (normalized) variants.add(normalized);
      if (loose) variants.add(loose);
      if (compact) compactVariants.add(compact);
    });

    const tokenSet = new Set();
    variants.forEach(text => {
      text.split(' ').forEach(token => {
        if (token) tokenSet.add(token);
      });
    });

    return {
      variants: Array.from(variants),
      compactVariants: Array.from(compactVariants),
      tokenSet
    };
  },

  mergeSearchText(existingText, searchIndex) {
    const parts = [];
    if (existingText) parts.push(existingText);
    if (searchIndex?.variants) parts.push(...searchIndex.variants);
    if (searchIndex?.compactVariants) parts.push(...searchIndex.compactVariants);
    return [...new Set(parts.filter(Boolean))].join(' ');
  },

  buildSearchText(title, titleEnglish, titleJapanese) {
    const searchIndex = this.buildSearchIndex(title, titleEnglish, titleJapanese);
    return this.mergeSearchText('', searchIndex);
  },

  prepareSearchQuery(query) {
    const normalized = this.normalizeSearchQuery(query);
    const loose = this.normalizeSearchQuery(query, { stripPunctuation: true });
    const compact = this.normalizeSearchQuery(query, { stripPunctuation: true, compact: true });
    const tokens = loose.split(' ').filter(Boolean);
    return { normalized, loose, compact, tokens };
  },

  getSearchIndex(anime) {
    if (anime?.searchIndex) return anime.searchIndex;
    const index = this.buildSearchIndex(anime?.title, anime?.titleEnglish, anime?.titleJapanese);
    if (anime) {
      anime.searchIndex = index;
      anime.searchText = this.mergeSearchText(anime.searchText, index);
    }
    return index;
  },

  scoreSearchMatch(index, queryInfo) {
    if (!index || !queryInfo) return 0;
    const { normalized, loose, compact, tokens } = queryInfo;
    if (!normalized && !loose && !compact) return 0;

    const variants = index.variants || [];
    const compactVariants = index.compactVariants || [];
    const tokenSet = index.tokenSet || new Set();

    const exact = variants.some(value => value === normalized || value === loose);
    if (exact) return 100;

    const startsWith = variants.some(value => value.startsWith(normalized) || value.startsWith(loose));
    if (startsWith) return 90;

    const contains = variants.some(value => value.includes(normalized) || value.includes(loose));
    if (contains) return 75;

    if (tokens.length) {
      const tokenMatch = tokens.every(token => tokenSet.has(token));
      if (tokenMatch && tokens.length > 1) return 70;
      if (tokenMatch) return 60;
    }

    if (compact) {
      const compactMatch = compactVariants.some(value => value.includes(compact));
      if (compactMatch) return 55;
    }

    return 0;
  },

  findSearchMatches(query) {
    const queryInfo = this.prepareSearchQuery(query);
    const results = [];

    for (const anime of this.animeData) {
      const index = this.getSearchIndex(anime);
      const score = this.scoreSearchMatch(index, queryInfo);
      if (score > 0) {
        results.push({ anime, score });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.anime.title || '').localeCompare(String(b.anime.title || ''));
    });

    return results.slice(0, this.searchMaxResults).map(item => item.anime);
  },

  getCatalogSearchQuery() {
    return String(this.getSearchQueryFromUrl() || '').slice(0, 120).trim();
  },

  matchesCatalogSearch(anime, queryInfo) {
    if (!anime || !queryInfo) return false;
    const index = this.getSearchIndex(anime);
    if (this.scoreSearchMatch(index, queryInfo) > 0) return true;

    const searchableText = [
      anime.searchText,
      anime.title,
      anime.titleEnglish,
      anime.titleJapanese,
      anime.studio,
      anime.source,
      anime.demographic,
      ...(Array.isArray(anime.genres) ? anime.genres : []),
      ...(Array.isArray(anime.themes) ? anime.themes : [])
    ]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    const looseText = this.normalizeSearchQuery(searchableText, { stripPunctuation: true });
    const compactText = this.normalizeSearchQuery(searchableText, { stripPunctuation: true, compact: true });
    if (!looseText && !compactText) return false;
    if (queryInfo.loose && looseText.includes(queryInfo.loose)) return true;
    if (queryInfo.compact && compactText.includes(queryInfo.compact)) return true;
    return queryInfo.tokens.length > 0 && queryInfo.tokens.every(token => looseText.includes(token));
  },

  filterDataBySearch(animeList, query) {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 2) return animeList;
    const queryInfo = this.prepareSearchQuery(trimmed);
    return animeList.filter(anime => this.matchesCatalogSearch(anime, queryInfo));
  },

  applyHeaderSearchQuery(query, { scroll = true } = {}) {
    const trimmed = String(query || '').trim();
    this.updateUrlForSearch(trimmed.length >= 2 ? trimmed : '', { replace: true });
    this.applyFilters({ syncUrl: false, updateMeta: true });
    if (scroll && trimmed.length >= 2) {
      this.scrollToResultsSection();
    }
  },

  clearHeaderSearchQuery({ scroll = false } = {}) {
    this.updateUrlForSearch('', { replace: true });
    this.resetHeaderSearch({ clearInput: true });
    this.applyFilters({ syncUrl: false, updateMeta: true });
    if (scroll) {
      this.scrollToResultsSection();
    }
  },

  updateHeaderSearchDropdownVisibility(dropdown, isVisible) {
    if (!dropdown) return;
    dropdown.classList.toggle('visible', isVisible);
    const input = document.getElementById('header-search');
    if (input) {
      input.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    }
  },

  setHeaderSearchActiveIndex(index, { scroll = true } = {}) {
    const dropdown = document.getElementById('header-search-dropdown');
    const input = document.getElementById('header-search');
    if (!dropdown) return;

    const items = Array.from(dropdown.querySelectorAll('.search-result-item'));
    const safeIndex = Number.isInteger(index) ? index : -1;
    this.headerSearchState.activeIndex = safeIndex;

    items.forEach((item, itemIndex) => {
      const isActive = itemIndex === safeIndex;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (input) {
      if (safeIndex >= 0 && items[safeIndex]) {
        input.setAttribute('aria-activedescendant', items[safeIndex].id || '');
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    if (scroll && safeIndex >= 0 && items[safeIndex]) {
      items[safeIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  resetHeaderSearch({ clearInput = false } = {}) {
    const dropdown = document.getElementById('header-search-dropdown');
    const input = document.getElementById('header-search');
    this.headerSearchState.query = '';
    this.headerSearchState.results = [];
    this.headerSearchState.activeIndex = -1;
    if (dropdown) {
      dropdown.replaceChildren();
      this.updateHeaderSearchDropdownVisibility(dropdown, false);
    }
    if (input) {
      if (clearInput) {
        input.value = '';
      }
      input.removeAttribute('aria-activedescendant');
    }
  },

  closeHeaderSearchDropdown() {
    const dropdown = document.getElementById('header-search-dropdown');
    if (!dropdown) return;
    this.updateHeaderSearchDropdownVisibility(dropdown, false);
    this.setHeaderSearchActiveIndex(-1, { scroll: false });
  },

  /**
   * Calculate statistics for all anime
   */
  async calculateAllStats() {
    const Stats = await this.loadStatsModule();
    const scoreProfile = Stats.buildScoreProfile(this.animeData);
    this.scoreProfile = scoreProfile;
    this.animeData = this.animeData.map((anime, index) => ({
      ...anime,
      stats: Stats.calculateAllStats(anime, scoreProfile),
      colorIndex: index
    }));
  },

  /**
   * Extract unique filter options from data
   */
  extractFilterOptions() {
    const seasonYears = new Set();
    const years = new Set();
    const studios = new Set();
    const sources = new Set();
    const genres = new Set();
    const themes = new Set();
    const demographics = new Set();

    this.animeData.forEach(anime => {
      // Generate season-year combinations
      if (anime.year && anime.season) {
        seasonYears.add(`${anime.season} ${anime.year}`);
      }
      // Extract year
      if (anime.year) {
        years.add(anime.year);
      }
      // Handle studio as string or array
      if (anime.studio) {
        if (Array.isArray(anime.studio)) {
          anime.studio.forEach(s => studios.add(s));
        } else {
          studios.add(anime.studio);
        }
      }
      if (anime.source) sources.add(anime.source);
      if (anime.genres) anime.genres.forEach(g => genres.add(g));
      if (anime.themes) anime.themes.forEach(t => themes.add(t));
      if (anime.demographic) demographics.add(anime.demographic);
    });

    // Sort season-year by year descending, then by season order
    const seasonOrder = { 'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3 };
    const sortedSeasonYears = [...seasonYears].sort((a, b) => {
      const [seasonA, yearA] = a.split(' ');
      const [seasonB, yearB] = b.split(' ');
      if (yearA !== yearB) {
        return parseInt(yearB) - parseInt(yearA); // Descending year
      }
      return seasonOrder[seasonB] - seasonOrder[seasonA]; // Descending season within year
    });

    // Sort years descending (newest first)
    const sortedYears = [...years].sort((a, b) => b - a);

    this.filterOptions = {
      seasonYear: sortedSeasonYears,
      year: sortedYears,
      studio: [...studios].sort(),
      source: [...sources].sort(),
      genres: [...genres].sort(),
      themes: [...themes].sort(),
      demographic: [...demographics].sort()
    };
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.removeAllListeners();
    // Sort dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      this.addTrackedListener(sortSelect, 'change', (e) => {
        this.currentSort = e.target.value;
        this.resetGridPagination();
        this.renderAnimeGrid();
      });
    }

    // Filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      this.addTrackedListener(filterToggle, 'click', () => {
        this.toggleFilterPanel();
      });
    }

    // Clear all filters
    const clearFilters = document.getElementById('clear-filters');
    if (clearFilters) {
      this.addTrackedListener(clearFilters, 'click', () => {
        this.clearAllFilters();
      });
    }

    const clearActiveFilters = document.getElementById('active-filters-clear');
    if (clearActiveFilters) {
      this.addTrackedListener(clearActiveFilters, 'click', () => {
        this.clearAllFilters();
      });
    }

    // Close detail modal
    const closeDetail = document.getElementById('close-detail');
    if (closeDetail) {
      this.addTrackedListener(closeDetail, 'click', () => {
        this.closeDetailModal();
      });
    }

    // Click outside modal to close
    const modal = document.getElementById('detail-modal');
    if (modal) {
      this.addTrackedListener(modal, 'click', (e) => {
        if (e.target === modal) {
          this.closeDetailModal();
        }
      });
    }

    // Filter modal close button
    const closeFilterModal = document.getElementById('close-filter-modal');
    if (closeFilterModal) {
      this.addTrackedListener(closeFilterModal, 'click', () => {
        this.closeFilterModal();
      });
    }

    // Click outside filter modal to close
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
      this.addTrackedListener(filterModal, 'click', (e) => {
        if (e.target === filterModal) {
          this.closeFilterModal();
        }
      });
    }

    // Apply filters button
    const applyFilters = document.getElementById('apply-filters');
    if (applyFilters) {
      this.addTrackedListener(applyFilters, 'click', () => {
        this.closeFilterModal();
      });
    }

    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle) {
      this.addTrackedListener(settingsToggle, 'click', () => {
        this.toggleSettingsModal();
      });
    }

    const helpToggle = document.getElementById('help-toggle');
    if (helpToggle) {
      this.addTrackedListener(helpToggle, 'click', () => {
        Onboarding.reopenTour();
      });
    }

    const surpriseToggle = document.getElementById('surprise-toggle');
    if (surpriseToggle) {
      this.addTrackedListener(surpriseToggle, 'click', () => {
        const excludeIds = this.getWatchlistIds();
        const surprise = Discovery.getSurpriseMe(this.animeData, {
          excludeIds,
          useWatchlist: true
        });

        if (surprise) {
          Discovery.trackSurpriseMe(surprise.id);
          this.showAnimeDetail(surprise.id);
        }
      });
    }

    const closeMetricHelp = document.getElementById('close-metric-help');
    if (closeMetricHelp) {
      this.addTrackedListener(closeMetricHelp, 'click', () => {
        this.closeMetricHelpModal();
      });
    }

    const metricHelpModal = document.getElementById('metric-help-modal');
    if (metricHelpModal) {
      this.addTrackedListener(metricHelpModal, 'click', (e) => {
        if (e.target === metricHelpModal) {
          this.closeMetricHelpModal();
        }
      });
    }

    const closeSettings = document.getElementById('close-settings');
    if (closeSettings) {
      this.addTrackedListener(closeSettings, 'click', () => {
        this.closeSettingsModal();
      });
    }

    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
      this.addTrackedListener(settingsModal, 'click', (e) => {
        if (e.target === settingsModal) {
          this.closeSettingsModal();
        }
      });
    }

    this.addTrackedListener(document, 'change', (event) => {
      const target = event.target;
      if (!target) return;

      const action = target.dataset?.action;
      if (action === 'watch-status') {
        const animeId = target.dataset.animeId || this.currentAnimeId;
        if (!animeId) return;
        const episodeCount = this.getEpisodeLimitForAnime(animeId);
        this.setWatchStatus(animeId, target.value, { episodeCount });
        return;
      }

      if (action === 'watch-progress') {
        const animeId = target.dataset.animeId || this.currentAnimeId;
        if (!animeId) return;
        const episodeCount = this.getEpisodeLimitForAnime(animeId);
        this.setWatchProgress(animeId, target.value, { episodeCount });
        return;
      }

      if (!target.classList.contains('settings-toggle-input')) return;
      const key = target.dataset.settingKey;
      if (!key) return;
      this.updateSetting(key, target.checked);
    });

    this.addTrackedListener(document, 'keydown', (event) => {
      if (this.handleGlobalEscape(event)) {
        event.preventDefault();
      }
    });

    this.addTrackedListener(window, 'popstate', () => {
      const filtersChanged = this.setActiveFiltersFromUrl({ updateUi: true });
      const searchQuery = this.getCatalogSearchQuery();
      const searchChanged = searchQuery !== this.lastAppliedSearchQuery;
      if (filtersChanged || searchChanged) {
        this.applyFilters({ syncUrl: false, updateMeta: false });
      }
      this.syncSearchWithUrl({ openDropdown: false });
      this.syncModalWithUrl({ updateUrl: false });
      this.updateMetaForFilters();
    });

    const queueTooltipPosition = (trigger) => {
      if (!trigger || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
      window.requestAnimationFrame(() => this.positionTooltip(trigger));
    };

    this.addTrackedListener(document, 'mouseover', (event) => {
      const trigger = event.target?.closest?.('.has-tooltip');
      if (!trigger) return;
      queueTooltipPosition(trigger);
    });

    this.addTrackedListener(document, 'focusin', (event) => {
      const trigger = event.target?.closest?.('.has-tooltip');
      if (!trigger) return;
      queueTooltipPosition(trigger);
    });

    this.addTrackedListener(window, 'resize', () => {
      const activeTrigger = document.querySelector('.has-tooltip:hover, .has-tooltip:focus, .has-tooltip:focus-within');
      if (activeTrigger) {
        this.positionTooltip(activeTrigger);
      }
    });

    // Header search
    this.setupHeaderSearch();
    this.setupActionDelegates();
    this.setupImageFallbacks();
    this.setupFilterFab();
  },

  /**
   * Setup header search functionality
   */
  setupHeaderSearch() {
    const headerSearch = document.getElementById('header-search');
    const headerDropdown = document.getElementById('header-search-dropdown');
    const headerForm = document.getElementById('header-search-form');

    if (!headerSearch || !headerDropdown) return;

    this.addTrackedListener(headerSearch, 'input', (e) => {
      this.handleHeaderSearch(e.target.value);
    });

    this.addTrackedListener(headerSearch, 'focus', () => {
      if (headerSearch.value.length > 0) {
        this.handleHeaderSearch(headerSearch.value, { preserveActive: true });
      }
    });

    this.addTrackedListener(headerSearch, 'keydown', (event) => {
      this.handleHeaderSearchKeydown(event);
    });

    this.addTrackedListener(headerDropdown, 'mousemove', (event) => {
      const item = event.target.closest('.search-result-item');
      if (!item) return;
      const index = Number(item.dataset.resultIndex);
      if (Number.isInteger(index)) {
        this.setHeaderSearchActiveIndex(index, { scroll: false });
      }
    });

    this.addTrackedListener(headerDropdown, 'mouseleave', () => {
      if (this.headerSearchState.activeIndex !== -1) {
        this.setHeaderSearchActiveIndex(-1, { scroll: false });
      }
    });

    // Close dropdown when clicking outside
    this.addTrackedListener(document, 'click', (e) => {
      if (!e.target.closest('.header-search-wrapper')) {
        this.closeHeaderSearchDropdown();
      }
    });

    if (headerForm) {
      this.addTrackedListener(headerForm, 'submit', (event) => {
        event.preventDefault();
        const query = String(headerSearch.value || '').trim();
        if (query.length >= 2) {
          this.handleHeaderSearch(query);
          this.applyHeaderSearchQuery(query);
        } else {
          this.clearHeaderSearchQuery();
        }
      });
    }
  },

  syncSearchWithUrl({ openDropdown = true } = {}) {
    if (!this.isCatalogPage()) return false;
    const headerSearch = document.getElementById('header-search');
    if (!headerSearch) return false;

    const rawQuery = this.getSearchQueryFromUrl();
    const query = String(rawQuery || '').slice(0, 120).trim();

    if (!query) {
      if (headerSearch.value) {
        this.resetHeaderSearch({ clearInput: true });
      }
      return false;
    }

    if (headerSearch.value !== query) {
      headerSearch.value = query;
    }

    if (query.length >= 2) {
      this.handleHeaderSearch(query, { preserveActive: false });
      if (!openDropdown) {
        this.closeHeaderSearchDropdown();
      }
      return true;
    }

    this.resetHeaderSearch({ clearInput: false });
    return false;
  },

  /**
   * Initialize SEO metadata and structured data defaults.
   */
  initSeo() {
    const currentTitle = document.title || this.siteName;
    const currentDescription = this.getMetaContent('description');
    const currentImage = this.getMetaContent('og:image', true);
    const syncedUrl = this.syncHomePath();
    const canonicalUrl = this.buildCanonicalUrl(syncedUrl || window.location.href);

    this.basePageUrl = this.getBaseUrl(canonicalUrl);
    this.siteName = currentTitle.split(' - ')[0] || this.siteName;

    this.defaultMeta = {
      title: currentTitle,
      description: currentDescription,
      image: currentImage,
      url: this.basePageUrl || canonicalUrl
    };

    this.applyMetaTags({
      title: currentTitle,
      description: currentDescription,
      image: currentImage,
      url: canonicalUrl,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title: currentTitle,
      description: currentDescription,
      url: canonicalUrl,
      image: currentImage
    });

    this.seoInitialized = true;
  },

  /**
   * Sync modal state to the current URL.
   */
  syncModalWithUrl({ updateUrl = true } = {}) {
    return this.getDetailExperience().syncWithUrl({ updateUrl });
  },

  getAnimeIdFromUrl() {
    try {
      const url = new URL(window.location.href);
      const animeId = url.searchParams.get('anime');
      return animeId ? animeId.trim() : '';
    } catch (error) {
      return '';
    }
  },

  getBaseUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      url.searchParams.delete('anime');
      this.getFilterParamNames().forEach(param => url.searchParams.delete(param));
      return this.buildCanonicalUrl(url.toString());
    } catch (error) {
      return '';
    }
  },

  buildCanonicalUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      url.hash = '';
      this.normalizeHomePath(url);
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  resolveUrl(value) {
    if (!value) return '';
    try {
      return new URL(value, window.location.href).toString();
    } catch (error) {
      return value;
    }
  },

  buildUrlForAnime(animeId) {
    try {
      const url = new URL(this.basePageUrl || window.location.href);
      this.normalizeHomePath(url);
      if (animeId) {
        url.searchParams.set('anime', animeId);
      } else {
        url.searchParams.delete('anime');
      }
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateUrlForAnime(animeId, { replace = false } = {}) {
    try {
      const url = new URL(window.location.href);
      const currentAnimeId = url.searchParams.get('anime');
      this.normalizeHomePath(url);

      if (animeId) {
        if (currentAnimeId === animeId && !replace) return url.toString();
        url.searchParams.set('anime', animeId);
      } else {
        if (!currentAnimeId && !replace) return url.toString();
        url.searchParams.delete('anime');
      }

      const newUrl = url.toString();
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ animeId: animeId || null }, '', newUrl);
      this.setCanonicalUrl(this.buildCanonicalUrl(newUrl));
      return newUrl;
    } catch (error) {
      return '';
    }
  },

  getMetaContent(key, isProperty = false) {
    const attr = isProperty ? 'property' : 'name';
    const tag = document.querySelector(`meta[${attr}="${key}"]`);
    return tag ? tag.getAttribute('content') || '' : '';
  },

  setMetaContent(key, content, isProperty = false) {
    const attr = isProperty ? 'property' : 'name';
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  },

  setCanonicalUrl(url) {
    if (!url) return;
    let tag = document.querySelector('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', 'canonical');
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', url);
  },

  applyMetaTags({ title, description, image, url, imageAlt } = {}) {
    const safeTitle = title || this.defaultMeta.title || this.siteName;
    const safeDescription = description || this.defaultMeta.description || '';
    const safeImage = image || this.defaultMeta.image || '';
    const safeUrl = url || this.defaultMeta.url || this.buildCanonicalUrl(window.location.href);
    const resolvedUrl = this.resolveUrl(safeUrl);
    const resolvedImage = this.resolveUrl(safeImage);
    const twitterCard = resolvedImage ? 'summary_large_image' : 'summary';

    if (safeTitle) {
      document.title = safeTitle;
      this.setMetaContent('og:title', safeTitle, true);
      this.setMetaContent('twitter:title', safeTitle);
    }

    if (safeDescription) {
      this.setMetaContent('description', safeDescription);
      this.setMetaContent('og:description', safeDescription, true);
      this.setMetaContent('twitter:description', safeDescription);
    }

    if (resolvedUrl) {
      this.setMetaContent('og:url', resolvedUrl, true);
      this.setCanonicalUrl(resolvedUrl);
    }

    this.setMetaContent('twitter:card', twitterCard);

    if (resolvedImage) {
      this.setMetaContent('og:image', resolvedImage, true);
      this.setMetaContent('twitter:image', resolvedImage);
    }

    if (imageAlt) {
      this.setMetaContent('og:image:alt', imageAlt, true);
    }
  },

  buildMetaDescription(text) {
    const cleaned = String(text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return '';
    if (cleaned.length <= 160) return cleaned;
    return `${cleaned.slice(0, 157).trim()}...`;
  },

  getSynopsisForAnime(anime) {
    if (!anime) return '';
    const synopsis = String(anime.synopsis || '').trim();
    if (synopsis) return synopsis;
    const cacheKey = anime.anilistId || anime.title;
    return this.getCachedSynopsis(cacheKey);
  },

  updateMetaForAnime(anime, descriptionOverride = '') {
    if (!anime) {
      this.resetMetaToDefault();
      return;
    }

    const description = this.buildMetaDescription(descriptionOverride || anime.synopsis);
    const title = `${anime.title} | ${this.siteName}`;
    const url = this.buildCanonicalUrl(this.buildUrlForAnime(anime.id));
    const image = anime.cover || this.defaultMeta.image;

    this.applyMetaTags({
      title,
      description: description || this.defaultMeta.description,
      image,
      url,
      imageAlt: anime.title
    });

    this.updateStructuredData({
      title,
      description: description || this.defaultMeta.description,
      url,
      image
    });
  },

  resetMetaToDefault() {
    const url = this.buildCanonicalUrl(this.basePageUrl || window.location.href);
    this.applyMetaTags({
      title: this.defaultMeta.title,
      description: this.defaultMeta.description,
      image: this.defaultMeta.image,
      url,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title: this.defaultMeta.title,
      description: this.defaultMeta.description,
      url,
      image: this.defaultMeta.image
    });
  },

  updateStructuredData({ title, description, url, image } = {}) {
    let script = document.getElementById('structured-data');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'structured-data';
      const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
      if (nonce) {
        script.setAttribute('nonce', nonce);
      }
      document.head.appendChild(script);
    }

    const pageUrl = url || this.buildCanonicalUrl(window.location.href);
    const siteUrl = this.basePageUrl || this.getBaseUrl(pageUrl) || pageUrl;
    const resolvedImage = this.resolveUrl(image);

    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}#website`,
          'name': this.siteName,
          'url': siteUrl,
          'description': this.defaultMeta.description || description || ''
        },
        {
          '@type': 'WebPage',
          '@id': `${pageUrl}#webpage`,
          'name': title || this.defaultMeta.title || this.siteName,
          'url': pageUrl,
          'description': description || this.defaultMeta.description || '',
          'isPartOf': { '@id': `${siteUrl}#website` }
        }
      ]
    };

    if (resolvedImage) {
      data['@graph'][1].primaryImageOfPage = {
        '@type': 'ImageObject',
        'url': resolvedImage
      };
    }

    setScriptText(script, JSON.stringify(data));
  },

  /**
   * Handle header search input (opens anime detail)
   */
  handleHeaderSearch(query, { preserveActive = false } = {}) {
    const dropdown = document.getElementById('header-search-dropdown');
    const input = document.getElementById('header-search');
    if (!dropdown || !input) return;
    const searchDims = this.getImageDimensions('search');
    const searchDimAttrs = searchDims ? `width="${searchDims.width}" height="${searchDims.height}"` : '';

    const trimmedQuery = String(query || '').trim();
    const previousQuery = this.headerSearchState.query;
    this.headerSearchState.query = trimmedQuery;

    if (trimmedQuery.length < 2) {
      this.resetHeaderSearch({ clearInput: false });
      return;
    }

    const matches = this.findSearchMatches(trimmedQuery);
    this.headerSearchState.results = matches;

    if (!preserveActive || trimmedQuery !== previousQuery) {
      this.headerSearchState.activeIndex = -1;
    } else if (this.headerSearchState.activeIndex >= matches.length) {
      this.headerSearchState.activeIndex = -1;
    }

    if (matches.length === 0) {
      setHTML(dropdown, `
        <div class="search-no-results" role="status" aria-live="polite">
          <div class="search-no-results-title">No matches yet.</div>
          <div class="search-no-results-hint">Try English title or a shorter query.</div>
          <div class="search-no-results-tips">
            <span class="search-no-results-tip">Try English title</span>
            <span class="search-no-results-tip">Shorter query</span>
          </div>
        </div>
      `);
      this.updateHeaderSearchDropdownVisibility(dropdown, true);
      this.setHeaderSearchActiveIndex(-1, { scroll: false });
      return;
    }

    setHTML(dropdown, matches.map((anime, index) => {
      const altTitles = [anime.titleEnglish, anime.titleJapanese]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter(value => value.toLowerCase() !== anime.title.toLowerCase());
      const safeAltTitles = altTitles.map(value => this.escapeHtml(value));
      const altTitleMarkup = altTitles.length
        ? `<div class="search-result-alt">${safeAltTitles.join(' &bull; ')}</div>`
        : '';
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const { src: searchSrc, fallback: searchFallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'search' });
      const safeCover = this.escapeAttr(searchSrc || this.sanitizeImageUrl(anime.cover));
      const searchFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: searchFallback,
        placeholder: 'https://via.placeholder.com/40x56?text=No'
      });
      const safeYear = this.escapeHtml(anime.year ?? 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio ?? 'Unknown');
      const isActive = index === this.headerSearchState.activeIndex;
      return `
      <div class="search-result-item ${isActive ? 'is-active' : ''}" role="option" aria-selected="${isActive ? 'true' : 'false'}" id="search-result-${index}" data-result-index="${index}" data-action="open-anime" data-anime-id="${safeId}">
        <img src="${safeCover}" alt="${safeTitle}" class="search-result-cover" ${searchDimAttrs} ${searchFallbackAttrs}>
        <div class="search-result-info">
          <div class="search-result-title">${safeTitle}</div>
          ${altTitleMarkup}
          <div class="search-result-meta">${safeYear} &bull; ${safeStudio}</div>
        </div>
      </div>
    `;
    }).join(''));

    this.updateHeaderSearchDropdownVisibility(dropdown, true);
    this.setHeaderSearchActiveIndex(this.headerSearchState.activeIndex, { scroll: false });
  },

  handleHeaderSearchKeydown(event) {
    const dropdown = document.getElementById('header-search-dropdown');
    const input = document.getElementById('header-search');
    if (!dropdown || !input) return;

    const results = this.headerSearchState.results || [];
    const hasResults = results.length > 0;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!hasResults) return;
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      let nextIndex = this.headerSearchState.activeIndex;
      if (nextIndex === -1) {
        nextIndex = delta > 0 ? 0 : results.length - 1;
      } else {
        nextIndex = (nextIndex + delta + results.length) % results.length;
      }
      this.setHeaderSearchActiveIndex(nextIndex);
      this.updateHeaderSearchDropdownVisibility(dropdown, true);
      return;
    }

    if (event.key === 'Enter') {
      if (!hasResults) {
        const query = String(input.value || '').trim();
        if (query.length >= 2) {
          event.preventDefault();
          this.applyHeaderSearchQuery(query);
          this.closeHeaderSearchDropdown();
        }
        return;
      }
      const index = this.headerSearchState.activeIndex >= 0 ? this.headerSearchState.activeIndex : 0;
      const selected = results[index];
      if (selected) {
        event.preventDefault();
        this.showAnimeDetail(selected.id);
        this.resetHeaderSearch({ clearInput: true });
      }
      return;
    }

    if (event.key === 'Escape') {
      if (dropdown.classList.contains('visible')) {
        event.preventDefault();
        this.closeHeaderSearchDropdown();
      }
    }
  },
  /**
   * Toggle filter panel visibility
   */
  toggleFilterPanel() {
    const modal = document.getElementById('filter-modal');
    if (modal) {
      this.filterPanelOpen = !this.filterPanelOpen;
      this.setModalVisibility('filter-modal', this.filterPanelOpen, { initialFocusSelector: '#close-filter-modal' });
      if (this.filterPanelOpen) {
        this.ensureFilterPanelRendered();
        const content = modal.querySelector('.filter-modal-content');
        if (content) {
          content.scrollTop = 0;
        }
      }
    }
  },

  closeFilterModal() {
    this.filterPanelOpen = false;
    this.setModalVisibility('filter-modal', false);
  },

  /**
   * Render filter panel with all options
   */
  renderFilterPanel({ force = false } = {}) {
    const container = document.getElementById('filter-sections');
    if (!container) return;
    if (!force && !this.filterPanelOpen && !this.filterPanelRendered) return;

    let html = '';

    html += FilterPresets.renderPresetSection();

    const filterConfig = [
      { key: 'genres', label: 'Genres' },
      { key: 'themes', label: 'Themes' },
      { key: 'demographic', label: 'Demographic' },
      { key: 'seasonYear', label: 'Season' },
      { key: 'year', label: 'Year' },
      { key: 'studio', label: 'Studios' },
      { key: 'source', label: 'Source' }
    ];

    const filtersMarkup = filterConfig.map(config => {
      const options = this.filterOptions[config.key];
      if (!options || options.length === 0) return '';

      const safeLabel = this.escapeHtml(config.label);
      const safeType = this.escapeAttr(config.key);

      return `
        <div class="filter-section">
          <div class="filter-section-title">${safeLabel}</div>
          <div class="filter-pills">
            ${options.map(option => {
        const optionStr = String(option);
        const isActive = this.activeFilters[config.key].includes(optionStr) || this.activeFilters[config.key].includes(option);
        const safeOptionText = this.escapeHtml(optionStr);
        const safeOptionAttr = this.escapeAttr(optionStr);
        const ariaLabel = this.escapeAttr(`${isActive ? 'Remove' : 'Add'} ${optionStr} filter`);
        return `
              <button class="filter-pill ${isActive ? 'active' : ''}"
                      data-action="toggle-filter"
                      data-filter-type="${safeType}"
                      data-filter-value="${safeOptionAttr}"
                      aria-pressed="${isActive ? 'true' : 'false'}"
                      aria-label="${ariaLabel}">
                ${safeOptionText}
              </button>
       `}).join('')}
          </div>
        </div>
      `;
    }).join('');

    html += filtersMarkup;
    setHTML(container, html);
    this.filterPanelRendered = true;
  },

  scheduleFilterPanelRender() {
    if (this.filterPanelRendered || this.filterPanelRenderHandle) return;
    this.filterPanelRenderHandle = this.queueIdleTask(() => {
      this.filterPanelRenderHandle = null;
      this.renderFilterPanel({ force: true });
    }, { timeout: 2000 });
  },

  ensureFilterPanelRendered() {
    if (this.filterPanelRendered) return;
    if (this.filterPanelRenderHandle) {
      this.cancelIdleTask(this.filterPanelRenderHandle);
      this.filterPanelRenderHandle = null;
    }
    this.renderFilterPanel({ force: true });
  },

  /**
   * Render quick filter chips (genre & theme)
   */
  renderQuickFilters() {
    const genreContainer = document.getElementById('genre-chips');
    const themeContainer = document.getElementById('theme-chips');
    const isMobile = window.matchMedia?.('(max-width: 640px)')?.matches;
    const mobileLimit = 6;
    const limits = {
      genres: isMobile ? mobileLimit : Number.POSITIVE_INFINITY,
      themes: isMobile ? mobileLimit : Number.POSITIVE_INFINITY
    };

    const renderGroup = (type, options, container) => {
      if (!container) return;
      if (!options || options.length === 0) {
        container.replaceChildren();
        container.removeAttribute('aria-busy');
        return;
      }
      const limit = limits[type] || 12;
      const state = this.quickFilterState[type] || { expanded: false };
      const expanded = state.expanded;

      const chipsMarkup = options.map((option, index) => {
        const optionStr = String(option);
        const isActive = this.activeFilters[type].includes(optionStr) || this.activeFilters[type].includes(option);
        const safeText = this.escapeHtml(optionStr);
        const safeAttr = this.escapeAttr(optionStr);
        const isHidden = !expanded && index >= limit && !isActive;
        const ariaLabel = this.escapeAttr(`${isActive ? 'Remove' : 'Add'} ${optionStr} filter`);
        return `
          <button class="quick-chip ${isActive ? 'active' : ''} ${isHidden ? 'is-hidden' : ''}"
                  data-action="toggle-filter"
                  data-filter-type="${type}"
                  data-filter-value="${safeAttr}"
                  aria-pressed="${isActive ? 'true' : 'false'}"
                  aria-label="${ariaLabel}">
            ${safeText}
          </button>
        `;
      }).join('');

      const showToggle = options.length > limit && Number.isFinite(limit);
      const hiddenCount = Math.max(options.length - limit, 0);
      const toggleLabel = expanded ? 'Show less' : `Show ${hiddenCount} more`;
      const toggleMarkup = showToggle
        ? `
          <button class="quick-more" type="button" data-action="toggle-quick-more" data-filter-type="${type}">
            ${toggleLabel}
          </button>
        `
        : '';

      setHTML(container, `${chipsMarkup}${toggleMarkup}`);
      container.removeAttribute('aria-busy');
    };

    renderGroup('genres', this.filterOptions.genres, genreContainer);
    renderGroup('themes', this.filterOptions.themes, themeContainer);
    this.renderMoodFilterClusters();
  },

  getAvailableMoodFilterClusters() {
    const pickAvailable = (type, candidates = []) => {
      const available = new Set((this.filterOptions[type] || []).map(option => String(option)));
      return candidates.find(candidate => available.has(String(candidate))) || '';
    };

    return this.moodFilterClusterDefinitions
      .map(cluster => {
        const genre = pickAvailable('genres', cluster.genres);
        const theme = pickAvailable('themes', cluster.themes);
        const filters = [];
        if (genre) filters.push({ type: 'genres', value: genre });
        if (theme) filters.push({ type: 'themes', value: theme });
        return { ...cluster, filters };
      })
      .filter(cluster => cluster.filters.length > 0);
  },

  renderMoodFilterClusters() {
    const container = document.getElementById('mood-filter-clusters');
    if (!container) return;

    const clusters = this.getAvailableMoodFilterClusters();
    if (clusters.length === 0) {
      container.replaceChildren();
      container.removeAttribute('aria-busy');
      return;
    }

    setHTML(container, clusters.map(cluster => {
      const isActive = cluster.filters.every(filter =>
        Array.isArray(this.activeFilters[filter.type]) &&
        this.activeFilters[filter.type].includes(filter.value)
      );
      const tokens = cluster.filters
        .map(filter => this.escapeHtml(filter.value))
        .join(' + ');
      return `
        <button class="mood-cluster ${isActive ? 'active' : ''}"
                type="button"
                data-action="apply-mood-cluster"
                data-cluster-key="${this.escapeAttr(cluster.key)}"
                aria-pressed="${isActive ? 'true' : 'false'}">
          <span class="mood-cluster-label">${this.escapeHtml(cluster.label)}</span>
          <span class="mood-cluster-desc">${this.escapeHtml(cluster.description)}</span>
          <span class="mood-cluster-tags">${tokens}</span>
        </button>
      `;
    }).join(''));
    container.removeAttribute('aria-busy');
  },

  applyMoodFilterCluster(clusterKey) {
    const cluster = this.getAvailableMoodFilterClusters()
      .find(item => item.key === clusterKey);
    if (!cluster) return;

    const isActive = cluster.filters.every(filter =>
      Array.isArray(this.activeFilters[filter.type]) &&
      this.activeFilters[filter.type].includes(filter.value)
    );

    const nextFilters = Object.fromEntries(
      Object.entries(this.activeFilters).map(([type, values]) => [
        type,
        Array.isArray(values) ? [...values] : []
      ])
    );
    cluster.filters.forEach(filter => {
      const current = Array.isArray(nextFilters[filter.type]) ? nextFilters[filter.type] : [];
      nextFilters[filter.type] = isActive
        ? current.filter(value => value !== filter.value)
        : Array.from(new Set([...current, filter.value]));
    });

    this.activeFilters = nextFilters;
    this.renderQuickFilters();
    this.applyFilters();
    this.scrollToResultsSection();
  },

  /**
   * Toggle a filter on/off
   */
  toggleFilter(type, value) {
    const valueStr = String(value);
    const currentValues = Array.isArray(this.activeFilters[type]) ? this.activeFilters[type] : [];
    const index = currentValues.indexOf(valueStr);
    const nextValues = index > -1
      ? currentValues.filter(item => item !== valueStr)
      : [...currentValues, valueStr];
    this.activeFilters = { ...this.activeFilters, [type]: nextValues };
    const isActive = nextValues.includes(valueStr);
    const ariaLabel = `${isActive ? 'Remove' : 'Add'} ${valueStr} filter`;

    // Update pill state in modal
    const safeType = this.escapeCssValue(type);
    const pillCandidates = document.querySelectorAll(`.filter-pill[data-filter-type="${safeType}"]`);
    const pill = Array.from(pillCandidates).find(el => el.dataset.filterValue === valueStr);
    if (pill) {
      pill.classList.toggle('active', isActive);
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      pill.setAttribute('aria-label', ariaLabel);
    }

    // Update quick chip state
    const chipCandidates = document.querySelectorAll(`.quick-chip[data-filter-type="${safeType}"]`);
    const chip = Array.from(chipCandidates).find(el => el.dataset.filterValue === valueStr);
    if (chip) {
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      chip.setAttribute('aria-label', ariaLabel);
    }

    this.applyFilters();
  },

  /**
   * Count total active filters across all filter groups.
   * @returns {number} Active filter count
   */
  getActiveFilterCount() {
    return Object.values(this.activeFilters).reduce((total, values) => {
      if (!Array.isArray(values)) return total;
      return total + values.filter(value => value !== null && value !== undefined && value !== '').length;
    }, 0);
  },

  /**
   * Smoothly scroll to results after quick filter actions.
   */
  scrollToResultsSection() {
    const shouldScroll = window.matchMedia?.('(max-width: 640px)')?.matches;
    if (!shouldScroll) return;
    const target =
      document.getElementById('catalog-section') ||
      document.getElementById('recommendations-section');
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  },

  /**
   * Scroll back to the quick filters section.
   */
  scrollToFiltersSection() {
    const target = document.getElementById('quick-filters');
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  },

  /**
   * Show/hide the filter jump button on mobile.
   */
  setupFilterFab() {
    const button = document.getElementById('filter-fab');
    if (!button) return;
    const isMobileQuery = window.matchMedia?.('(max-width: 640px)');
    const updateVisibility = () => {
      const isMobile = isMobileQuery ? isMobileQuery.matches : window.innerWidth <= 640;
      if (!isMobile) {
        button.classList.remove('is-visible');
        return;
      }
      const showAfter = 320;
      button.classList.toggle('is-visible', window.scrollY > showAfter);
    };
    updateVisibility();
    this.addTrackedListener(window, 'scroll', updateVisibility, { passive: true });
    if (isMobileQuery?.addEventListener) {
      this.addTrackedListener(isMobileQuery, 'change', updateVisibility);
    }
  },

  setupIntelligentPrefetching() {
    if (!this.features.intelligentPrefetching) return;
    if (this.prefetchObserver || typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    this.prefetchObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        const animeId = card?.dataset?.animeId;
        if (animeId) {
          this.queuePrefetch(animeId);
        }
      });
    }, {
      root: null,
      rootMargin: '200px',
      threshold: 0
    });

    this.updatePrefetchObserving();
  },

  updatePrefetchObserving() {
    if (!this.prefetchObserver) return;
    if (typeof document === 'undefined') return;
    this.prefetchObserver.disconnect();
    document.querySelectorAll('.recommendation-card, .trending-card, .similar-card')
      .forEach(card => this.prefetchObserver.observe(card));
  },

  queuePrefetch(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key) return;
    if (this.prefetchQueue.has(key)) return;
    if (this.prefetchQueue.size >= this.prefetchLimit) return;
    this.prefetchQueue.add(key);

    const work = () => this.prefetchAnime(key);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(work, { timeout: 2000 });
    } else {
      setTimeout(work, 200);
    }
  },

  prefetchAnime(animeId) {
    const anime = this.animeData.find(a => String(a.id) === String(animeId));
    if (!anime) {
      this.prefetchQueue.delete(animeId);
      return;
    }

    const url = this.sanitizeImageUrl(anime.cover);
    if (url && typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    }

    this.prefetchQueue.delete(animeId);
  },

  /**
   * Clear all active filters
   */
  clearAllFilters() {
    this.activeFilters = this.getDefaultActiveFilters();

    // Update all pills and quick chips
    document.querySelectorAll('.filter-pill.active, .quick-chip.active').forEach(el => {
      el.classList.remove('active');
    });

    this.applyFilters();
  },

  /**
   * Apply all active filters to data
   */
  applyFilters({ syncUrl = true, replaceUrl = false, updateMeta = true } = {}) {
    const hasActiveFilters = Object.values(this.activeFilters).some(values =>
      Array.isArray(values) && values.length > 0
    );

    let nextData;
    if (!hasActiveFilters) {
      nextData = this.animeData;
    } else {
      nextData = this.animeData.filter(anime => {
        // Check season-year filter
        if (this.activeFilters.seasonYear.length > 0) {
          const animeSeasonYear = `${anime.season} ${anime.year}`;
          if (!this.activeFilters.seasonYear.includes(animeSeasonYear)) {
            return false;
          }
        }

        // Check year filter (independent of season)
        if (this.activeFilters.year.length > 0) {
          // Compare as strings since filter values are stored as strings
          if (!this.activeFilters.year.includes(String(anime.year))) {
            return false;
          }
        }

        // Check studio filter (OR logic within category, handle array studios)
        if (this.activeFilters.studio.length > 0) {
          const animeStudios = Array.isArray(anime.studio) ? anime.studio : [anime.studio];
          const hasMatchingStudio = animeStudios.some(s => this.activeFilters.studio.includes(s));
          if (!hasMatchingStudio) {
            return false;
          }
        }

        // Check source filter
        if (this.activeFilters.source.length > 0) {
          if (!this.activeFilters.source.includes(anime.source)) {
            return false;
          }
        }

        // Check genres filter (anime must have ALL of the selected genres)
        if (this.activeFilters.genres.length > 0) {
          const hasAllGenres = anime.genres &&
            this.activeFilters.genres.every(g => anime.genres.includes(g));
          if (!hasAllGenres) {
            return false;
          }
        }

        // Check themes filter (anime must have ALL of the selected themes)
        if (this.activeFilters.themes.length > 0) {
          const hasAllThemes = anime.themes &&
            this.activeFilters.themes.every(t => anime.themes.includes(t));
          if (!hasAllThemes) {
            return false;
          }
        }

        // Check demographic filter
        if (this.activeFilters.demographic.length > 0) {
          if (!this.activeFilters.demographic.includes(anime.demographic)) {
            return false;
          }
        }

        return true;
      });
    }
    const searchQuery = this.getCatalogSearchQuery();
    nextData = this.filterDataBySearch(nextData, searchQuery);
    this.lastAppliedSearchQuery = searchQuery.length >= 2 ? searchQuery : '';
    this.filteredData = nextData;

    // Reset pagination when filters change
    this.resetGridPagination();
    if (syncUrl) {
      this.updateUrlForFilters({ replace: replaceUrl });
    }
    this.render();
    if (updateMeta) {
      this.updateMetaForFilters();
    }
  },

  /**
   * Render the entire dashboard
   */
  render() {
    this.renderActiveFilters();
    this.renderWatchlist();
    if (this.deferFilterUiOnce) {
      this.scheduleDeferredFilterUi();
    } else {
      this.renderSeasonalFilters();
      this.renderRecommendationModes();
    }
    this.renderAnimeGrid();
    this.updatePrefetchObserving();
    this.scheduleSecondaryRenders();
  },

  scheduleSecondaryRenders() {
    if (this.secondaryDeferredTimeoutId && typeof window !== 'undefined') {
      window.clearTimeout(this.secondaryDeferredTimeoutId);
      this.secondaryDeferredTimeoutId = null;
    }
    if (this.secondaryRenderInFlight) return;
    this.secondaryRenderInFlight = true;
    const constrained = this.shouldDeferHeavyContent();
    const allTasks = [
      () => this.renderRecommendations(),
      () => this.renderRankings(),
      () => this.renderBecauseYouWatched(),
      () => this.renderTrending()
    ];
    const immediateTasks = constrained
      ? []
      : allTasks;
    const deferredTasks = constrained
      ? allTasks
      : [];

    const runQueue = (tasks, onComplete) => {
      const queue = [...tasks];
      const runNext = () => {
        const task = queue.shift();
        if (task) {
          task();
        }
        if (queue.length > 0) {
          this.queueIdleTask(runNext, { timeout: constrained ? 2000 : 1200 });
          return;
        }
        if (typeof onComplete === 'function') {
          onComplete();
        }
      };
      runNext();
    };

    if (constrained && typeof window !== 'undefined') {
      this.secondaryDeferredTimeoutId = window.setTimeout(() => {
        this.secondaryDeferredTimeoutId = null;
        this.secondaryRenderHandle = this.queueIdleTask(() => {
          this.secondaryRenderHandle = null;
          runQueue(deferredTasks, () => {
            this.secondaryRenderInFlight = false;
          });
        }, { timeout: 5000 });
      }, 5200);
      return;
    }

    this.secondaryRenderHandle = this.queueIdleTask(() => {
      this.secondaryRenderHandle = null;
      runQueue(immediateTasks, () => {
        this.secondaryRenderInFlight = false;
      });
    }, { timeout: 1200 });
  },

  positionTooltip(trigger) {
    const tooltip = trigger?.querySelector?.('.tooltip');
    if (!tooltip || typeof window === 'undefined') return;

    tooltip.style.setProperty('--tooltip-shift-x', '0px');
    tooltip.style.setProperty('--tooltip-arrow-shift-x', '0px');

    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    if (!viewportWidth) return;

    const rect = tooltip.getBoundingClientRect();
    const gutter = 8;
    let shift = 0;

    if (rect.left < gutter) {
      shift = gutter - rect.left;
    } else if (rect.right > (viewportWidth - gutter)) {
      shift = (viewportWidth - gutter) - rect.right;
    }

    if (!Number.isFinite(shift) || shift === 0) return;

    const maxArrowShift = Math.max(0, (rect.width / 2) - 12);
    const arrowShift = Math.max(-maxArrowShift, Math.min(maxArrowShift, -shift));
    tooltip.style.setProperty('--tooltip-shift-x', `${shift}px`);
    tooltip.style.setProperty('--tooltip-arrow-shift-x', `${arrowShift}px`);
  },

  scheduleDeferredFilterUi() {
    if (this.deferFilterUiHandle) return;
    this.deferFilterUiHandle = this.queueIdleTask(() => {
      this.deferFilterUiHandle = null;
      this.deferFilterUiOnce = false;
      this.deferFilterUiUsed = true;
      this.renderSeasonalFilters();
      this.renderRecommendationModes();
      this.renderQuickFilters();
      this.updateSortOptions();
      if (this.filterPanelRendered || this.filterPanelOpen) {
        this.renderFilterPanel({ force: true });
      } else {
        this.scheduleFilterPanelRender();
      }
    }, { timeout: 3000 });
  },

  /**
   * Render seasonal filter chips
   */
  renderSeasonalFilters() {
    const container = document.getElementById('seasonal-chips');
    if (!container) return;

    const filters = Discovery.getSeasonalFilters(this.animeData);
    if (filters.length === 0) {
      container.replaceChildren();
      container.removeAttribute('aria-busy');
      return;
    }

    setHTML(container, filters.map(filter => {
      const isActive = this.activeFilters.seasonYear.includes(filter.value);
      const highlightClass = filter.highlight && isActive ? 'is-highlight' : '';
      const activeClass = isActive ? 'active' : '';
      const filterLabel = filter.value
        ? `${filter.label}: ${filter.value}`
        : filter.label;
      return `
        <button class="seasonal-chip ${highlightClass} ${activeClass}"
                data-action="apply-seasonal"
                data-season-year="${this.escapeAttr(filter.value)}"
                type="button">
          ${this.escapeHtml(filterLabel)}
        </button>
      `;
    }).join(''));
    container.removeAttribute('aria-busy');
  },

  /**
   * Apply seasonal filter
   */
  applySeasonalFilter(seasonYear) {
    // Toggle the filter
    const currentValues = Array.isArray(this.activeFilters.seasonYear)
      ? this.activeFilters.seasonYear
      : [];
    const index = currentValues.indexOf(seasonYear);
    const nextValues = index > -1 ? currentValues.filter(item => item !== seasonYear) : [seasonYear];
    this.activeFilters = { ...this.activeFilters, seasonYear: nextValues };

    this.applyFilters();
    this.renderSeasonalFilters();
  },

  /**
   * Render recommendation mode selector
   */
  renderRecommendationModes() {
    const container = document.getElementById('mode-chips');
    if (!container) return;

    const modes = Recommendations.modes;
    const currentMode = Recommendations.currentMode;
    const contextEl = document.getElementById('recommendations-context');

    setHTML(container, Object.entries(modes).map(([key, mode]) => {
      const isActive = key === currentMode;
      return `
        <button class="mode-chip ${isActive ? 'active' : ''}"
                data-action="set-rec-mode"
                data-mode="${this.escapeAttr(key)}"
                title="${this.escapeAttr(mode.description)}"
                type="button">
          <span class="mode-icon">${mode.icon}</span>
          <span class="mode-label">${this.escapeHtml(mode.label)}</span>
        </button>
      `;
    }).join(''));
    container.removeAttribute('aria-busy');

    if (contextEl) {
      const nextContext = Recommendations.getModeContext(currentMode);
      if (contextEl.textContent.trim() !== nextContext) {
        contextEl.textContent = nextContext;
      }
    }
  },

  /**
   * Render Because You Watched section
   */
  renderBecauseYouWatched() {
    const section = document.getElementById('because-you-watched-section');
    const grid = document.getElementById('byw-grid');
    const seedContainer = document.getElementById('byw-seed');

    if (!section || !grid || !seedContainer) return;
    const seedDims = this.getImageDimensions('seed');
    const seedDimAttrs = seedDims ? `width="${seedDims.width}" height="${seedDims.height}"` : '';
    const recDims = this.getImageDimensions('recommendation');
    const recDimAttrs = recDims ? `width="${recDims.width}" height="${recDims.height}"` : '';

    const watchedIds = this.getWatchlistIds({ statuses: ['watching', 'completed'] });
    const seedIds = watchedIds.length > 0
      ? watchedIds
      : this.getWatchlistIds({ statuses: ['planned', 'watching', 'completed'] });

    const { recommendations, basedOn } = Recommendations.getBecauseYouWatched(
      this.animeData,
      seedIds,
      6
    );

    if (recommendations.length === 0) {
      section.classList.add('is-hidden');
      return;
    }

    section.classList.remove('is-hidden');

    // Render seed info
    if (basedOn) {
      const { src, srcset, sizes, fallback } = this.buildImageSrcset(basedOn.cover, { sizeKey: 'seed' });
      const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(basedOn.cover));
      const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
      const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
      const seedFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: fallback,
        placeholder: 'https://via.placeholder.com/32x45?text=No'
      });
      const seedLoadAttrs = this.getImageLoadingAttrs(0, { eagerCount: 1, priorityCount: 0 });
      const seedPriorityAttr = seedLoadAttrs.fetchpriority ? `fetchpriority="${seedLoadAttrs.fetchpriority}"` : '';
      setHTML(seedContainer, `
        <img src="${safeCover}" ${srcsetAttr} ${sizesAttr} alt="" class="byw-seed-cover" ${seedDimAttrs} loading="${seedLoadAttrs.loading}" decoding="${seedLoadAttrs.decoding}" ${seedPriorityAttr} ${seedFallbackAttrs}>
        <span class="byw-seed-title">${this.escapeHtml(basedOn.title)}</span>
      `);
    }

    // Render recommendations
    setHTML(grid, recommendations.map((anime, index) => {
      const episodeCount = this.getEpisodeCount(anime);
      const hasEpisodes = episodeCount > 0;
      const retention = hasEpisodes ? `${Math.round(anime.stats?.retentionScore || 0)}%` : 'N/A';
      const malScore = Number.isFinite(anime.communityScore) ? `${anime.communityScore.toFixed(1)}/10` : 'N/A';
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

      const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'recommendation' });
      const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(anime.cover));
      const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
      const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
      const recFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: fallback,
        placeholder: 'https://via.placeholder.com/180x120?text=No+Image'
      });
      const loadAttrs = this.getImageLoadingAttrs(index, { eagerCount: 1, priorityCount: 0 });
      const fetchPriorityAttr = loadAttrs.fetchpriority ? `fetchpriority="${loadAttrs.fetchpriority}"` : '';
      return `
        <div class="recommendation-card" data-action="open-anime" data-anime-id="${this.escapeAttr(anime.id)}" role="button" tabindex="0" aria-label="${cardLabel}">
          <div class="recommendation-media">
            <img src="${safeCover}" ${srcsetAttr} ${sizesAttr} alt="${this.escapeHtml(anime.title)}" class="recommendation-cover" ${recDimAttrs} loading="${loadAttrs.loading}" decoding="${loadAttrs.decoding}" ${fetchPriorityAttr} ${recFallbackAttrs}>
          </div>
          <div class="recommendation-info">
            <div class="recommendation-title">${this.escapeHtml(anime.title)}</div>
            <div class="recommendation-meta">
              <span>Finish Rate ${retention}</span>
              <span>MAL ${malScore}</span>
            </div>
            <div class="recommendation-reason">${this.escapeHtml(anime.reason || '')}</div>
          </div>
        </div>
      `;
    }).join(''));
  },

  /**
   * Render Trending section
   */
  renderTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    const trendDims = this.getImageDimensions('trending');
    const trendDimAttrs = trendDims ? `width="${trendDims.width}" height="${trendDims.height}"` : '';

    const trending = Discovery.getTrending(this.animeData, 6);

    setHTML(grid, trending.map((anime, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? 'top-3' : '';
      const episodeCount = this.getEpisodeCount(anime);
      const hasEpisodes = episodeCount > 0;
      const retention = hasEpisodes ? `${Math.round(anime.stats?.retentionScore || 0)}%` : 'N/A';
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

      const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'trending' });
      const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(anime.cover));
      const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
      const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
      const trendFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: fallback,
        placeholder: 'https://via.placeholder.com/280x140?text=No+Image'
      });
      const loadAttrs = this.getImageLoadingAttrs(index, { eagerCount: 2, priorityCount: 1 });
      const fetchPriorityAttr = loadAttrs.fetchpriority ? `fetchpriority="${loadAttrs.fetchpriority}"` : '';
      return `
        <div class="trending-card" data-action="open-anime" data-anime-id="${this.escapeAttr(anime.id)}" role="button" tabindex="0" aria-label="${cardLabel}">
          <div class="trending-rank ${rankClass}">${rank}</div>
          <img src="${safeCover}" ${srcsetAttr} ${sizesAttr} alt="${this.escapeHtml(anime.title)}" class="trending-cover" ${trendDimAttrs} loading="${loadAttrs.loading}" decoding="${loadAttrs.decoding}" ${fetchPriorityAttr} ${trendFallbackAttrs}>
          <div class="trending-info">
            <div class="trending-title">${this.escapeHtml(anime.title)}</div>
            <div class="trending-meta">
              ${anime.year || 'Unknown'} · Finish Rate ${retention}
            </div>
          </div>
        </div>
      `;
    }).join(''));
  },

  /**
   * Get cached sorted data for the grid
   */
  getSortedGridData({ requiredCount } = {}) {
    const source = this.filteredData;
    const sortKey = this.currentSort;

    if (this.gridSortedCache &&
      this.gridSortedKey === sortKey &&
      this.gridSortedSource === source) {
      if (this.gridSortedIsPartial && Number.isFinite(requiredCount) && this.gridSortedCache.length < requiredCount) {
        return this.ensureFullGridSort();
      }
      return this.gridSortedCache;
    }

    const wantsPartial = this.features.lazyGridSort && Number.isFinite(requiredCount) && requiredCount > 0;
    if (wantsPartial) {
      const top = this.selectTopAnimeByMetric(source, sortKey, requiredCount);
      this.gridSortedCache = top;
      this.gridSortedKey = sortKey;
      this.gridSortedSource = source;
      this.gridSortedIsPartial = true;
      this.scheduleFullGridSort();
      return top;
    }

    const sorted = this.sortAnimeByMetric(source, sortKey);
    this.gridSortedCache = sorted;
    this.gridSortedKey = sortKey;
    this.gridSortedSource = source;
    this.gridSortedIsPartial = false;
    return sorted;
  },

  scheduleFullGridSort() {
    if (this.gridSortHandle || !this.features.lazyGridSort) return;
    const sortKey = this.currentSort;
    const source = this.filteredData;
    this.gridSortHandle = this.queueIdleTask(() => {
      this.gridSortHandle = null;
      if (this.gridSortedKey !== sortKey || this.gridSortedSource !== source) return;
      const sorted = this.sortAnimeByMetric(source, sortKey);
      this.gridSortedCache = sorted;
      this.gridSortedIsPartial = false;
    }, { timeout: 2000 });
  },

  ensureFullGridSort() {
    if (!this.gridSortedIsPartial) {
      return this.gridSortedCache || [];
    }
    if (this.gridSortHandle) {
      this.cancelIdleTask(this.gridSortHandle);
      this.gridSortHandle = null;
    }
    const sortKey = this.currentSort;
    const source = this.filteredData;
    const sorted = this.sortAnimeByMetric(source, sortKey);
    this.gridSortedCache = sorted;
    this.gridSortedKey = sortKey;
    this.gridSortedSource = source;
    this.gridSortedIsPartial = false;
    return sorted;
  },

  getImageLoadingAttrs(index = 0, { eagerCount = this.eagerImageCount, priorityCount = this.highPriorityImageCount } = {}) {
    const smartLoading = this.features.smartImageLoading;
    const shouldEager = smartLoading && index < eagerCount;
    const shouldHigh = smartLoading && index < priorityCount;
    const fetchpriority = shouldHigh
      ? 'high'
      : (shouldEager ? 'auto' : (smartLoading ? 'low' : 'auto'));

    return {
      loading: shouldEager ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority
    };
  },

  initCardTemplate() {
    if (this.animeCardTemplate || typeof document === 'undefined') return;
    const cardDims = this.getImageDimensions('card');
    const cardDimAttrs = cardDims ? `width="${cardDims.width}" height="${cardDims.height}"` : '';
    const template = document.createElement('template');
    setHTML(template, `
      <div class="anime-card" data-action="open-anime" role="button" tabindex="0" aria-label="View details">
        <div class="card-media">
          <img class="card-cover" ${cardDimAttrs} loading="lazy" data-fallback-src="https://via.placeholder.com/120x170?text=No+Image">
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title"></h3>
          </div>
          <div class="card-year"></div>
          <div class="card-primary-signal">
            <div class="card-primary-score">
              <span class="card-primary-value"></span>
              <span class="card-primary-label"></span>
            </div>
            <span class="card-primary-note"></span>
          </div>
          <div class="card-badges"></div>
          <div class="card-stats"></div>
          <div class="retention-meter">
            <progress class="retention-progress" value="0" max="100" aria-label="Finish Rate"></progress>
          </div>
          <div class="card-reason"></div>
        </div>
      </div>
    `);
    this.animeCardTemplate = template;
  },

  createAnimeCardElement(anime, { index = 0 } = {}) {
    this.initCardTemplate();
    const fragment = this.animeCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.anime-card');
    this.updateAnimeCardElement(card, anime, { index });
    return card;
  },

  updateAnimeCardElement(card, anime, { index = 0 } = {}) {
    if (!card || !anime) return;
    const rawId = String(anime.id ?? '');
    card.dataset.animeId = rawId;

    const badges = Recommendations.getBadges(anime);
    const cardStats = Recommendations.getCardStats(anime);
    const episodeCount = this.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const retentionLevel = hasEpisodes ? Math.round(anime.stats?.retentionScore ?? 0) : 0;
    const reason = Recommendations.getRecommendationReason(anime);
    const safeTitle = this.escapeHtml(anime.title);
    const safeYear = this.escapeHtml(anime.year || 'Unknown');
    const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
    const labelTitle = anime.title || 'this anime';
    const labelYear = anime.year ? `, ${anime.year}` : '';
    const cardLabel = `View details for ${labelTitle}${labelYear}`;

    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', cardLabel);

    const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'card' });
    const coverUrl = src || this.sanitizeImageUrl(anime.cover);
    const fallbackSources = this.getImageFallbackSources({
      fallbackSrc: fallback,
      placeholder: 'https://via.placeholder.com/120x170?text=No+Image'
    });

    const img = card.querySelector('.card-cover');
    const cardDims = this.getImageDimensions('card');
    if (img) {
      if (coverUrl) {
        img.src = coverUrl;
      } else {
        img.removeAttribute('src');
      }
      if (cardDims) {
        img.setAttribute('width', cardDims.width);
        img.setAttribute('height', cardDims.height);
      } else {
        img.removeAttribute('width');
        img.removeAttribute('height');
      }
      if (srcset) {
        img.setAttribute('srcset', srcset);
      } else {
        img.removeAttribute('srcset');
      }
      if (sizes) {
        img.setAttribute('sizes', sizes);
      } else {
        img.removeAttribute('sizes');
      }
      img.alt = anime.title || '';
      const loadAttrs = this.getImageLoadingAttrs(index);
      img.setAttribute('loading', loadAttrs.loading);
      img.setAttribute('decoding', loadAttrs.decoding);
      if (loadAttrs.fetchpriority) {
        img.setAttribute('fetchpriority', loadAttrs.fetchpriority);
      } else {
        img.removeAttribute('fetchpriority');
      }
      if (fallbackSources.primary) {
        img.dataset.fallbackSrc = fallbackSources.primary;
      } else {
        delete img.dataset.fallbackSrc;
      }
      if (fallbackSources.secondary) {
        img.dataset.fallbackSecondary = fallbackSources.secondary;
      } else {
        delete img.dataset.fallbackSecondary;
      }
      if (img.dataset.fallbackApplied) {
        delete img.dataset.fallbackApplied;
      }
    }

    const titleEl = card.querySelector('.card-title');
    if (titleEl) {
      titleEl.textContent = anime.title || '';
    }

    const yearEl = card.querySelector('.card-year');
    if (yearEl) {
      setHTML(yearEl, `${safeYear} &bull; ${safeStudio}`);
    }

    const decision = this.getCardDecisionData(anime);
    const primarySignal = card.querySelector('.card-primary-signal');
    const primaryValue = card.querySelector('.card-primary-value');
    const primaryLabel = card.querySelector('.card-primary-label');
    const primaryNote = card.querySelector('.card-primary-note');
    if (primarySignal) {
      primarySignal.className = this.sanitizeClassList('card-primary-signal', decision.className);
    }
    if (primaryValue) {
      primaryValue.textContent = decision.value;
    }
    if (primaryLabel) {
      primaryLabel.textContent = decision.label;
    }
    if (primaryNote) {
      primaryNote.textContent = decision.note;
    }

    const badgesContainer = card.querySelector('.card-badges');
    if (badgesContainer) {
      if (badges.length > 0) {
        setHTML(badgesContainer, badges
          .map((badge) => {
            const badgeClass = this.sanitizeClassList('card-badge', badge.class);
            return `<span class="${badgeClass}">${this.escapeHtml(badge.label)}</span>`;
          })
          .join(''));
        badgesContainer.hidden = false;
      } else {
        badgesContainer.replaceChildren();
        badgesContainer.hidden = true;
      }
    }

    const statsContainer = card.querySelector('.card-stats');
    if (statsContainer) {
      setHTML(statsContainer, cardStats.map(stat => {
        const safeValue = this.escapeHtml(stat.value);
        const safeSuffix = this.escapeHtml(stat.suffix || '');
        const safeLabel = this.escapeHtml(stat.label);
        const safeTooltipTitle = stat.tooltip ? this.escapeHtml(stat.tooltip.title) : '';
        const safeTooltipText = stat.tooltip ? this.escapeHtml(stat.tooltip.text) : '';
        const statValueClass = this.sanitizeClassList('stat-value', stat.class);
        return `
          <div class="stat ${stat.tooltip ? 'has-tooltip' : ''}" ${stat.tooltip ? 'tabindex="0"' : ''}>
            <span class="${statValueClass}">${safeValue}${safeSuffix}</span>
            <span class="stat-label">${safeLabel}</span>
            ${stat.tooltip ? `
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">${safeTooltipTitle}</div>
                <div class="tooltip-text">${safeTooltipText}</div>
              </div>
            ` : ''}
          </div>
        `;
      }).join(''));
    }

    const meter = card.querySelector('.retention-meter');
    const progress = card.querySelector('.retention-progress');
    if (progress) {
      progress.value = retentionLevel;
    }
    if (meter) {
      meter.classList.toggle('is-muted', !hasEpisodes);
    }

    const reasonEl = card.querySelector('.card-reason');
    if (reasonEl) {
      reasonEl.textContent = reason || '';
    }
  },

  renderAnimeCardsDom(animeList, { startIndex = 0 } = {}) {
    const fragment = document.createDocumentFragment();
    animeList.forEach((anime, localIndex) => {
      const card = this.createAnimeCardElement(anime, {
        index: startIndex + localIndex
      });
      fragment.appendChild(card);
    });
    return fragment;
  },

  getGridCardElement(anime, { index = 0 } = {}) {
    const key = String(anime?.id ?? '');
    if (!key) return null;
    let card = this.gridDomCache.get(key);
    if (!card) {
      card = this.createAnimeCardElement(anime, { index });
      this.gridDomCache.set(key, card);
    } else {
      this.updateAnimeCardElement(card, anime, { index });
    }
    return card;
  },

  diffRenderAnimeGrid(container, newAnimeList, { startIndex = 0 } = {}) {
    if (!container) return;
    const fragment = document.createDocumentFragment();
    newAnimeList.forEach((anime, localIndex) => {
      const card = this.getGridCardElement(anime, { index: startIndex + localIndex });
      if (card) {
        fragment.appendChild(card);
      }
    });
    container.replaceChildren(fragment);
  },

  /**
   * Render anime cards HTML
   */
  renderAnimeCards(animeList, { startIndex = 0 } = {}) {
    const cardDims = this.getImageDimensions('card');
    const cardDimAttrs = cardDims ? `width="${cardDims.width}" height="${cardDims.height}"` : '';
    return animeList.map((anime, localIndex) => {
      const badges = Recommendations.getBadges(anime);
      const cardStats = Recommendations.getCardStats(anime);
      const episodeCount = this.getEpisodeCount(anime);
      const hasEpisodes = episodeCount > 0;
      const retentionLevel = hasEpisodes ? Math.round(anime.stats?.retentionScore ?? 0) : 0;
      const reason = Recommendations.getRecommendationReason(anime);
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeYear = this.escapeHtml(anime.year || 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
      const safeReason = this.escapeHtml(reason);
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);
      const decision = this.getCardDecisionData(anime);
      const decisionClass = this.sanitizeClassList('card-primary-signal', decision.className);

      // Build responsive image attributes
      const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'card' });
      const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(anime.cover));
      const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
      const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
      const cardFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: fallback,
        placeholder: 'https://via.placeholder.com/120x170?text=No+Image'
      });

      const index = startIndex + localIndex;
      const loadingAttrs = this.getImageLoadingAttrs(index);
      return `
        <div class="anime-card"
             data-action="open-anime"
             data-anime-id="${safeId}"
             role="button"
             tabindex="0"
             aria-label="${cardLabel}">
          <div class="card-media">
            <img src="${safeCover}" ${srcsetAttr} ${sizesAttr} alt="${safeTitle}" class="card-cover" ${cardDimAttrs} loading="${loadingAttrs.loading}" decoding="${loadingAttrs.decoding}" ${cardFallbackAttrs}>
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h3 class="card-title">${safeTitle}</h3>
            </div>
            <div class="card-year">${safeYear} &bull; ${safeStudio}</div>
            <div class="${decisionClass}">
              <div class="card-primary-score">
                <span class="card-primary-value">${this.escapeHtml(decision.value)}</span>
                <span class="card-primary-label">${this.escapeHtml(decision.label)}</span>
              </div>
              <span class="card-primary-note">${this.escapeHtml(decision.note)}</span>
            </div>
            ${badges.length > 0 ? `
              <div class="card-badges">
                ${badges.map((badge) => {
        const badgeClass = this.sanitizeClassList('card-badge', badge.class);
        return `<span class="${badgeClass}">${this.escapeHtml(badge.label)}</span>`;
      }).join('')}
              </div>
            ` : ''}
            <div class="card-stats">
              ${cardStats.map(stat => {
        const safeValue = this.escapeHtml(stat.value);
        const safeSuffix = this.escapeHtml(stat.suffix || '');
        const safeLabel = this.escapeHtml(stat.label);
        const safeTooltipTitle = stat.tooltip ? this.escapeHtml(stat.tooltip.title) : '';
        const safeTooltipText = stat.tooltip ? this.escapeHtml(stat.tooltip.text) : '';
        const statValueClass = this.sanitizeClassList('stat-value', stat.class);
        return `
                <div class="stat ${stat.tooltip ? 'has-tooltip' : ''}" ${stat.tooltip ? 'tabindex="0"' : ''}>
                  <span class="${statValueClass}">${safeValue}${safeSuffix}</span>
                  <span class="stat-label">${safeLabel}</span>
                  ${stat.tooltip ? `
                    <div class="tooltip tooltip--bottom" role="tooltip">
                      <div class="tooltip-title">${safeTooltipTitle}</div>
                      <div class="tooltip-text">${safeTooltipText}</div>
                    </div>
                  ` : ''}
                </div>
              `;
      }).join('')}
            </div>
            <div class="retention-meter ${hasEpisodes ? '' : 'is-muted'}">
              <progress class="retention-progress" value="${retentionLevel}" max="100" aria-label="Finish Rate"></progress>
            </div>
            <div class="card-reason">${safeReason}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderSettingsPanel({ includeTitle = true } = {}) {
    const settings = this.getSettings();
    const autoplayEnabled = Boolean(settings.trailerAutoplay);
    const dataSaverEnabled = Boolean(settings.dataSaver);
    const reducedMotionEnabled = Boolean(settings.reducedMotion);
    const highContrastEnabled = Boolean(settings.highContrast);
    const largeTextEnabled = Boolean(settings.largeText);

    const titleMarkup = includeTitle
      ? '<div class="filter-section-title">Viewing preferences</div>'
      : '';

    const themeSelector = ThemeManager.renderThemeSelector();

    return `
      <div class="filter-section settings-section">
        ${titleMarkup}
        
        <!-- Theme Selection -->
        ${themeSelector}
        
        <!-- Playback Settings -->
        <div class="filter-section-title filter-section-title--spaced">Playback</div>
        <div class="settings-list">
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-title">Autoplay trailers</span>
              <span class="settings-description">Start trailers automatically while browsing details. Enabled by default on desktop and off on mobile.</span>
            </span>
            <span class="settings-toggle">
              <input class="settings-toggle-input" type="checkbox" data-setting-key="trailerAutoplay" ${autoplayEnabled ? 'checked' : ''} aria-label="Toggle trailer autoplay">
              <span class="settings-toggle-slider" aria-hidden="true"></span>
            </span>
          </label>
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-title">Data saver</span>
              <span class="settings-description">Reduce data use by skipping embedded trailers. You can still open the trailer on YouTube when you want it.</span>
            </span>
            <span class="settings-toggle">
              <input class="settings-toggle-input" type="checkbox" data-setting-key="dataSaver" ${dataSaverEnabled ? 'checked' : ''} aria-label="Toggle data saver mode">
              <span class="settings-toggle-slider" aria-hidden="true"></span>
            </span>
          </label>
        </div>
        
        <!-- Accessibility Settings -->
        <div class="filter-section-title filter-section-title--spaced">Accessibility</div>
        <div class="settings-list">
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-title">Reduced motion</span>
              <span class="settings-description">Reduce animations and motion effects for a calmer, easier-to-follow experience.</span>
            </span>
            <span class="settings-toggle">
              <input class="settings-toggle-input" type="checkbox" data-setting-key="reducedMotion" ${reducedMotionEnabled ? 'checked' : ''} aria-label="Toggle reduced motion">
              <span class="settings-toggle-slider" aria-hidden="true"></span>
            </span>
          </label>
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-title">High contrast</span>
              <span class="settings-description">Increase visual contrast with stronger edges and fewer decorative effects.</span>
            </span>
            <span class="settings-toggle">
              <input class="settings-toggle-input" type="checkbox" data-setting-key="highContrast" ${highContrastEnabled ? 'checked' : ''} aria-label="Toggle high contrast">
              <span class="settings-toggle-slider" aria-hidden="true"></span>
            </span>
          </label>
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-title">Large text</span>
              <span class="settings-description">Increase text size across the interface for easier reading.</span>
            </span>
            <span class="settings-toggle">
              <input class="settings-toggle-input" type="checkbox" data-setting-key="largeText" ${largeTextEnabled ? 'checked' : ''} aria-label="Toggle large text">
              <span class="settings-toggle-slider" aria-hidden="true"></span>
            </span>
          </label>
        </div>
        
        <!-- Keyboard Shortcuts Hint -->
        <div class="settings-row settings-row--note">
          <span class="settings-text">
            <span class="settings-title">Keyboard shortcuts</span>
            <span class="settings-description">Press <kbd class="settings-kbd">?</kbd> at any time to open the shortcut guide.</span>
          </span>
        </div>
      </div>
    `;
  },

  /**
   * Render active filters summary
   */
  renderActiveFilters() {
    const container = document.getElementById('active-filters');
    const list = document.getElementById('active-filters-list');
    const emptyState = document.getElementById('discovery-garden');
    const label = document.getElementById('active-filters-label');
    const clearBtn = document.getElementById('active-filters-clear');
    if (!container || !list || !emptyState || !label || !clearBtn) return;

    const active = [];
    Object.entries(this.activeFilters).forEach(([type, values]) => {
      values.forEach(value => {
        if (value === null || value === undefined || value === '') return;
        active.push({
          type,
          value,
          label: this.filterTypeLabels[type] || type
        });
      });
    });
    const searchQuery = this.getCatalogSearchQuery();
    if (searchQuery.length >= 2) {
      active.unshift({
        type: 'search',
        value: searchQuery,
        label: 'Search'
      });
    }

    if (active.length === 0) {
      list.replaceChildren();
      label.textContent = 'Showing';
      clearBtn.classList.add('is-hidden');
      container.classList.add('is-empty');
      emptyState.classList.remove('is-hidden');
      return;
    }

    container.classList.remove('is-empty');
    emptyState.classList.add('is-hidden');
    label.textContent = `Showing (${active.length})`;
    clearBtn.classList.remove('is-hidden');
    setHTML(list, active.map(item => {
      const displayValue = String(item.value);
      const safeValueText = this.escapeHtml(displayValue);
      const safeValueAttr = this.escapeAttr(displayValue);
      const safeTypeAttr = this.escapeAttr(item.type);
      const safeLabel = this.escapeHtml(item.label);
      if (item.type === 'search') {
        return `
        <button class="active-filter-pill"
                type="button"
                data-action="clear-search">
          <span class="active-filter-pill-label">${safeLabel}</span>
          ${safeValueText}
          <span class="active-filter-pill-remove" aria-hidden="true">&times;</span>
        </button>
      `;
      }
      return `
        <button class="active-filter-pill"
                type="button"
                data-action="toggle-filter"
                data-filter-type="${safeTypeAttr}"
                data-filter-value="${safeValueAttr}">
          <span class="active-filter-pill-label">${safeLabel}</span>
          ${safeValueText}
          <span class="active-filter-pill-remove" aria-hidden="true">&times;</span>
        </button>
      `;
    }).join(''));
  },

  getRecommendationDisplayLimit() {
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)')?.matches) {
      return 3;
    }
    return 6;
  },

  getCardDecisionData(anime) {
    const episodeCount = this.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const retention = hasEpisodes && Number.isFinite(anime?.stats?.retentionScore)
      ? Math.round(anime.stats.retentionScore)
      : null;
    const satisfaction = Number.isFinite(anime?.communityScore)
      ? anime.communityScore
      : null;

    if (retention !== null) {
      let note = 'Steady finish confidence';
      if (retention >= 88) {
        note = 'Very likely to keep you watching';
      } else if (retention >= 76) {
        note = 'Reliable through the middle';
      } else if (retention < 60) {
        note = 'More selective pick';
      }
      return {
        value: `${retention}%`,
        label: 'Finish confidence',
        note,
        className: Recommendations.getRetentionClass(retention)
      };
    }

    if (satisfaction !== null) {
      return {
        value: satisfaction.toFixed(1),
        label: 'Community score',
        note: 'Use genre fit to decide',
        className: Recommendations.getMalSatisfactionClass(satisfaction)
      };
    }

    return {
      value: 'N/A',
      label: 'Decision signal',
      note: 'Open details for more context',
      className: 'score-low'
    };
  },

  /**
   * Render recommendations section
   */
  renderRecommendations() {
    const container = document.getElementById('recommendations-grid');
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const recDims = this.getImageDimensions('recommendation');
    const recDimAttrs = recDims ? `width="${recDims.width}" height="${recDims.height}"` : '';

    // Get recommendations with current mode
    const recommendationLimit = this.getRecommendationDisplayLimit();
    const recommendations =
      Recommendations.getRecommendationsWithMode(this.filteredData, Recommendations.currentMode, recommendationLimit);


    if (recommendations.length === 0) {
      setHTML(container, '<p class="no-data">No recommendations available</p>');
      return;
    }

    setHTML(container, recommendations.map((anime, index) => {
      const episodeCount = this.getEpisodeCount(anime);
      const hasEpisodes = episodeCount > 0;
      const retention = hasEpisodes ? `${Math.round(anime.stats?.retentionScore ?? 0)}%` : 'N/A';
      const malSatisfaction = Number.isFinite(anime.communityScore) ? `${anime.communityScore.toFixed(1)}/10` : 'N/A';
      const retentionTooltipTitle = this.escapeHtml('Finish Rate');
      const retentionTooltipText = this.escapeHtml('How likely you are to keep watching and finish. Based on strong starts, low drop-off risk, and consistent pacing.');
      const satisfactionTooltipTitle = this.escapeHtml('Satisfaction Score');
      const satisfactionTooltipText = this.escapeHtml('Community rating from MyAnimeList — overall quality and enjoyment.');
      const safeRetention = this.escapeHtml(retention);
      const safeSatisfaction = this.escapeHtml(malSatisfaction);
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeReason = this.escapeHtml(anime.reason || '');
      const safeYear = this.escapeHtml(anime.year || 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
      const decision = this.getCardDecisionData(anime);
      const decisionClass = this.sanitizeClassList('recommendation-signal', decision.className);
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

      const { src: recSrc, srcset: recSrcset, sizes: recSizes, fallback: recFallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'recommendation' });
      const safeRecCover = this.escapeAttr(recSrc || this.sanitizeImageUrl(anime.cover));
      const recSrcsetAttr = recSrcset ? `srcset="${this.escapeAttr(recSrcset)}"` : '';
      const recSizesAttr = recSizes ? `sizes="${this.escapeAttr(recSizes)}"` : '';
      const recFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: recFallback,
        placeholder: 'https://via.placeholder.com/180x120?text=No+Image'
      });
      const loadAttrs = this.getImageLoadingAttrs(index, { eagerCount: 2, priorityCount: 1 });
      const fetchPriorityAttr = loadAttrs.fetchpriority ? `fetchpriority="${loadAttrs.fetchpriority}"` : '';
      return `
        <div class="recommendation-card" data-action="open-anime" data-anime-id="${safeId}" role="button" tabindex="0" aria-label="${cardLabel}">
          <div class="recommendation-media">
            <span class="recommendation-rank">#${index + 1}</span>
            <img src="${safeRecCover}" ${recSrcsetAttr} ${recSizesAttr} alt="${safeTitle}" class="recommendation-cover" ${recDimAttrs} loading="${loadAttrs.loading}" decoding="${loadAttrs.decoding}" ${fetchPriorityAttr} ${recFallbackAttrs}>
          </div>
          <div class="recommendation-info">
            <div class="recommendation-title">${safeTitle}</div>
            <div class="recommendation-submeta">${safeYear} &bull; ${safeStudio}</div>
            <div class="${decisionClass}">
              <span class="recommendation-signal-value">${this.escapeHtml(decision.value)}</span>
              <span class="recommendation-signal-copy">
                <span class="recommendation-signal-label">${this.escapeHtml(decision.label)}</span>
                <span class="recommendation-signal-note">${this.escapeHtml(decision.note)}</span>
              </span>
            </div>
            <div class="recommendation-meta">
              <span class="recommendation-stat has-tooltip" tabindex="0">
                Finish Rate ${safeRetention}
                <div class="tooltip tooltip--bottom" role="tooltip">
                  <div class="tooltip-title">${retentionTooltipTitle}</div>
                  <div class="tooltip-text">${retentionTooltipText}</div>
                </div>
              </span>
              <span class="recommendation-stat has-tooltip" tabindex="0">
                MAL ${safeSatisfaction}
                <div class="tooltip tooltip--bottom" role="tooltip">
                  <div class="tooltip-title">${satisfactionTooltipTitle}</div>
                  <div class="tooltip-text">${satisfactionTooltipText}</div>
                </div>
              </span>
              </div>
              <div class="recommendation-reason">${safeReason}</div>
            </div>
        </div>
      `;
    }).join(''));
  },

  getTopAnimeByMetric(animeList, metric) {
    if (!Array.isArray(animeList) || animeList.length === 0) return null;
    let best = null;
    let bestValue = Number.NEGATIVE_INFINITY;

    const readValue = (anime) => {
      if (!anime) return Number.NEGATIVE_INFINITY;
      if (metric === 'retention') {
        return Number.isFinite(anime?.stats?.retentionScore) ? anime.stats.retentionScore : Number.NEGATIVE_INFINITY;
      }
      if (metric === 'satisfaction') {
        return Number.isFinite(anime?.communityScore) ? anime.communityScore : Number.NEGATIVE_INFINITY;
      }
      if (metric === 'consistency') {
        return Number.isFinite(anime?.stats?.stdDev) ? -anime.stats.stdDev : Number.NEGATIVE_INFINITY;
      }
      const fallback = anime?.stats?.[metric];
      return Number.isFinite(fallback) ? fallback : Number.NEGATIVE_INFINITY;
    };

    for (let i = 0; i < animeList.length; i += 1) {
      const anime = animeList[i];
      const value = readValue(anime);
      if (value > bestValue) {
        bestValue = value;
        best = anime;
      }
    }

    return best;
  },

  /**
   * Render rankings section
   */
  renderRankings() {
    const container1 = document.getElementById('best-ranking-1');
    const container2 = document.getElementById('best-ranking-2');
    const title1 = document.getElementById('ranking-title-1');
    const title2 = document.getElementById('ranking-title-2');

    if (!container1 || !container2) return;
    container1.removeAttribute('aria-busy');
    container2.removeAttribute('aria-busy');

    const dataToUse = this.filteredData;

    // Get ranking config
    const rankingConfig = Recommendations.getRankingTitles();

    // Update titles
    if (title1) title1.textContent = rankingConfig.title1;
    if (title2) title2.textContent = rankingConfig.title2;

    // Ranking 1
    const best1 = this.getTopAnimeByMetric(dataToUse, rankingConfig.metric1);
    if (best1) {
      setHTML(container1, this.renderRankingCard(best1, rankingConfig.metric1));
    } else {
      setHTML(container1, '<p class="no-data">No anime match filters</p>');
    }

    // Ranking 2
    const best2 = this.getTopAnimeByMetric(dataToUse, rankingConfig.metric2);
    if (best2) {
      setHTML(container2, this.renderRankingCard(best2, rankingConfig.metric2));
    } else {
      setHTML(container2, '<p class="no-data">No anime match filters</p>');
    }
  },

  /**
   * Render a ranking card with appropriate metric display
   */
  renderRankingCard(anime, metric) {
    let valueDisplay = 'N/A';
    let labelDisplay = '';
    let valueClass = '';

    if (metric === 'retention') {
      const episodeCount = this.getEpisodeCount(anime);
      const hasEpisodes = episodeCount > 0;
      if (hasEpisodes) {
        const score = Math.round(anime.stats?.retentionScore ?? 0);
        valueDisplay = `${score}%`;
        valueClass = Recommendations.getRetentionClass(score);
      }
      labelDisplay = 'finish rate';
    } else if (metric === 'satisfaction') {
      if (Number.isFinite(anime.communityScore)) {
        valueDisplay = `${anime.communityScore.toFixed(1)}/10`;
        valueClass = Recommendations.getMalSatisfactionClass(anime.communityScore);
      }
      labelDisplay = 'satisfaction score (MAL)';
    } else {
      valueDisplay = anime.stats.average;
      labelDisplay = 'avg score';
      valueClass = anime.stats.scoreClass;
    }

    const { src: rankSrc, srcset: rankSrcset, sizes: rankSizes, fallback: rankFallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'ranking' });
    const safeRankCover = this.escapeAttr(rankSrc || this.sanitizeImageUrl(anime.cover));
    const rankSrcsetAttr = rankSrcset ? `srcset="${this.escapeAttr(rankSrcset)}"` : '';
    const rankSizesAttr = rankSizes ? `sizes="${this.escapeAttr(rankSizes)}"` : '';
    const rankFallbackAttrs = this.getImageFallbackAttrs({
      fallbackSrc: rankFallback,
      placeholder: 'https://via.placeholder.com/60x85?text=No+Image'
    });
    const loadAttrs = this.getImageLoadingAttrs(0, { eagerCount: 1, priorityCount: 1 });
    const fetchPriorityAttr = loadAttrs.fetchpriority ? `fetchpriority="${loadAttrs.fetchpriority}"` : '';
    const rankingDims = this.getImageDimensions('ranking');
    const rankingDimAttrs = rankingDims ? `width="${rankingDims.width}" height="${rankingDims.height}"` : '';
    const safeValueClass = this.sanitizeClassList('ranking-score', valueClass);
    const safeValueDisplay = this.escapeHtml(valueDisplay);
    const safeLabelDisplay = this.escapeHtml(labelDisplay);
    return `
      <div class="ranking-anime">
        <img src="${safeRankCover}" ${rankSrcsetAttr} ${rankSizesAttr} alt="${this.escapeHtml(anime.title)}" class="ranking-cover" ${rankingDimAttrs} loading="${loadAttrs.loading}" decoding="${loadAttrs.decoding}" ${fetchPriorityAttr} ${rankFallbackAttrs}>
        <div class="ranking-info">
          <div class="ranking-title">${this.escapeHtml(anime.title)}</div>
          <div class="${safeValueClass}">
            <span class="score-value">${safeValueDisplay}</span>
            <span class="score-label">${safeLabelDisplay}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render anime grid with pagination
   */
  renderAnimeGrid({ append = false } = {}) {
    const container = document.getElementById('anime-grid');
    if (!container) return;
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');

    const totalCount = Array.isArray(this.filteredData) ? this.filteredData.length : 0;
    const requestedEndIndex = Math.min(totalCount, this.gridCurrentPage * this.gridPageSize);
    const shouldAppend = append && this.gridRenderedCount > 0;
    const shouldDeferInitialBatch = !shouldAppend && !this.gridInitialBatchRendered;
    const initialEndIndex = shouldDeferInitialBatch
      ? Math.min(requestedEndIndex, this.getInitialGridBatchSize())
      : requestedEndIndex;
    let sorted = this.getSortedGridData({ requiredCount: initialEndIndex });

    if (sorted.length === 0) {
      setHTML(container, `
        <div class="no-results">
          <h3>No matches yet</h3>
          <p>Try removing a filter or two—there might be a hidden gem waiting.</p>
        </div>
      `);
      return;
    }

    const startIndex = shouldAppend ? this.gridRenderedCount : 0;
    if (this.gridSortedIsPartial && requestedEndIndex > sorted.length) {
      sorted = this.ensureFullGridSort();
    }
    const targetEndIndex = Math.min(sorted.length, requestedEndIndex);
    const endIndex = shouldDeferInitialBatch
      ? Math.min(targetEndIndex, this.getInitialGridBatchSize())
      : targetEndIndex;
    const visibleAnime = sorted.slice(startIndex, endIndex);
    const countForMore = this.gridSortedIsPartial ? totalCount : sorted.length;
    const hasMore = requestedEndIndex < countForMore;

    if (!shouldAppend) {
      if (this.features.templatePooling && this.features.diffRendering) {
        this.diffRenderAnimeGrid(container, visibleAnime, { startIndex });
      } else {
        setHTML(container, this.renderAnimeCards(visibleAnime, { startIndex }));
      }
    } else if (visibleAnime.length > 0) {
      const loadMoreEl = container.querySelector('.load-more-container');
      if (loadMoreEl) {
        loadMoreEl.remove();
      }
      if (this.features.templatePooling) {
        container.appendChild(this.renderAnimeCardsDom(visibleAnime, { startIndex }));
      } else {
        insertHTML(container, 'beforeend', this.renderAnimeCards(visibleAnime, { startIndex }));
      }
    }

    this.gridRenderedCount = endIndex;
    if (!shouldAppend) {
      this.gridInitialBatchRendered = true;
    }

    if (shouldDeferInitialBatch && endIndex < targetEndIndex && !this.shouldDeferHeavyContent()) {
      if (this.gridDeferredRenderHandle) {
        this.cancelIdleTask(this.gridDeferredRenderHandle);
      }
      this.gridDeferredRenderHandle = this.queueIdleTask(() => {
        this.gridDeferredRenderHandle = null;
        if (this.gridRenderedCount >= targetEndIndex) return;
        this.renderAnimeGrid({ append: true });
      }, { timeout: 1500 });
    }

    // Add "Load More" button if there are more items
    if (hasMore) {
      insertHTML(container, 'beforeend', `
        <div class="load-more-container">
          <button class="load-more-btn" data-action="load-more">
            Load More (${Math.max(countForMore - requestedEndIndex, 0)} remaining)
          </button>
        </div>
      `);
    }

    if (this.gridVirtualScrollHandle) {
      this.cancelIdleTask(this.gridVirtualScrollHandle);
    }
    this.gridVirtualScrollHandle = this.queueIdleTask(() => {
      this.gridVirtualScrollHandle = null;
      this.setupVirtualScrolling(container);
    }, { timeout: 1500 });
  },

  setupVirtualScrolling(container) {
    if (!this.features.virtualScrolling) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (!this.gridObserver) {
      this.gridObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const card = entry.target;
          if (!card) return;
          const cardId = card.dataset.animeId;
          if (entry.isIntersecting) {
            card.classList.remove('is-virtual');
            if (cardId) {
              this.visibleCardIds.add(cardId);
            }
          } else {
            card.classList.add('is-virtual');
            if (cardId) {
              this.visibleCardIds.delete(cardId);
            }
          }
        });
      }, {
        root: null,
        rootMargin: '120px',
        threshold: 0
      });
    }
    this.observeGridCards(container);
  },

  observeGridCards(container) {
    if (!this.gridObserver || !container) return;
    this.gridObserver.disconnect();
    container.querySelectorAll('.anime-card').forEach(card => {
      this.gridObserver.observe(card);
    });
  },

  teardownVirtualScrolling() {
    if (this.gridObserver) {
      this.gridObserver.disconnect();
      this.gridObserver = null;
    }
    this.visibleCardIds.clear();
  },

  /**
   * Load more anime cards
   */
  loadMoreAnime() {
    this.gridCurrentPage++;
    this.renderAnimeGrid({ append: true });
  },

  /**
   * Reset pagination when filters change
   */
  resetGridPagination() {
    this.gridCurrentPage = 1;
    this.gridRenderedCount = 0;
    this.gridSortedCache = null;
    this.gridSortedKey = '';
    this.gridSortedSource = null;
    this.gridSortedIsPartial = false;
    this.gridInitialBatchRendered = false;
    if (this.gridSortHandle) {
      this.cancelIdleTask(this.gridSortHandle);
      this.gridSortHandle = null;
    }
    if (this.gridDeferredRenderHandle) {
      this.cancelIdleTask(this.gridDeferredRenderHandle);
      this.gridDeferredRenderHandle = null;
    }
    if (this.gridVirtualScrollHandle) {
      this.cancelIdleTask(this.gridVirtualScrollHandle);
      this.gridVirtualScrollHandle = null;
    }
  },

  /**
   * Sort anime list by metric (descending)
   * @param {Array} animeList - Array of anime
   * @param {string} metricKey - Sort metric key
   * @returns {Array} Sorted array
   */
  sortAnimeByMetric(animeList, metricKey) {
    const list = [...animeList];
    const key = metricKey === 'satisfaction' ? 'satisfaction' : 'retention';

    list.sort((a, b) => {
      const aVal = key === 'satisfaction'
        ? (Number.isFinite(a.communityScore) ? a.communityScore : 0)
        : (a.stats?.retentionScore ?? 0);
      const bVal = key === 'satisfaction'
        ? (Number.isFinite(b.communityScore) ? b.communityScore : 0)
        : (b.stats?.retentionScore ?? 0);
      return bVal - aVal;
    });

    return list;
  },

  selectTopAnimeByMetric(animeList, metricKey, limit) {
    if (!Array.isArray(animeList) || animeList.length === 0) return [];
    const maxItems = Math.max(1, limit || 1);
    const key = metricKey === 'satisfaction' ? 'satisfaction' : 'retention';
    const top = [];

    const getValue = (anime) => {
      if (key === 'satisfaction') {
        return Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;
      }
      return Number.isFinite(anime?.stats?.retentionScore) ? anime.stats.retentionScore : 0;
    };

    for (let i = 0; i < animeList.length; i += 1) {
      const anime = animeList[i];
      const value = getValue(anime);

      if (top.length < maxItems) {
        top.push({ anime, value });
        if (top.length === maxItems) {
          top.sort((a, b) => b.value - a.value);
        }
        continue;
      }

      if (value <= top[top.length - 1].value) continue;
      top[top.length - 1] = { anime, value };
      top.sort((a, b) => b.value - a.value);
    }

    return top.map(entry => entry.anime);
  },

  /**
   * Handle card click
   */
  handleCardClick(animeId) {
    this.showAnimeDetail(animeId);
  },

  setupActionDelegates() {
    this.addTrackedListener(document, 'click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      if (action === 'home-shortcut') {
        if (this.isCatalogPage()) {
          event.preventDefault();
          if (this.currentAnimeId) {
            this.closeDetailModal({ updateUrl: false });
          }
          this.clearAllFilters();
        }
        return;
      }

      if (action === 'check-connectivity') {
        event.preventDefault();
        if (HealthMonitor?.performHealthChecks) {
          HealthMonitor.performHealthChecks();
        }
        return;
      }

      if (action === 'toggle-filter') {
        const type = actionEl.dataset.filterType;
        const value = actionEl.dataset.filterValue;
        const isQuickChip = actionEl.classList.contains('quick-chip');
        if (type && value !== undefined) {
          this.toggleFilter(type, value);
        }
        if (isQuickChip) {
          const isMobile = window.matchMedia?.('(max-width: 640px)')?.matches;
          if (this.getActiveFilterCount() >= 2) {
            this.scrollToResultsSection();
          }
        }
        return;
      }

      if (action === 'clear-search') {
        this.clearHeaderSearchQuery({ scroll: true });
        return;
      }

      if (action === 'quick-tab') {
        const tabKey = actionEl.dataset.tab;
        const tabs = document.querySelectorAll('.quick-tab');
        const tracks = document.querySelectorAll('.quick-filters-track');
        if (!tabKey || tabs.length === 0 || tracks.length === 0) return;
        tabs.forEach(tab => {
          const isActive = tab === actionEl;
          tab.classList.toggle('is-active', isActive);
          tab.setAttribute('aria-selected', String(isActive));
          tab.setAttribute('tabindex', isActive ? '0' : '-1');
        });
        tracks.forEach(track => {
          const isActive = track.dataset.filterGroup === tabKey;
          track.classList.toggle('is-active', isActive);
          track.toggleAttribute('hidden', !isActive);
        });
        return;
      }

      if (action === 'toggle-quick-more') {
        const type = actionEl.dataset.filterType;
        if (!type || !this.quickFilterState[type]) return;
        this.quickFilterState[type].expanded = !this.quickFilterState[type].expanded;
        this.renderQuickFilters();
        return;
      }

      if (action === 'apply-mood-cluster') {
        const clusterKey = actionEl.dataset.clusterKey;
        if (clusterKey) {
          this.applyMoodFilterCluster(clusterKey);
        }
        return;
      }

      if (action === 'scroll-to-filters') {
        this.scrollToFiltersSection();
        return;
      }

      if (action === 'learn-scores') {
        Onboarding.reopenTour();
        return;
      }

      if (action === 'explain-recommendations') {
        this.showRecommendationsHelp();
        return;
      }

      if (action === 'metric-help') {
        const metricKey = actionEl.dataset.metric;
        if (metricKey) {
          this.showMetricHelp(metricKey);
        }
        return;
      }

      if (action === 'apply-preset') {
        const presetKey = actionEl.dataset.preset;
        if (presetKey) {
          this.applyFilterPreset(presetKey);
        }
        return;
      }

      if (action === 'set-theme') {
        const theme = actionEl.dataset.themeOption;
        if (theme) {
          ThemeManager.handleThemeSelection(theme);
          // Update UI to reflect selection
          document.querySelectorAll('[data-theme-option]').forEach(btn => {
            const isActive = btn.dataset.themeOption === theme;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          });
        }
        return;
      }

      if (action === 'watch-progress-inc') {
        const animeId = actionEl.dataset.animeId || this.currentAnimeId;
        if (animeId) {
          this.adjustWatchProgress(animeId, 1);
        }
        return;
      }

      if (action === 'watch-progress-dec') {
        const animeId = actionEl.dataset.animeId || this.currentAnimeId;
        if (animeId) {
          this.adjustWatchProgress(animeId, -1);
        }
        return;
      }

      if (action === 'toggle-trailer') {
        this.toggleTrailerPlayback();
        return;
      }

      if (action === 'open-anime') {
        const animeId = actionEl.dataset.animeId;
        if (animeId) {
          this.showAnimeDetail(animeId);
        }
        const dropdown = actionEl.closest('.header-search-dropdown');
        if (dropdown) {
          this.resetHeaderSearch({ clearInput: true });
        }
        return;
      }

      if (action === 'load-more') {
        this.loadMoreAnime();
      }

      if (action === 'surprise-me') {
        const excludeIds = this.getWatchlistIds();
        const surprise = Discovery.getSurpriseMe(this.animeData, {
          excludeIds,
          useWatchlist: true
        });

        if (surprise) {
          Discovery.trackSurpriseMe(surprise.id);
          this.showAnimeDetail(surprise.id);
        }
        return;
      }

      if (action === 'set-rec-mode') {
        const modeKey = actionEl.dataset.mode;
        if (modeKey && Recommendations.setMode(modeKey)) {
          this.renderRecommendationModes();
          this.renderRecommendations();
        }
        return;
      }

      if (action === 'apply-seasonal') {
        const seasonYear = actionEl.dataset.seasonYear;
        if (seasonYear) {
          this.applySeasonalFilter(seasonYear);
        }
        return;
      }

      if (action === 'close-detail') {
        this.closeDetailModal();
        return;
      }

      if (action === 'retry-reviews') {
        const anime = this.animeData.find(a => a.id === this.currentAnimeId);
        if (anime) {
          this.loadCommunityReviews(anime, anime.synopsis, true);
        }
        return;
      }
    });

    this.addTrackedListener(document, 'keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const actionEl = event.target.closest('[data-action="open-anime"]');
      if (!actionEl || actionEl !== event.target) return;
      if (event.key === ' ') {
        event.preventDefault();
      }
      actionEl.click();
    });
  },

  setupImageFallbacks() {
    this.addTrackedListener(document, 'error', (event) => {
      const target = event.target;
      if (!target || target.tagName !== 'IMG') return;
      if (this.isProxyImageUrl(target.currentSrc || target.src)) {
        this.markImageProxyFailed();
      }
      const primary = target.dataset.fallbackSrc;
      const secondary = target.dataset.fallbackSecondary;
      const appliedLevel = Number.parseInt(target.dataset.fallbackApplied || '0', 10);
      const nextSrc = appliedLevel === 0 ? primary : (appliedLevel === 1 ? secondary : '');
      if (!nextSrc) return;
      target.dataset.fallbackApplied = String(appliedLevel + 1);
      target.src = nextSrc;
    }, true);
  },

  getFranchiseData(anime) {
    const franchise = anime?.franchise;
    if (!franchise || typeof franchise !== 'object') return null;
    if (!Array.isArray(franchise.items) || franchise.items.length < 2) return null;
    return franchise;
  },

  getFranchiseRelationLabel(relationType) {
    switch (String(relationType || '').toUpperCase()) {
      case 'ENTRY':
        return 'Start here';
      case 'SEQUEL':
        return 'Sequel';
      case 'SIDE_STORY':
        return 'Side story';
      case 'SPIN_OFF':
        return 'Spin-off';
      case 'ALTERNATIVE':
        return 'Alt cut';
      case 'SUMMARY':
        return 'Recap';
      default:
        return 'Related';
    }
  },

  getFranchiseModeLabel(mode) {
    switch (String(mode || '').toLowerCase()) {
      case 'linear':
        return 'Linear path';
      case 'branched':
        return 'Branching franchise';
      default:
        return 'Related releases';
    }
  },

  renderFranchiseHubSection(anime) {
    const franchise = this.getFranchiseData(anime);
    if (!franchise) return '';

    const currentItem = franchise.items.find(item => item?.animeId === anime.id) || null;
    const mainItems = franchise.items.filter(item => item?.bucket === 'main');
    const entryItem = franchise.items.find(item => item?.isEntry) || mainItems[0] || franchise.items[0];
    const currentMainIndex = currentItem?.bucket === 'main'
      ? mainItems.findIndex(item => item === currentItem) + 1
      : null;
    const currentRoleLabel = currentItem ? this.getFranchiseRelationLabel(currentItem.relationType) : 'Related';
    const modeLabel = this.getFranchiseModeLabel(franchise.mode);
    const catalogCount = Number.isFinite(franchise.catalogCount) ? franchise.catalogCount : franchise.items.filter(item => item?.isInCatalog).length;
    const totalCount = Number.isFinite(franchise.totalCount) ? franchise.totalCount : franchise.items.length;
    const mainCount = Number.isFinite(franchise.mainCount) ? franchise.mainCount : mainItems.length;

    let summary = `Start with ${entryItem?.title || franchise.entryTitle || franchise.title}, then use the order below.`;
    if (currentItem?.isEntry) {
      summary = 'This is the cleanest starting point in the current franchise map.';
    } else if (currentItem?.bucket === 'main' && currentMainIndex > 1 && entryItem?.title) {
      summary = `Start with ${entryItem.title}. This title is step ${currentMainIndex} of ${mainCount} in the main story.`;
    } else if (currentItem?.bucket !== 'main' && currentItem?.anchorTitle && entryItem?.title) {
      summary = `Start with ${entryItem.title}. This ${currentRoleLabel.toLowerCase()} fits best after ${currentItem.anchorTitle}.`;
    }

    return `
      <section class="franchise-hub" id="franchise-hub-section">
        <div class="detail-section-header">
          <h3>Franchise Hub</h3>
          <span class="detail-section-note">${this.escapeHtml(modeLabel)}</span>
        </div>
        <div class="franchise-summary">
          <div class="franchise-summary-copy">
            <span class="franchise-eyebrow">Best place to start</span>
            <strong class="franchise-entry-title">${this.escapeHtml(entryItem?.title || franchise.entryTitle || franchise.title)}</strong>
            <p class="franchise-summary-text">${this.escapeHtml(summary)}</p>
          </div>
          <div class="franchise-summary-meta" aria-label="Franchise stats">
            <span class="franchise-summary-pill">${this.escapeHtml(`${mainCount} main story ${mainCount === 1 ? 'entry' : 'entries'}`)}</span>
            <span class="franchise-summary-pill">${this.escapeHtml(`${catalogCount} in catalog`)}</span>
            <span class="franchise-summary-pill">${this.escapeHtml(`${totalCount} total related titles`)}</span>
          </div>
        </div>
        <div class="franchise-list" role="list">
          ${franchise.items.map(item => {
      const isCurrent = item?.animeId === anime.id;
      const safeTitle = this.escapeHtml(item?.title || 'Untitled');
      const safeRelation = this.escapeHtml(this.getFranchiseRelationLabel(item?.relationType));
      const safeYear = Number.isInteger(item?.year) ? String(item.year) : 'Year unknown';
      const safeFormat = this.escapeHtml(item?.format || 'ANIME');
      const safeMeta = this.escapeHtml(item?.isInCatalog ? `${safeFormat} • ${safeYear} • In catalog` : `${safeFormat} • ${safeYear} • Outside current catalog`);
      const rawMainOrder = Number(item?.mainOrder);
      const mainOrderValue = Number.isInteger(rawMainOrder) && rawMainOrder > 0 ? rawMainOrder : null;
      const safeContext = item?.bucket === 'main' && mainOrderValue
        ? `Main story step ${mainOrderValue}${mainCount > 0 ? ` of ${mainCount}` : ''}`
        : (item?.anchorTitle ? `Best after ${item.anchorTitle}` : 'Related franchise title');
      const bucketToken = this.sanitizeClassToken(String(item?.bucket || 'related').replace(/_/g, '-')) || 'related';
      const classes = ['franchise-card', `franchise-card--${bucketToken}`];
      if (isCurrent) classes.push('is-current');
      if (item?.isEntry) classes.push('is-entry');
      if (!item?.isInCatalog) classes.push('is-external');
      const buttonLabel = item?.animeId && !isCurrent
        ? `<button class="btn btn-outline btn-sm franchise-card-action" data-action="open-anime" data-anime-id="${this.escapeAttr(item.animeId)}" type="button">Open details</button>`
        : `<span class="franchise-card-status">${isCurrent ? 'Viewing now' : (item?.isInCatalog ? 'In catalog' : 'Not in catalog')}</span>`;

      return `
              <article class="${classes.join(' ')}" role="listitem">
                <div class="franchise-card-step" aria-hidden="true">${this.escapeHtml(item?.bucket === 'main' && mainOrderValue ? String(mainOrderValue) : '•')}</div>
                <div class="franchise-card-body">
                  <div class="franchise-card-top">
                    <div class="franchise-card-copy">
                      <div class="franchise-card-badges">
                        ${item?.isEntry ? '<span class="franchise-badge franchise-badge--entry">Start</span>' : ''}
                        ${isCurrent ? '<span class="franchise-badge franchise-badge--current">You\'re here</span>' : ''}
                        <span class="franchise-badge franchise-badge--relation">${safeRelation}</span>
                      </div>
                      <h4 class="franchise-card-title">${safeTitle}</h4>
                      <div class="franchise-card-meta">${safeMeta}</div>
                    </div>
                    ${buttonLabel}
                  </div>
                  <p class="franchise-card-context">${this.escapeHtml(safeContext)}</p>
                </div>
              </article>
            `;
    }).join('')}
        </div>
      </section>
    `;
  },

  /**
   * Render similar anime section for the detail modal
   * @param {Object} anime - Current anime
   * @returns {string} HTML string
   */
  renderSimilarAnimeSection(anime) {
    const similarResults = Recommendations.getSimilarAnime(this.animeData, anime, 6);
    const hasGenres = Array.isArray(anime?.genres) && anime.genres.length > 0;
    const hasThemes = Array.isArray(anime?.themes) && anime.themes.length > 0;
    const canMatch = hasGenres && hasThemes;
    const simDims = this.getImageDimensions('similar');
    const simDimAttrs = simDims ? `width="${simDims.width}" height="${simDims.height}"` : '';

    const formatTags = (tags, max = 2) => {
      if (!Array.isArray(tags) || tags.length === 0) return 'None';
      const trimmed = tags.slice(0, max);
      const extra = tags.length - trimmed.length;
      return extra > 0 ? `${trimmed.join(', ')} +${extra}` : trimmed.join(', ');
    };

    const emptyMessage = canMatch
      ? 'No similar anime found yet.'
      : 'Similar anime needs both genre and theme tags for this title.';

    return `
      <div class="similar-anime">
        <div class="detail-section-header">
          <h3>Similar Anime</h3>
          <span class="detail-section-note">Shared genre + theme, aligned finish rate and satisfaction</span>
        </div>
        ${similarResults.length > 0 ? `
          <div class="similar-grid">
            ${similarResults.map(result => {
      const similar = result.anime;
      const episodeCount = this.getEpisodeCount(similar);
      const hasEpisodes = episodeCount > 0;
      const rawRetention = similar?.stats?.retentionScore;
      const retentionScore = hasEpisodes && Number.isFinite(rawRetention) ? Math.round(rawRetention) : null;
      const satisfactionScore = Number.isFinite(similar?.communityScore) ? similar.communityScore : null;
      const retentionClass = Recommendations.getRetentionClass(retentionScore);
      const satisfactionClass = Recommendations.getMalSatisfactionClass(satisfactionScore);
      const sharedGenres = formatTags(result.sharedGenres);
      const sharedThemes = formatTags(result.sharedThemes);
      const safeId = this.escapeAttr(similar.id);
      const safeTitle = this.escapeHtml(similar.title);
      const safeCover = this.escapeAttr(this.sanitizeImageUrl(similar.cover));
      const safeGenres = this.escapeHtml(sharedGenres);
      const safeThemes = this.escapeHtml(sharedThemes);
      const labelTitle = similar.title || 'this anime';
      const labelYear = similar.year ? `, ${similar.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

      const { src: simSrc, srcset: simSrcset, sizes: simSizes, fallback: simFallback } = this.buildImageSrcset(similar.cover, { sizeKey: 'similar' });
      const safeSimCover = this.escapeAttr(simSrc || this.sanitizeImageUrl(similar.cover));
      const simSrcsetAttr = simSrcset ? `srcset="${this.escapeAttr(simSrcset)}"` : '';
      const simSizesAttr = simSizes ? `sizes="${this.escapeAttr(simSizes)}"` : '';
      const simFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: simFallback,
        placeholder: 'https://via.placeholder.com/200x140?text=No+Image'
      });
      return `
                <div class="similar-card" data-action="open-anime" data-anime-id="${safeId}" role="button" tabindex="0" aria-label="${cardLabel}">
                  <img src="${safeSimCover}" ${simSrcsetAttr} ${simSizesAttr} alt="${safeTitle}" class="similar-cover" ${simDimAttrs} ${simFallbackAttrs}>
                  <div class="similar-info">
                    <div class="similar-title">${safeTitle}</div>
                    <div class="similar-tags">
                      <span class="similar-tag">Genres: ${safeGenres}</span>
                      <span class="similar-tag">Themes: ${safeThemes}</span>
                    </div>
                    <div class="similar-stats">
                      <span class="similar-stat ${retentionClass}">Finish Rate ${retentionScore !== null ? `${retentionScore}%` : 'N/A'}</span>
                      <span class="similar-stat ${satisfactionClass}">Satisfaction (MAL) ${satisfactionScore !== null ? `${satisfactionScore.toFixed(1)}/10` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        ` : `
          <p class="similar-empty">${emptyMessage}</p>
        `}
      </div>
    `;
  },

  isDetailCached(animeId) {
    return this.getDetailExperience().isCached(animeId);
  },

  getCachedDetail(animeId) {
    return this.getDetailExperience().getCached(animeId);
  },

  cacheDetail(animeId, html) {
    return this.getDetailExperience().cache(animeId, html);
  },

  /**
   * Show anime detail modal
   */
  showAnimeDetail(animeId, { updateUrl = true, skipModalOpen = false } = {}) {
    const renderStart = this.getPerformanceNow();
    this.stopTrailerPlayback();
    this.teardownTrailerObserver();

    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    const modalContent = modal ? modal.querySelector('.modal-content') : null;

    if (!modal || !content) return;

    const cachedDetail = this.getCachedDetail(animeId);
    const hasCachedDetail = Boolean(cachedDetail);
    const reportModalOpened = (detail = {}) => {
      this.emitAppEvent('rekonime:modal-opened', {
        animeId,
        durationMs: Math.round(this.getPerformanceNow() - renderStart),
        cached: hasCachedDetail,
        ...detail
      });
    };

    if (hasCachedDetail) {
      setHTML(content, cachedDetail);
    } else if (!skipModalOpen) {
      setHTML(content, this.renderDetailSkeleton());
    }
    if (!skipModalOpen) {
      this.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });
    }

    let anime = this.animeData.find(a => a.id === animeId);
    if (!anime) {
      const key = this.normalizeBookmarkId(animeId);
      if (key) {
        const cached = this.getWatchlistSnapshot(key);
        if (cached) {
          anime = cached;
        }
      }
    }
    if (!anime) {
      if (updateUrl) {
        this.updateUrlForAnime(null, { replace: true });
      }
      this.resetMetaToDefault();
      // Show error in modal
      setHTML(content, `
        <div class="error-message">
          <h2>That title is not available</h2>
          <p>We could not find that anime in the current catalog.</p>
          <button class="btn btn-primary detail-close-button" data-action="close-detail">Back to browsing</button>
        </div>
      `);
      reportModalOpened({ status: 'not_found' });
      return;
    }

    this.currentAnimeId = anime.id;

    if (updateUrl) {
      this.updateUrlForAnime(anime.id);
    }

    if (!this.hasFullAnimeDetail(anime)) {
      this.loadAnimeDetailChunk(anime.id).then((detailAnime) => {
        if (!detailAnime || this.currentAnimeId !== anime.id) return;
        this.showAnimeDetail(anime.id, { updateUrl: false, skipModalOpen: true });
      });
    }

    const synopsis = this.getSynopsisForAnime(anime);
    if (hasCachedDetail) {
      this.updateWatchlistControls(anime.id);
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      content.scrollTop = 0;
      this.updateMetaForAnime(anime, synopsis);
      this.setupTrailerAutoplay(modalContent);
      this.loadCommunityReviews(anime, synopsis);
      this.updatePrefetchObserving();
      reportModalOpened({ status: 'ok' });
      return;
    }

    // Build genres and themes tags
    const genreTags = anime.genres && anime.genres.length > 0
      ? anime.genres.map(g => `<span class="detail-tag">${this.escapeHtml(g)}</span>`).join('')
      : '';
    const themeTags = anime.themes && anime.themes.length > 0
      ? anime.themes.map(t => `<span class="detail-tag">${this.escapeHtml(t)}</span>`).join('')
      : '';

    const synopsisMarkup = this.renderSynopsis(synopsis);
    const synopsisSection = synopsisMarkup || this.renderSynopsisLoading();
    const franchiseSection = this.renderFranchiseHubSection(anime);
    const trailerSection = this.renderTrailerSection(anime);
    const episodeCount = this.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const rawRetention = anime?.stats?.retentionScore;
    const retentionScore = hasEpisodes && Number.isFinite(rawRetention) ? Math.round(rawRetention) : null;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : null;
    const retentionClass = Recommendations.getRetentionClass(retentionScore);
    const malSatisfactionClass = Recommendations.getMalSatisfactionClass(malSatisfactionScore);
    const rawStart = anime?.stats?.threeEpisodeHook;
    const rawChurn = anime?.stats?.churnRisk?.score;
    const rawFinish = anime?.stats?.worthFinishing;
    const startScore = hasEpisodes && Number.isFinite(rawStart) ? Math.round(rawStart) : null;
    const stayScore = hasEpisodes && Number.isFinite(rawChurn) ? Math.round(100 - rawChurn) : null;
    const finishScore = hasEpisodes && Number.isFinite(rawFinish) ? Math.round(rawFinish) : null;
    const safeStartScore = Number.isFinite(startScore) ? startScore : 0;
    const safeStayScore = Number.isFinite(stayScore) ? stayScore : 0;
    const safeFinishScore = Number.isFinite(finishScore) ? finishScore : 0;

    const metaParts = [anime.type, anime.year, anime.studio, anime.source, anime.demographic]
      .map(value => {
        const label = String(value ?? '').trim();
        const normalized = label.toLowerCase();
        if (!label || normalized === 'undefined' || normalized === 'null') return '';
        return label;
      })
      .filter(Boolean);
    const metaHtml = metaParts.map(part => `<span>${this.escapeHtml(part)}</span>`).join(' &bull; ');
    const safeTitle = this.escapeHtml(anime.title);
    const { src: detailSrc, srcset: detailSrcset, sizes: detailSizes, fallback: detailFallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'detail', preferOptimized: false });
    const safeCover = this.escapeAttr(detailSrc || this.sanitizeImageUrl(anime.cover));
    const detailSrcsetAttr = detailSrcset ? `srcset="${this.escapeAttr(detailSrcset)}"` : '';
    const detailSizesAttr = detailSizes ? `sizes="${this.escapeAttr(detailSizes)}"` : '';
    const detailDims = this.getImageDimensions('detail');
    const detailDimAttrs = detailDims ? `width="${detailDims.width}" height="${detailDims.height}"` : '';
    const detailFallbackAttrs = this.getImageFallbackAttrs({
      fallbackSrc: detailFallback,
      placeholder: 'https://via.placeholder.com/150x210?text=No+Image'
    });

    const altTitles = [];
    if (anime.titleEnglish && anime.titleEnglish.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'English', value: anime.titleEnglish });
    }
    if (anime.titleJapanese && anime.titleJapanese.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'Japanese', value: anime.titleJapanese });
    }
    const altTitlesHtml = altTitles.length
      ? `<div class="detail-alt-titles">
          ${altTitles.map(item => `
            <div class="detail-alt-title">
              <span class="detail-alt-label">${this.escapeHtml(item.label)}</span>
              <span class="detail-alt-value">${this.escapeHtml(item.value)}</span>
            </div>
          `).join('')}
        </div>`
      : '';
    const similarSection = this.renderSimilarAnimeSection(anime);
    const watchlistControls = this.renderWatchlistControls(anime);
    const decision = this.getCardDecisionData(anime);
    const detailDecisionClass = this.sanitizeClassList('detail-verdict', decision.className);

    setHTML(content, `
      <div class="detail-header">
        <img src="${safeCover}" ${detailSrcsetAttr} ${detailSizesAttr} alt="${safeTitle}" class="detail-cover" ${detailDimAttrs} ${detailFallbackAttrs}>
        <div class="detail-info">
          <div class="detail-title-row">
            <h2 class="detail-title" id="detail-modal-title">${safeTitle}</h2>
          </div>
          ${altTitlesHtml}
          <div class="detail-meta">
            ${metaHtml}
          </div>
          <div class="detail-tags">
            ${genreTags}${themeTags}
          </div>
          <div class="detail-decision-panel">
            <div class="${detailDecisionClass}">
              <span class="detail-verdict-label">Decision signal</span>
              <strong class="detail-verdict-value">${this.escapeHtml(decision.value)}</strong>
              <span class="detail-verdict-copy">${this.escapeHtml(decision.note)}</span>
            </div>
            <div class="detail-stats">
              <div class="detail-stat has-tooltip" tabindex="0">
                <span class="detail-stat-value ${retentionClass}">${retentionScore !== null ? `${retentionScore}%` : 'N/A'}</span>
                <span class="detail-stat-label">Finish Rate</span>
                <div class="tooltip" role="tooltip">
                  <div class="tooltip-title">Finish Rate</div>
                  <div class="tooltip-text">How reliably viewers keep watching through the series. Factors in strong starts, low drop-off, and steady pacing.</div>
                </div>
              </div>
              <div class="detail-stat has-tooltip" tabindex="0">
                <span class="detail-stat-value ${malSatisfactionClass}">${malSatisfactionScore !== null ? `${malSatisfactionScore.toFixed(1)}/10` : 'N/A'}</span>
                <span class="detail-stat-label">Satisfaction (MAL)</span>
                <div class="tooltip" role="tooltip">
                  <div class="tooltip-title">Satisfaction Score</div>
                  <div class="tooltip-text">Community rating from MyAnimeList.</div>
                </div>
              </div>
              <div class="detail-stat">
                <span class="detail-stat-value">${episodeCount || 'N/A'}</span>
                <span class="detail-stat-label">Episodes</span>
              </div>
            </div>
            ${watchlistControls}
          </div>
        </div>
      </div>
      ${hasEpisodes ? `
        <div class="detail-breakdown">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
            <span class="detail-section-note">Start, stay, finish</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Strong start
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Strong Start</div>
                <div class="tooltip-text">How compelling the first 3 episodes are. High scores mean the show hooks viewers early.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeStartScore}" max="100" aria-label="Strong start score"></progress>
            <span class="breakdown-value">${startScore !== null ? `${startScore}%` : 'N/A'}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Keeps you watching
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Keeps You Watching</div>
                <div class="tooltip-text">Low drop-off probability. Measures how likely viewers are to continue without losing interest.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeStayScore}" max="100" aria-label="Keeps you watching score"></progress>
            <span class="breakdown-value">${stayScore !== null ? `${stayScore}%` : 'N/A'}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Finish payoff
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Finish Payoff</div>
                <div class="tooltip-text">How well the show sticks the landing. Combines finale strength, momentum, and narrative build-up.</div>
              </div>
            </span>
            <progress class="breakdown-progress" value="${safeFinishScore}" max="100" aria-label="Finish payoff score"></progress>
            <span class="breakdown-value">${finishScore !== null ? `${finishScore}%` : 'N/A'}</span>
          </div>
        </div>
      ` : `
        <div class="detail-breakdown detail-breakdown-empty">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
          </div>
          <p class="detail-empty">No episode scores yet. Finish Rate appears once episode scores are available.</p>
        </div>
      `}
      <div id="synopsis-section">
        ${synopsisSection}
      </div>
      ${franchiseSection}
      ${trailerSection}
      <div id="community-reviews-section">
        ${this.renderReviewsLoading()}
      </div>
      <div id="similar-anime-section">
        ${similarSection}
      </div>
    `);

    this.cacheDetail(anime.id, content.innerHTML);
    this.updateWatchlistControls(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    this.updateMetaForAnime(anime, synopsis);
    this.setupTrailerAutoplay(modalContent);

    // Load community reviews
    this.loadCommunityReviews(anime, synopsis);
    this.updatePrefetchObserving();
    reportModalOpened({ status: 'ok' });
  },

  /**
   * Load community reviews and synopsis from MyAnimeList
   */
  async loadCommunityReviews(anime, fallbackSynopsis = '') {
    return this.getDetailExperience().loadCommunityReviews(anime, fallbackSynopsis);
  },

  /**
   * Build sanitized trailer URLs from stored metadata.
   */
  buildTrailerUrls(trailer) {
    return buildTrustedTrailerUrls(trailer);
  },

  /**
   * Ensure trailer URLs only point to trusted YouTube hosts.
   */
  sanitizeTrailerUrl(rawUrl) {
    return sanitizeTrustedTrailerUrl(rawUrl);
  },

  sanitizeTrailerEmbedUrl(rawUrl) {
    return sanitizeTrustedTrailerEmbedUrl(rawUrl);
  },

  resolveTrailerMessageOrigin(iframe) {
    if (!iframe) return '';
    const rawUrl = iframe.dataset?.embedSrc || iframe.getAttribute('src') || '';
    return resolveTrustedTrailerMessageOrigin(rawUrl, window.location.href);
  },

  /**
   * Render the trailer section for the detail modal.
   */
  renderTrailerSection(anime) {
    const trailer = anime?.trailer;
    if (!trailer) return '';

    const { url, embedUrl } = this.buildTrailerUrls(trailer);
    if (!url && !embedUrl) return '';

    const title = anime?.title ? `Trailer for ${anime.title}` : 'Anime trailer';
    const safeTitle = this.escapeAttr(title);
    const safeUrl = this.escapeAttr(url);
    const safeEmbedUrl = this.escapeAttr(embedUrl);
    const allowEmbed = this.shouldEmbedTrailers();
    const showEmbed = Boolean(allowEmbed && embedUrl);

    return `
      <div class="detail-trailer" id="detail-trailer">
        <div class="detail-section-header">
          <h3>Trailer</h3>
          <div class="trailer-controls">
            ${showEmbed ? `
              <button class="trailer-control-btn" id="trailer-toggle" type="button" data-action="toggle-trailer" aria-pressed="false" aria-label="Pause trailer" title="Pause trailer">
                <span class="trailer-control-label">Pause</span>
              </button>
            ` : ''}
            ${url ? `<a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="strict-origin-when-cross-origin">Watch on YouTube</a>` : ''}
          </div>
        </div>
        ${allowEmbed && embedUrl
        ? `<div class="trailer-embed">
              <iframe
                src="about:blank"
                data-embed-src="${safeEmbedUrl}"
                title="${safeTitle}"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>`
        : `<div class="trailer-fallback">
              ${allowEmbed ? '' : '<p class="trailer-note">Data Saver is on, so the embedded trailer is hidden.</p>'}
              ${url ? `<a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="strict-origin-when-cross-origin">Watch on YouTube</a>` : ''}
            </div>`
      }
      </div>
    `;
  },

  buildAutoplayEmbedUrl(embedUrl) {
    const safeEmbedUrl = this.buildEmbedUrlWithApi(embedUrl);
    if (!safeEmbedUrl) return '';

    try {
      const url = new URL(safeEmbedUrl);
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '1');
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  buildEmbedUrlWithApi(embedUrl) {
    const safeEmbedUrl = this.sanitizeTrailerEmbedUrl(embedUrl);
    if (!safeEmbedUrl) return '';

    try {
      const url = new URL(safeEmbedUrl);
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('playsinline', '1');
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  isElementInScrollView(element, root, threshold = 0.4) {
    if (!element) return false;
    const targetRect = element.getBoundingClientRect();
    if (!root) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const visibleHeight = Math.max(0, Math.min(targetRect.bottom, viewportHeight) - Math.max(targetRect.top, 0));
      return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
    }

    const rootRect = root.getBoundingClientRect();
    const visibleTop = Math.max(targetRect.top, rootRect.top);
    const visibleBottom = Math.min(targetRect.bottom, rootRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
  },

  setTrailerControlState(isPaused) {
    const button = document.getElementById('trailer-toggle');
    if (!button) return;
    const label = isPaused ? 'Play trailer' : 'Pause trailer';
    button.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const text = button.querySelector('.trailer-control-label');
    if (text) {
      text.textContent = isPaused ? 'Play' : 'Pause';
    }
  },

  setTrailerPaused(iframe, isPaused) {
    if (!iframe) return;
    iframe.dataset.paused = isPaused ? '1' : '';
    this.setTrailerControlState(isPaused);
  },

  sendTrailerCommand(iframe, command) {
    if (!iframe || !iframe.contentWindow) return;
    const targetOrigin = this.resolveTrailerMessageOrigin(iframe);
    if (!targetOrigin) return;
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: command,
      args: []
    }), targetOrigin);
  },

  toggleTrailerPlayback() {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    const isPaused = iframe.dataset.paused === '1';
    if (isPaused) {
      this.resumeTrailerPlayback(iframe);
    } else {
      this.pauseTrailerPlayback(iframe);
    }
  },

  pauseTrailerPlayback(iframe) {
    if (!iframe) return;
    const embedSrc = iframe.dataset.embedSrc;
    if (!embedSrc) return;

    this.sendTrailerCommand(iframe, 'pauseVideo');
    const safeEmbedSrc = this.buildEmbedUrlWithApi(embedSrc);
    if (safeEmbedSrc) {
      iframe.dataset.embedLoaded = '1';
      iframe.removeAttribute('loading');
      iframe.src = safeEmbedSrc;
    }
    iframe.dataset.autoplayStarted = '';
    this.setTrailerPaused(iframe, true);
  },

  resumeTrailerPlayback(iframe) {
    if (!iframe) return;
    const embedSrc = iframe.dataset.embedSrc;
    if (!embedSrc) return;

    const autoplaySrc = this.buildAutoplayEmbedUrl(embedSrc);
    const safeEmbedSrc = autoplaySrc || this.buildEmbedUrlWithApi(embedSrc);
    if (!safeEmbedSrc) return;

    iframe.dataset.autoplayStarted = '1';
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = safeEmbedSrc;
    this.setTrailerPaused(iframe, false);
  },

  setupTrailerAutoplay(modalContent) {
    this.teardownTrailerObserver();
    this.teardownTrailerScrollListener();
    this.trailerCleanup = null;
    const trailerEmbed = document.querySelector('.detail-trailer .trailer-embed');
    if (!trailerEmbed) return;

    const iframe = trailerEmbed.querySelector('iframe');
    if (!iframe || !iframe.dataset.embedSrc) return;
    this.setTrailerPaused(iframe, !this.shouldAutoplayTrailers());

    const root = modalContent || document.querySelector('#detail-modal .modal-content');
    const activateTrailer = () => {
      if (iframe.dataset.paused === '1') {
        this.loadTrailerEmbed(iframe);
        return;
      }
      if (this.shouldAutoplayTrailers()) {
        this.startTrailerAutoplay(iframe);
      } else {
        this.loadTrailerEmbed(iframe);
      }
    };

    if (!('IntersectionObserver' in window)) {
      activateTrailer();
      return;
    }

    const observer = new IntersectionObserver((entries, activeObserver) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activateTrailer();
          activeObserver.disconnect();
          this.trailerObserver = null;
          this.teardownTrailerScrollListener();
          break;
        }
      }
    }, {
      root: root || null,
      threshold: 0.4
    });

    observer.observe(trailerEmbed);
    this.trailerObserver = observer;

    const scrollRoot = root || window;
    const handler = () => {
      if (this.isElementInScrollView(trailerEmbed, root || null, 0.35)) {
        activateTrailer();
        this.teardownTrailerObserver();
        this.teardownTrailerScrollListener();
      }
    };

    this.trailerScrollRoot = scrollRoot;
    this.trailerScrollHandler = handler;
    scrollRoot.addEventListener('scroll', handler, { passive: true });
    requestAnimationFrame(handler);

    this.trailerCleanup = () => {
      this.teardownTrailerObserver();
      this.teardownTrailerScrollListener();
      this.stopTrailerPlayback();
    };
  },

  startTrailerAutoplay(iframe) {
    if (!this.shouldAutoplayTrailers()) return;
    if (!iframe || iframe.dataset.autoplayStarted === '1') return;
    if (iframe.dataset.paused === '1') {
      this.loadTrailerEmbed(iframe);
      return;
    }
    const embedSrc = iframe.dataset.embedSrc;
    if (!embedSrc) return;

    const autoplaySrc = this.buildAutoplayEmbedUrl(embedSrc);
    if (!autoplaySrc) return;

    iframe.dataset.autoplayStarted = '1';
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = autoplaySrc;
    this.setTrailerPaused(iframe, false);
  },

  stopTrailerPlayback() {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    iframe.dataset.autoplayStarted = '';
    iframe.dataset.embedLoaded = '';
    iframe.src = 'about:blank';
    this.setTrailerPaused(iframe, true);
  },

  teardownTrailerObserver() {
    if (this.trailerObserver) {
      this.trailerObserver.disconnect();
      this.trailerObserver = null;
    }
  },

  teardownTrailerScrollListener() {
    if (this.trailerScrollRoot && this.trailerScrollHandler) {
      this.trailerScrollRoot.removeEventListener('scroll', this.trailerScrollHandler);
    }
    this.trailerScrollRoot = null;
    this.trailerScrollHandler = null;
  },

  /**
   * Close detail modal
   */
  closeDetailModal({ updateUrl = true } = {}) {
    return this.getDetailExperience().close({ updateUrl });
  },

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('app-container');
    if (container) {
      const safeMessage = this.escapeHtml(message);
      setHTML(container, `
        <div class="error-message">
          <h2>Something went wrong</h2>
          <p>${safeMessage}</p>
        </div>
      `);
    }
  },

  ensureToastRegion() {
    if (typeof document === 'undefined') return null;
    let region = document.getElementById(this.toastRegionId);
    if (region) return region;
    region = document.createElement('div');
    region.id = this.toastRegionId;
    region.className = 'toast-region';
    region.setAttribute('role', 'region');
    region.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(region);
    return region;
  },

  showToast(message, { type = 'info', duration = 4500 } = {}) {
    if (typeof document === 'undefined') return '';
    if (!message) return '';
    const region = this.ensureToastRegion();
    if (!region) return '';

    const toastId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast = document.createElement('div');
    const ariaLive = type === 'error' || type === 'success' ? 'assertive' : 'polite';

    toast.id = toastId;
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', ariaLive);
    toast.setAttribute('aria-atomic', 'true');
    toast.textContent = message;

    region.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    const timeoutId = window.setTimeout(() => this.dismissToast(toastId), duration);
    this.toastTimers.set(toastId, timeoutId);
    return toastId;
  },

  dismissToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    const timeoutId = this.toastTimers.get(toastId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.toastTimers.delete(toastId);
    }

    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.remove();
      const region = document.getElementById(this.toastRegionId);
      if (region && region.childElementCount === 0) {
        region.remove();
      }
    }, 250);
  },

  /**
   * Show metric help modal
   */
  showMetricHelp(metricKey) {
    const content = MetricGlossary.getDetailedContent(metricKey);
    if (!content) return;

    const body = document.getElementById('metric-help-body');
    const modal = document.getElementById('metric-help-modal');

    if (body && modal) {
      setHTML(body, content);
      this.setModalVisibility('metric-help-modal', true, { initialFocusSelector: '#close-metric-help' });

      const analytics = this.getAnalytics();
      if (analytics) {
        analytics.track('metric_help_opened', { metric: metricKey });
      }
    }
  },

  /**
   * Close metric help modal
   */
  closeMetricHelpModal() {
    this.setModalVisibility('metric-help-modal', false);
  },

  /**
   * Show recommendations help
   */
  showRecommendationsHelp() {
    const content = `
      <div class="recommendations-help">
        <h3>Why These Recommendations Stand Out</h3>
        <p>Rekonime balances two signals to keep suggestions both useful and trustworthy:</p>
        <div class="help-factor">
          <strong>Finish Rate (60%)</strong>
          <p>How likely a show is to keep viewers watching through the full run.</p>
        </div>
        <div class="help-factor">
          <strong>Satisfaction Score (40%)</strong>
          <p>Community sentiment from MyAnimeList that reflects how strongly viewers rated it.</p>
        </div>
        <p class="help-note">Together, they surface anime that is easier to stick with and more likely to pay off.</p>
      </div>
    `;

    const body = document.getElementById('metric-help-body');
    const modal = document.getElementById('metric-help-modal');

    if (body && modal) {
      setHTML(body, content);
      this.setModalVisibility('metric-help-modal', true, { initialFocusSelector: '#close-metric-help' });
    }
  },

  /**
   * Apply a filter preset
   */
  applyFilterPreset(presetKey) {
    const preset = FilterPresets.get(presetKey);
    if (!preset) return;

    FilterPresets.trackUsage(presetKey);

    const filtered = FilterPresets.applyPreset(presetKey, this.animeData);
    this.filteredData = filtered;

    const sortKey = FilterPresets.getSortForPreset(presetKey);
    this.currentSort = sortKey;

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.value = sortKey;
    }

    this.resetGridPagination();
    this.render();

    const target = document.getElementById('catalog-section');
    if (target) {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  },

  buildImageProxyUrl(coverUrl, { width, height } = {}) {
    if (!this.shouldUseImageProxy()) return '';
    return buildSharedImageProxyUrl(coverUrl, {
      sanitizeImageUrl: (value) => this.sanitizeImageUrl(value),
      width,
      height,
      fit: 'cover',
      output: 'webp'
    });
  },

  getImageFallbackSources({ fallbackSrc, placeholder }) {
    const primary = fallbackSrc || placeholder || '';
    const secondary = fallbackSrc && placeholder && fallbackSrc !== placeholder ? placeholder : '';
    return { primary, secondary };
  },

  getImageFallbackAttrs({ fallbackSrc, placeholder }) {
    const { primary, secondary } = this.getImageFallbackSources({ fallbackSrc, placeholder });
    if (!primary) return '';
    const safePrimary = this.escapeAttr(primary);
    const safeSecondary = secondary ? ` data-fallback-secondary="${this.escapeAttr(secondary)}"` : '';
    return `data-fallback-src="${safePrimary}"${safeSecondary}`;
  },

  /**
   * Build responsive image srcset for MyAnimeList CDN images
   * Note: MAL CDN doesn't reliably support size variants, so we proxy for WebP when enabled.
   * Returns srcset string, sizes attribute, and fallback (original URL when proxied).
   */
  buildImageSrcset(coverUrl, { sizeKey = 'card', preferOptimized } = {}) {
    if (!coverUrl) return { src: '', srcset: '', sizes: '', fallback: '' };

    const sanitized = this.sanitizeImageUrl(coverUrl);
    if (!sanitized) return { src: '', srcset: '', sizes: '', fallback: '' };

    const useOptimized = typeof preferOptimized === 'boolean' ? preferOptimized : this.shouldUseImageProxy();
    if (!useOptimized) {
      return { src: sanitized, srcset: '', sizes: '', fallback: '' };
    }

    const dims = this.getImageDimensions(sizeKey);
    if (!dims) {
      return { src: sanitized, srcset: '', sizes: '', fallback: '' };
    }

    const optimized = this.buildImageProxyUrl(sanitized, dims);
    if (!optimized) {
      return { src: sanitized, srcset: '', sizes: '', fallback: '' };
    }

    return { src: optimized, srcset: '', sizes: '', fallback: sanitized };
  },

  /**
   * Render detail modal skeleton screen for immediate visual feedback
   * Prevents layout jump during async data loading
   */
  renderDetailSkeleton() {
    return `
      <div class="detail-skeleton">
        <div class="detail-skeleton-header">
          <div class="detail-skeleton-cover"></div>
          <div class="detail-skeleton-info">
            <div class="detail-skeleton-title"></div>
            <div class="detail-skeleton-meta"></div>
            <div class="detail-skeleton-tags">
              <div class="detail-skeleton-tag"></div>
              <div class="detail-skeleton-tag"></div>
              <div class="detail-skeleton-tag"></div>
            </div>
            <div class="detail-skeleton-stats">
              <div class="detail-skeleton-stat"></div>
              <div class="detail-skeleton-stat"></div>
              <div class="detail-skeleton-stat"></div>
            </div>
            <div class="detail-skeleton-watchlist">
              <div class="detail-skeleton-pill"></div>
              <div class="detail-skeleton-pill wide"></div>
            </div>
          </div>
        </div>
        <div class="detail-skeleton-breakdown">
          <div class="detail-skeleton-section-title"></div>
          <div class="detail-skeleton-row">
            <div class="detail-skeleton-label"></div>
            <div class="detail-skeleton-bar"></div>
            <div class="detail-skeleton-value"></div>
          </div>
          <div class="detail-skeleton-row">
            <div class="detail-skeleton-label"></div>
            <div class="detail-skeleton-bar"></div>
            <div class="detail-skeleton-value"></div>
          </div>
          <div class="detail-skeleton-row">
            <div class="detail-skeleton-label"></div>
            <div class="detail-skeleton-bar"></div>
            <div class="detail-skeleton-value"></div>
          </div>
        </div>
        <div class="detail-skeleton-section">
          <div class="detail-skeleton-section-title"></div>
          <div class="detail-skeleton-text"></div>
          <div class="detail-skeleton-text medium"></div>
          <div class="detail-skeleton-text short"></div>
        </div>
        <div class="detail-skeleton-trailer"></div>
        <div class="detail-skeleton-reviews">
          <div class="detail-skeleton-section-title"></div>
          <div class="detail-skeleton-tabs">
            <div class="detail-skeleton-tab"></div>
            <div class="detail-skeleton-tab"></div>
            <div class="detail-skeleton-tab"></div>
          </div>
          <div class="detail-skeleton-review-cards">
            <div class="detail-skeleton-review"></div>
            <div class="detail-skeleton-review"></div>
          </div>
        </div>
        <div class="detail-skeleton-similar">
          <div class="detail-skeleton-section-title"></div>
          <div class="detail-skeleton-similar-grid">
            <div class="detail-skeleton-similar-card"></div>
            <div class="detail-skeleton-similar-card"></div>
            <div class="detail-skeleton-similar-card"></div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Handle deep link navigation after the catalog is ready.
   */
  async handleDeepLink(animeId) {
    return this.getDetailExperience().handleDeepLink(animeId);
  },

  /**
   * Render anime card with responsive image srcset
   */
  renderAnimeCardWithSrcset(anime, options = {}) {
    const { index = 0 } = options;
    const badges = Recommendations.getBadges(anime);
    const cardStats = Recommendations.getCardStats(anime);
    const episodeCount = this.getEpisodeCount(anime);
    const hasEpisodes = episodeCount > 0;
    const rawRetention = anime?.stats?.retentionScore;
    const retentionLevel = hasEpisodes && Number.isFinite(rawRetention) ? Math.round(rawRetention) : 0;
    const reason = Recommendations.getRecommendationReason(anime);

    const safeId = this.escapeAttr(anime.id);
    const safeTitle = this.escapeHtml(anime.title);
    const safeYear = this.escapeHtml(anime.year || 'Unknown');
    const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
    const safeReason = this.escapeHtml(reason);
    const labelTitle = anime.title || 'this anime';
    const labelYear = anime.year ? `, ${anime.year}` : '';
    const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

    // Build responsive image attributes
    const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'card' });
    const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(anime.cover));
    const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
    const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
    const cardFallbackAttrs = this.getImageFallbackAttrs({
      fallbackSrc: fallback,
      placeholder: 'https://via.placeholder.com/120x170?text=No+Image'
    });

    const loadingAttrs = this.getImageLoadingAttrs(index);
    const fetchPriorityAttr = loadingAttrs.fetchpriority ? `fetchpriority="${loadingAttrs.fetchpriority}"` : '';
    const cardDims = this.getImageDimensions('card');
    const cardDimAttrs = cardDims ? `width="${cardDims.width}" height="${cardDims.height}"` : '';
    return `
      <div class="anime-card" data-action="open-anime" data-anime-id="${safeId}" role="button" tabindex="0" aria-label="${cardLabel}">
        <div class="card-media">
          <img
            src="${safeCover}"
            ${srcsetAttr}
            ${sizesAttr}
            alt="${safeTitle}"
            class="card-cover"
            ${cardDimAttrs}
            loading="${loadingAttrs.loading}"
            decoding="${loadingAttrs.decoding}"
            ${fetchPriorityAttr}
            ${cardFallbackAttrs}>
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${safeTitle}</h3>
          </div>
          <div class="card-year">${safeYear} &bull; ${safeStudio}</div>
          ${badges.length > 0 ? `
            <div class="card-badges">
              ${badges.map((badge) => {
      const badgeClass = this.sanitizeClassList('card-badge', badge.class);
      return `<span class="${badgeClass}">${this.escapeHtml(badge.label)}</span>`;
    }).join('')}
            </div>
          ` : ''}
          <div class="card-stats">
            ${cardStats.map(stat => {
      const safeValue = this.escapeHtml(stat.value);
      const safeSuffix = this.escapeHtml(stat.suffix || '');
      const safeLabel = this.escapeHtml(stat.label);
      const statValueClass = this.sanitizeClassList('stat-value', stat.class);
      return `
                <div class="stat">
                  <span class="${statValueClass}">${safeValue}${safeSuffix}</span>
                  <span class="stat-label">${safeLabel}</span>
                </div>
              `;
    }).join('')}
          </div>
          <div class="retention-meter ${hasEpisodes ? '' : 'is-muted'}">
            <progress class="retention-progress" value="${retentionLevel}" max="100" aria-label="Finish Rate"></progress>
          </div>
          <div class="card-reason">${safeReason}</div>
        </div>
      </div>
    `;
  }
};

export { App };
export default App;


