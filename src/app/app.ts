// @ts-nocheck
import { IMAGE_PLACEHOLDER } from '../shared/runtime/image-placeholder.js';
import { appSeoMethods } from './app-seo.ts';
import { Recommendations } from '../features/discovery/recommendations.ts';
import { Discovery } from '../features/discovery/discovery.js';
import { FilterPresets } from '../features/discovery/filterPresets.ts';
import { BrowseFiltering } from '../features/discovery/browse-filtering.ts';
import { ThemeManager } from '../shared/ui/themeManager.js';
import { SidebarPreference } from '../shared/ui/sidebar-preference.ts';
import { CacheManager } from '../shared/services/cache-manager.ts';
import { createDetailExperience } from '../features/detail/detail-experience.ts';
import { createAppCatalogRuntime } from '../features/catalog/catalog-loader.ts';
import { CatalogPayload } from '../features/catalog/catalog-payload.ts';
import { Logger } from '../shared/services/logger.ts';
import { HealthMonitor } from '../shared/runtime/healthMonitor.js';
import { createImageProxyRuntime } from '../shared/runtime/image-proxy-runtime.js';
import { getRatingSignals } from '../features/discovery/rating-evidence.ts';
import { createRuntimeCapabilities } from '../shared/runtime/runtime-capabilities.ts';
import { createDiscoveryShortlist } from '../features/discovery/discovery-shortlist.ts';
import { runHomeAction } from './home-action-commands.ts';
import {
  renderWatchlistControlsHtml,
  updateWatchlistControlsElement
} from '../features/watchlist/watchlist-entry-presentation.ts';
import { createWatchlistAiringDashboardAdapter } from '../features/watchlist/watchlist-airing-dashboard-adapter.ts';
import { sanitizeUrl as sanitizeSafeUrl, sanitizeImageUrl as sanitizeSafeImageUrl } from '../shared/security/urlSanitizer.ts';
import { readImportText } from '../shared/security/import-limits.ts';
import {
  setHTML,
  insertHTML,
  setScriptSource
} from '../shared/security/trusted-types.js';
import {
  WATCH_STATUS_VALUES,
  buildAnimeSnapshot as buildWatchlistAnimeSnapshot,
  normalizeWatchlistSnapshot,
  createWatchlistLifecycle
} from '../features/watchlist/watchlist-state.js';
import { createWatchlistLifecycleRuntime } from '../features/watchlist/watchlist-lifecycle-runtime.ts';
import { buildContinueWatchingModel } from '../features/watchlist/continue-watching.ts';
import { recordBackupExport, updateBackupStatus } from '../features/preferences/backup-status.ts';
import { renderMalImport } from '../features/watchlist/mal-import-presentation.ts';
import { createWatchlistImportWorkflow } from '../features/watchlist/watchlist-import-workflow.ts';
import { createTasteProfileStore, TASTE_PROFILE_STORAGE_KEY } from '../features/preferences/taste-profile.ts';
import {
  recoverPendingPersonalDataRestore,
  restorePersonalData
} from '../features/preferences/personal-data-restore.ts';
import { dismissToast as dismissToastNotification, feedbackToastOptions, showToast as showToastNotification } from '../shared/ui/toast.ts';

/**
 * Main application logic for Anime Scoring Dashboard
 */

// MyAnimeList lists accolades alongside genres; they say nothing about what a show is.
const NON_GENRE_TAGS = new Set(['Award Winning']);
const App = {
  ...appSeoMethods,
  animeData: [],
  filteredData: [],
  currentSort: 'taste',
  filterPanelOpen: false,
  filterPanelRendered: false,
  filterPanelRenderHandle: null,
  get currentAnimeId() { return this.detailExperience?.getCurrentAnimeId() || null; },
  siteName: 'Rekonime',
  preferredHomePath: '/',
  basePageUrl: '',
  embeddedDataPromise: null,
  statsModule: null,
  statsModulePromise: null,
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
  fullCatalogPreloadPromise: null,
  fullCatalogInteractionListeners: [],
  preloadHintsAdded: false,
  defaultMeta: {
    title: '',
    description: '',
    image: '',
    url: ''
  },
  legacyWatchlistStorageKey: 'rekonime.bookmarks',
  watchlistStorageKey: 'rekonime.watchlist',
  settingsStorageKey: 'rekonime.settings',
  catalogCacheMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
  watchlistVersion: 1,
  settings: null,
  settingsRendered: false,
  watchlistImportWorkflow: null,
  watchlistEntries: new Map(),
  watchlistStatusOptions: WATCH_STATUS_VALUES,
  seoInitialized: false,
  urlFiltersApplied: false,
  filterQueryMap: BrowseFiltering.filterParamMap,
  filterTypeLabels: BrowseFiltering.filterTypeLabels,
  quickFilterState: {
    genres: { expanded: false },
    themes: { expanded: false }
  },
  discoveryShortlist: null,
  headerSearchState: {
    query: '',
    results: [],
    activeIndex: -1
  },
  lastAppliedSearchQuery: '',
  searchMaxResults: 8,
  runtimeCapabilities: null,
  registeredListeners: [],
  healthMonitorUnsubscribe: null,
  animeCardTemplate: null,
  gridDomCache: new Map(),
  detailExperience: null,
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
  virtualScrollingEnabled: true,
  imageDimensions: {
    card: { width: 240, height: 360 },
    recommendation: { width: 320, height: 190 },
    search: { width: 40, height: 56 },
    similar: { width: 200, height: 140 },
    detail: { width: 150, height: 210 },
    seed: { width: 32, height: 45 }
  },
  imageProxyStatusKey: 'rekonime.imageProxyStatus',
  imageProxyStatusTtlMs: 6 * 60 * 60 * 1000,
  imageProxyCheckTimeoutMs: 2500,
  imageProxyRuntime: null,
  airingDashboardAdapter: null,
  catalogRuntime: null,
  watchlistLifecycleRuntime: null,

  getCache() {
    return CacheManager;
  },

  getCatalogRuntime() {
    if (!this.catalogRuntime) {
      this.catalogRuntime = createAppCatalogRuntime(this);
    }
    return this.catalogRuntime;
  },

  isCatalogFull() {
    return this.getCatalogRuntime().isFullLoaded();
  },

  getDetailExperience() {
    if (!this.detailExperience) {
      this.detailExperience = createDetailExperience(this, { catalogRuntime: this.getCatalogRuntime() });
    }
    return this.detailExperience;
  },

  getWatchlistImportWorkflow() {
    if (!this.watchlistImportWorkflow) {
      this.watchlistImportWorkflow = createWatchlistImportWorkflow({
        getFullCatalog: async () => {
          const ready = await this.getCatalogRuntime().loadFullCatalog();
          return ready && this.isCatalogFull() ? this.animeData : null;
        },
        getEntries: () => {
          if (this.isDedicatedWatchlistPage()) this.loadWatchlist();
          return this.getWatchlistLifecycle().getEntries();
        },
        // The runtime reloads persisted entries before committing an import plan.
        applyPlan: plan => this.getWatchlistLifecycleRuntime().applyImport(plan),
        applyEffects: result => this.getWatchlistLifecycleRuntime().applyEffects(result),
        refreshRecommendations: () => {
          this.refreshTasteProfileEvidence();
          this.updateTasteProfileUi();
          this.renderRecommendations();
        },
        onUpdate: update => this.rerenderMalWatchlistImport(update)
      });
    }
    return this.watchlistImportWorkflow;
  },

  getRuntimeCapabilities() {
    if (!this.runtimeCapabilities) {
      this.runtimeCapabilities = createRuntimeCapabilities({
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
    }
    return this.runtimeCapabilities;
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

  // The dedicated Watchlist page renders its own list and loads this App lazily; it edits the
  // same persisted Watchlist through its own Watchlist Lifecycle Runtime.
  isDedicatedWatchlistPage() {
    return typeof document !== 'undefined' && document.getElementById('watchlist-grid')?.dataset.renderer === 'watchlist-page';
  },

  getWatchlistLifecycleRuntime() {
    if (!this.watchlistLifecycleRuntime) {
      const dedicatedWatchlistPage = this.isDedicatedWatchlistPage();
      this.watchlistLifecycleRuntime = createWatchlistLifecycleRuntime({
        buildSnapshot: buildWatchlistAnimeSnapshot,
        getAnime: (animeId) => this.animeData.find(item => item?.id === animeId) || null,
        getLifecycle: () => this.getWatchlistLifecycle(),
        // Another lifecycle may have written storage underneath this App on the Watchlist page.
        loadBeforeTransition: dedicatedWatchlistPage,
        normalizeId: (animeId) => this.normalizeWatchlistId(animeId),
        host: {
          updateControls: (animeId) => this.updateWatchlistControls(animeId),
          renderWatchlist: () => this.renderWatchlist(),
          renderContinueWatching: () => this.renderContinueWatching(),
          emit: (name, payload) => this.emitAppEvent(name, payload),
          // On the Watchlist page the event re-renders the list, which schedules the dashboard.
          ...(dedicatedWatchlistPage ? {} : {
            scheduleDashboard: (options) => this.scheduleAiringDashboardRender(options)
          }),
          announce: (feedback) => this.showToast(feedback.message, {
            ...feedbackToastOptions(feedback),
            key: 'watchlist',
            type: 'success'
          }),
          announceFailure: (failure) => this.showToast(failure.message, {
            key: 'watchlist',
            type: 'error',
            duration: 10000
          }),
          refreshTasteProfile: () => this.refreshTasteProfileEvidence(),
          updateTasteProfileUi: () => this.updateTasteProfileUi(),
          renderRecommendations: () => this.renderRecommendations()
        }
      });
    }
    return this.watchlistLifecycleRuntime;
  },

  getLogger() {
    return Logger;
  },

  getTasteProfileStore() {
    if (!this.tasteProfileStore) {
      this.tasteProfileStore = createTasteProfileStore({
        storage: this.getCache(),
        now: () => Date.now()
      });
      this.tasteProfileStore.load();
    }
    return this.tasteProfileStore;
  },

  markCatalogFresh() {
    if (HealthMonitor?.markDataFresh) {
      HealthMonitor.markDataFresh('catalog');
      if (HealthMonitor.performHealthChecks) {
        HealthMonitor.performHealthChecks();
      }
    }
  },

  async loadStatsModule() {
    if (this.statsModule) return this.statsModule;
    if (this.statsModulePromise) return this.statsModulePromise;
    this.statsModulePromise = import('../features/discovery/stats.ts')
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

  getPerformanceNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
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
    this.virtualScrollingEnabled = !enableLowMotion;
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
        waitForLoad: true,
        sanitizeImageUrl: (value) => this.sanitizeImageUrl(value),
        dimensions: this.imageDimensions
      });
    }
    return this.imageProxyRuntime;
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
    if (this.getCatalogRuntime().hasInteractionCaptured() || this.isCatalogFull()) return;
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
    const catalogRuntime = this.getCatalogRuntime();
    if (catalogRuntime.hasInteractionCaptured() || catalogRuntime.isFullLoaded()) return;
    catalogRuntime.captureInteraction();
    this.teardownFullCatalogInteractionTriggers();
    this.getRuntimeCapabilities().queueIdleTask(() => {
      this.getCatalogRuntime().loadFullCatalog();
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

  normalizeWatchlistId(value) {
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

  renderWatchlistControls(anime) {
    if (!anime) return '';
    return renderWatchlistControlsHtml(this.getWatchlistLifecycle().getEntry(anime.id), {
      anime,
      episodeCount: CatalogPayload.getEpisodeCount(anime),
      escapeHtml: (value) => this.escapeHtml(value),
      escapeAttr: (value) => this.escapeAttr(value)
    });
  },

  getWatchlistSnapshot(animeId) {
    const key = this.normalizeWatchlistId(animeId);
    if (!key) return null;
    const entry = this.watchlistEntries.get(key);
    if (!entry?.snapshot) return null;
    return normalizeWatchlistSnapshot(entry.snapshot) || null;
  },

  loadWatchlist() {
    if (typeof window === 'undefined') return;
    const lifecycle = this.getWatchlistLifecycle();
    this.watchlistEntries = lifecycle.load();
  },

  saveWatchlist() {
    if (typeof window === 'undefined') return false;
    return this.getWatchlistLifecycle().save();
  },

  getWatchlistAnime({ statuses } = {}) {
    return this.getWatchlistLifecycle().getAnimeItems(this.animeData, { statuses });
  },

  getAiringDashboardAnimeItems({ statuses } = {}) {
    return this.getWatchlistLifecycle().getDisplayItems(this.animeData, { statuses });
  },

  getAiringDashboardAdapter() {
    if (!this.airingDashboardAdapter) {
      this.airingDashboardAdapter = createWatchlistAiringDashboardAdapter({
        logger: this.getLogger(),
        controllerOptions: { hideWhenNothingAiring: true }
      });
    }
    return this.airingDashboardAdapter;
  },

  scheduleAiringDashboardRender({ timeout = 2500, cacheOnly = false } = {}) {
    if (typeof document === 'undefined') return;
    const statuses = ['planned', 'watching'];
    this.getAiringDashboardAdapter().scheduleUpdate(
      () => this.getWatchlistLifecycle().getEntries({ statuses }),
      () => this.getAiringDashboardAnimeItems({ statuses }),
      { timeout, ...(cacheOnly ? { cacheOnly: true } : {}) }
    );
  },

  async renderAiringDashboard() {
    if (typeof document === 'undefined') return;
    const statuses = ['planned', 'watching'];
    const adapter = this.getAiringDashboardAdapter();
    const controller = await adapter.getAiringDashboardController();
    await controller.update({
      entries: this.getWatchlistLifecycle().getEntries({ statuses }),
      animeItems: this.getAiringDashboardAnimeItems({ statuses })
    });
  },

  getEpisodeLimitForAnime(animeId) {
    const anime = this.animeData.find(item => item?.id === animeId);
    if (!anime) return null;
    const total = CatalogPayload.getEpisodeCount(anime);
    if (!Number.isFinite(total) || total <= 0) return null;
    return total;
  },

  // Watchlist commands: the Watchlist Lifecycle Runtime applies every effect through its host.
  setWatchStatus(animeId, status, { episodeCount } = {}) {
    return this.getWatchlistLifecycleRuntime().setStatus(animeId, status, { episodeCount })?.compatibilityResult ?? null;
  },

  setWatchProgress(animeId, progress, { episodeCount } = {}) {
    return this.getWatchlistLifecycleRuntime().setProgress(animeId, progress, { episodeCount })?.compatibilityResult ?? null;
  },

  setWatchLoved(animeId, loved) {
    return this.getWatchlistLifecycleRuntime().setLoved(animeId, loved)?.compatibilityResult ?? null;
  },

  toggleWatchLoved(animeId) {
    return this.getWatchlistLifecycleRuntime().toggleLoved(animeId)?.compatibilityResult ?? null;
  },

  adjustWatchProgress(animeId, delta) {
    return this.getWatchlistLifecycleRuntime().adjustProgress(animeId, delta)?.compatibilityResult ?? null;
  },

  advanceWatchProgress(animeId) {
    return this.getWatchlistLifecycleRuntime().advanceProgress(animeId)?.compatibilityResult ?? null;
  },

  refreshTasteProfileEvidence() {
    this.getTasteProfileStore().updateInferredFromWatchlist(this.getWatchlistLifecycle().getEntries());
  },

  updateTasteProfileUi() {
    const settingsContent = document.getElementById('settings-content');
    if (settingsContent) {
      setHTML(settingsContent, this.renderSettingsPanel({ includeTitle: false }));
      updateBackupStatus();
    }
  },

  handleRecommendationFeedback(action, animeId, actionEl = null) {
    const shortlist = this.getDiscoveryShortlist();
    const outcome = shortlist.giveFeedback(action, animeId, {
      genre: actionEl?.dataset?.genre || '',
      theme: actionEl?.dataset?.theme || ''
    });
    if (action === 'rec-already-seen') {
      // The Watchlist Lifecycle Runtime host already redrew the shortlist.
      if (outcome.changed) this.updateTasteProfileUi();
      return;
    }
    if (outcome.error) {
      this.showToast(outcome.error, { type: 'error' });
      return;
    }
    if (!outcome.changed) return;
    const toastId = this.showToast(outcome.announcement, {
      key: 'taste-feedback',
      duration: 0,
      action: { label: 'Undo', onClick: (id) => {
        const undone = shortlist.undoFeedback(outcome.undoToken, animeId);
        if (!undone.changed) {
          this.showToast(undone.error, { type: 'error', key: 'taste-feedback-error' });
          return;
        }
        this.dismissToast(id);
        this.updateTasteProfileUi();
        this.renderRecommendations();
        this.showToast(undone.announcement);
        this.focusShortlistTarget(undone.focus);
      } }
    });
    this.updateTasteProfileUi();
    this.renderRecommendations();
    document.getElementById(toastId)?.querySelector('button')?.focus();
  },

  resetTasteProfile() {
    this.getTasteProfileStore().reset(this.getWatchlistLifecycle().getEntries());
    this.updateTasteProfileUi();
    this.renderRecommendations();
    this.showToast('Taste Profile reset.');
  },

  exportPersonalData() {
    if (this.isDedicatedWatchlistPage()) this.loadWatchlist();
    const payload = this.getTasteProfileStore().exportData(this.getWatchlistLifecycle().getEntries());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rekonime-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    recordBackupExport();
    this.showToast('Personal data export started.');
  },

  // Another tab changed saved personal data; reload it so this tab neither shows
  // stale progress nor overwrites the newer entries on its next save.
  handleExternalStorageChange(event) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const key = event?.key ?? null;
    const watchlistChanged = key === null || key === this.watchlistStorageKey;
    const tasteChanged = key === null || key === TASTE_PROFILE_STORAGE_KEY;
    if (!watchlistChanged && !tasteChanged) return false;
    try {
      if (watchlistChanged) this.loadWatchlist();
      if (tasteChanged) this.getTasteProfileStore().load();
      this.refreshTasteProfileEvidence();
      // Re-rendering settings would discard focus or an in-progress import review.
      const settingsContent = document.getElementById('settings-content');
      if (!settingsContent?.contains(document.activeElement)) this.updateTasteProfileUi();
      this.renderRecommendations();
      if (watchlistChanged) {
        // The Watchlist page re-renders itself from its own storage listener.
        if (document.getElementById('watchlist-grid')?.dataset.renderer !== 'watchlist-page') {
          this.renderWatchlist();
          this.scheduleAiringDashboardRender();
        }
        if (this.currentAnimeId) this.updateWatchlistControls(this.currentAnimeId);
        this.renderContinueWatching();
      }
      return true;
    } catch (error) {
      this.getLogger()?.warn?.('Failed to apply personal data changed in another tab', { error });
      return false;
    }
  },

  async restorePersonalDataFile(file) {
    if (!file) return;
    try {
      const text = await readImportText(file);
      const payload = JSON.parse(text);
      const result = restorePersonalData(payload, {
        tasteProfileStore: this.getTasteProfileStore(),
        watchlistLifecycle: this.getWatchlistLifecycle(),
        storage: this.getCache()
      });
      if (!result.ok) {
        const message = result.reason === 'unsupported_version'
          ? 'Restore failed. This Rekonime export version is not supported.'
          : result.reason === 'storage_failure'
            ? 'Restore failed. Your existing personal data was kept.'
            : result.reason === 'rollback_failure'
              ? 'Restore failed and the previous Watchlist could not be restored.'
              : 'Restore failed. Use a compatible Rekonime JSON export.';
        this.showToast(message);
        return result;
      }
      this.updateTasteProfileUi();
      this.renderRecommendations();
      if (result.mode === 'full') {
        this.renderWatchlist();
        if (this.currentAnimeId) this.updateWatchlistControls(this.currentAnimeId);
        if (!this.isDedicatedWatchlistPage()) this.scheduleAiringDashboardRender();
        this.emitAppEvent('rekonime:watchlist-updated', { id: '', removed: false, changedIds: this.getWatchlistLifecycle().getEntries().map(entry => entry.id) });
        this.renderContinueWatching();
      }
      this.showToast('Personal data restored.');
      return result;
    } catch (error) {
      this.showToast(error instanceof Error && error.message.startsWith('This file is too large.')
        ? error.message : 'Restore failed. Use a Rekonime JSON export.');
      return { ok: false, reason: 'invalid_file' };
    }
  },

  renderMalWatchlistImport() {
    return renderMalImport(this.getWatchlistImportWorkflow().getView(), value => this.escapeHtml(value), value => this.escapeAttr(value));
  },

  rerenderMalWatchlistImport({ focus, announcement = '', closeConfirmation = false }) {
    if (closeConfirmation) document.getElementById('mal-import-confirmation')?.close?.();
    const container = document.getElementById('settings-content');
    if (!container) return;
    setHTML(container, this.renderSettingsPanel({ includeTitle: false }));
    this.updateSettingsUi();
    this.settingsRendered = true;
    updateBackupStatus();
    requestAnimationFrame(() => {
      if (typeof focus === 'object') {
        const value = focus.useMal ? 'mal' : 'keep';
        [...document.querySelectorAll('[data-action="mal-conflict-choice"]')]
          .find(input => input.dataset.animeId === focus.conflictId && input.value === value)?.focus({ preventScroll: true });
      } else {
        const ids = { loading: 'mal-import-loading', review: 'mal-import-review-heading', error: 'mal-import-error',
          success: 'mal-import-success-heading', file: 'mal-watchlist-import-file' };
        document.getElementById(ids[focus])?.focus();
      }
      const status = document.getElementById('mal-import-status');
      if (status && announcement) status.textContent = announcement;
    });
  },

  openMalWatchlistConfirmation() {
    const dialog = document.getElementById('mal-import-confirmation');
    dialog?.showModal?.();
    if (dialog && !dialog.dataset.cancelFocusBound) {
      dialog.dataset.cancelFocusBound = 'true';
      dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') event.stopPropagation();
      });
      dialog.addEventListener('close', () => {
        if (this.getWatchlistImportWorkflow().getView().stage === 'review') document.querySelector('[data-action="confirm-mal-watchlist-import"]')?.focus();
      });
    }
    requestAnimationFrame(() => dialog?.querySelector('[value="cancel"]')?.focus());
  },

  updateWatchlistControls(animeId) {
    if (typeof document === 'undefined') return;
    if (!animeId || this.currentAnimeId !== animeId) return;
    const focusedAction = document.activeElement?.closest?.('[data-action]')?.dataset?.action || '';
    updateWatchlistControlsElement(document, this.getWatchlistLifecycle().getEntry(animeId), {
      anime: this.animeData.find(item => item?.id === animeId),
      episodeCount: this.getEpisodeLimitForAnime(animeId)
    });
    if (focusedAction) {
      Array.from(document.querySelectorAll('[data-action]'))
        .find(element => element.dataset.action === focusedAction && element.dataset.animeId === String(animeId))
        ?.focus();
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

  getSearchQueryFromUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      return String(url.searchParams.get('search') || '').trim();
    } catch (error) {
      return '';
    }
  },

  setActiveFiltersFromUrl({ updateUi = false } = {}) {
    const nextFilters = BrowseFiltering.getFiltersFromUrl(undefined, {
      filterOptions: this.filterOptions,
      fallbackHref: window.location.href
    });
    const changed = !BrowseFiltering.areFiltersEqual(
      this.activeFilters,
      nextFilters,
      Object.keys(this.activeFilters)
    );
    this.activeFilters = nextFilters;
    if (updateUi) {
      this.renderFilterPanel();
      this.renderQuickFilters();
    }
    return changed;
  },

  buildFilterStateUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      this.normalizeHomePath(url);
      BrowseFiltering.setFiltersOnUrl(url, this.activeFilters, { filterOptions: this.filterOptions });
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
      BrowseFiltering.setFiltersOnUrl(url, this.activeFilters, { filterOptions: this.filterOptions });
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
    return BrowseFiltering.getActiveFilterGroups(this.activeFilters, this.filterTypeLabels);
  },

  buildFilterMeta() {
    return BrowseFiltering.buildFilterMeta({
      activeFilters: this.activeFilters,
      searchQuery: this.getCatalogSearchQuery(),
      filterTypeLabels: this.filterTypeLabels,
      siteName: this.siteName,
      defaultTitle: this.defaultMeta.title,
      defaultDescription: this.defaultMeta.description,
      buildMetaDescription: this.buildMetaDescription.bind(this)
    });
  },

  updateMetaForFilters() {
    if (!this.seoInitialized || this.currentAnimeId) return;
    const hasFilters = this.getActiveFilterGroups().length > 0 || this.getCatalogSearchQuery().length >= 2;
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

    // Apply accessibility attributes if needed
    if (['reducedMotion', 'highContrast', 'largeText', 'dataSaver'].includes(key)) {
      this.applyAccessibilityAttributes();
    }

    // Refresh trailer if relevant setting changed
    if (['trailerAutoplay', 'dataSaver'].includes(key)) {
      this.detailExperience?.refreshTrailerSection();
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

  toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const isOpen = modal.classList.contains('visible');
    if (!isOpen) {
      this.ensureSettingsRendered();
    }
    this.getRuntimeCapabilities().setModalVisibility('settings-modal', !isOpen, {
      initialFocusSelector: '#close-settings'
    });
  },

  closeSettingsModal() {
    this.getRuntimeCapabilities().setModalVisibility('settings-modal', false);
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


  refreshWatchlistSnapshotsFromCatalog({ persist = false } = {}) {
    // The dedicated page edits through its own lifecycle while this App loads lazily.
    // Snapshot enrichment must start from those latest persisted entries.
    if (this.isDedicatedWatchlistPage()) this.loadWatchlist();
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
    if (!section || !grid || !empty || this.isDedicatedWatchlistPage()) return;

    const items = this.getWatchlistDisplayItems();
    if (items.length === 0) {
      section.classList.add('is-empty');
      grid.replaceChildren();
      return;
    }

    section.classList.remove('is-empty');
    grid.replaceChildren(this.renderAnimeCardsDom(items, { startIndex: 0 }));
  },

  renderContinueWatching() {
    const section = document.getElementById('continue-watching-section');
    const grid = document.getElementById('continue-watching-grid');
    if (!section || !grid) return;
    const items = buildContinueWatchingModel(this.getWatchlistLifecycle().getEntries(), this.animeData).slice(0, 1);
    section.hidden = items.length === 0;
    const heading = document.getElementById('continue-watching-heading');
    if (heading) heading.textContent = items[0]?.progress > 0 ? 'Continue watching' : 'Start watching';
    setHTML(grid, items.map(item => `<article class="continue-card">
      <button class="continue-title" type="button" data-action="open-anime" data-anime-id="${this.escapeAttr(item.id)}">${this.escapeHtml(item.title)}</button>
      <p>${item.progress}${item.episodeCount ? ` / ${item.episodeCount} episodes watched` : ` ${item.progress === 1 ? 'episode' : 'episodes'} watched · total unknown`}</p>
      <button class="btn btn-outline btn-sm" type="button" data-action="continue-progress" data-anime-id="${this.escapeAttr(item.id)}" aria-label="${this.escapeAttr(item.complete ? `Mark ${item.title} finished` : `Mark episode ${item.progress + 1} of ${item.title} watched`)}">${item.complete ? 'Mark finished' : `Watched episode ${item.progress + 1}`}</button>
    </article>`).join(''));
  },

  // Pagination state
  gridPageSize: 24,
  gridCurrentPage: 1,
  gridRenderedCount: 0,
  gridInitialBatchRendered: false,
  gridDeferredRenderHandle: null,
  initialGridBatchSize: 6,
  // Even, so the two-column mobile shelf never ends on a lone card.
  initialGridBatchSizeMobile: 4,
  gridSortedCache: null,
  gridSortedKey: '',
  gridSortedSource: null,
  gridSortedIsPartial: false,
  gridSortHandle: null,

  // Active filters state
  activeFilters: BrowseFiltering.getDefaultActiveFilters(),

  // Filter options (populated from data)
  filterOptions: BrowseFiltering.getDefaultFilterOptions(),

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.syncHomePath();
      this.renderLoadingState();
      const restoreRecovery = recoverPendingPersonalDataRestore(this.getCache(), {
        tasteProfileStore: this.getTasteProfileStore(),
        watchlistLifecycle: this.getWatchlistLifecycle()
      });
      if (!restoreRecovery.ok) throw new Error('Personal Data Restore recovery failed');
      this.loadWatchlist();
      this.getWatchlistLifecycle().migrateLegacy();
      this.refreshTasteProfileEvidence();
      this.loadSettings();
      this.updateGridPageSize();
      this.applyPerformancePreferences();
      this.getImageProxyRuntime().scheduleCheck({ timeout: 5000 });

      this.syncSearchWithUrl();
      this.setupEventListeners();
      const isCatalogPage = this.isCatalogPage();
      const requestedAnimeId = this.getAnimeIdFromUrl();

      if (!isCatalogPage) {
        this.renderWatchlist();
        this.scheduleAiringDashboardRender({ timeout: 2000 });
        if (requestedAnimeId) {
          this.showAnimeDetail(requestedAnimeId);
        }
      } else {
        const loaded = await this.getCatalogRuntime().loadInitialData();
        if (!loaded) {
          throw new Error('Failed to load catalog');
        }
        if (requestedAnimeId) {
          await this.showAnimeDetail(requestedAnimeId, { deepLink: true, updateUrl: false });
        }
      }

      this.setupFullCatalogInteractionTriggers();
      this.getRuntimeCapabilities().queueIdleTask(() => this.setupHealthMonitoring(), { timeout: 2000 });
      this.getRuntimeCapabilities().queueIdleTask(() => this.setupIntelligentPrefetching(), { timeout: 2000 });
      this.initSeo();
      this.updateHomeLinks();

      // A user can open details while the initial catalog cache write finishes.
      // That opening owns the modal even if its lazy view has not updated the URL.
      if (!requestedAnimeId && !this.currentAnimeId) {
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
    const options = Recommendations.getSortOptions();

    if (!options.some(option => option.value === this.currentSort)) {
      this.currentSort = options[0]?.value || 'taste';
    }
    for (const id of ['sort-select', 'filter-sort-select']) {
      const select = document.getElementById(id);
      if (!select) continue;
      setHTML(select, options.map(opt =>
        `<option value="${opt.value}">${opt.label}</option>`
      ).join(''));
      select.value = this.currentSort;
    }
    this.syncSortControls();
  },

  syncSortControls() {
    for (const id of ['sort-select', 'filter-sort-select']) {
      const select = document.getElementById(id);
      if (select) select.value = this.currentSort;
    }
    const summary = document.getElementById('catalog-sort-current');
    const sheetSelect = document.getElementById('filter-sort-select');
    if (summary) summary.textContent = `Current order: ${sheetSelect?.selectedOptions[0]?.textContent || ''}`;
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
    if (this.fullCatalogPreloadPromise || this.isCatalogFull()) return;
    if (!this.shouldPrefetchFullCatalog()) return;
    this.fullCatalogPreloadPromise = (async () => {
      await new Promise(resolve => {
        this.getRuntimeCapabilities().queueIdleTask(resolve, { timeout: 2000 });
      });
      await this.getCatalogRuntime().loadFullCatalog();
    })()
      .catch(() => null)
      .finally(() => {
        this.fullCatalogPreloadPromise = null;
      });
  },

  scheduleFullCatalogLoad() {
    const catalogRuntime = this.getCatalogRuntime();
    if (catalogRuntime.getScheduledFullLoadHandle() || catalogRuntime.isFullLoaded()) return;
    if (typeof window === 'undefined') {
      catalogRuntime.loadFullCatalog();
      return;
    }
    const delayMs = this.shouldPrefetchFullCatalog() ? 0 : 8000;
    const schedule = () => {
      catalogRuntime.setScheduledFullLoadHandle(this.getRuntimeCapabilities().queueIdleTask(() => {
        catalogRuntime.setScheduledFullLoadHandle(null);
        catalogRuntime.loadFullCatalog();
      }, { timeout: 2000 }));
    };

    if (delayMs > 0) {
      catalogRuntime.setScheduledFullLoadHandle(window.setTimeout(schedule, delayMs));
      return;
    }
    schedule();
  },

  // One invalidation policy for every catalog change. A replacement drops every derived
  // view; an enrichment drops the sort order and the enriched titles' detail views. Cached
  // grid cards stay attached because getGridCardElement refreshes a reused card in place.
  handleCatalogChange({ reason, ids = [] } = {}) {
    this.gridSortedCache = null;
    this.gridSortedKey = '';
    this.gridSortedSource = null;
    this.gridSortedIsPartial = false;
    if (this.gridSortHandle) this.getRuntimeCapabilities().cancelIdleTask(this.gridSortHandle);
    this.gridSortHandle = null;
    if (reason === 'enriched') {
      ids.forEach((id) => this.detailExperience?.invalidate(id));
      this.refreshWatchlistSnapshotsFromCatalog({ persist: true });
      return;
    }
    this.gridDomCache.clear();
    this.visibleCardIds.clear();
    this.detailExperience?.invalidate();
  },

  async applyCatalogPayload(payload, { isFull = false, preserveFilters = true } = {}) {
    const { state, intent } = CatalogPayload.prepareApplication(payload, {
      isFull,
      preserveFilters,
      defaultActiveFilters: BrowseFiltering.getDefaultActiveFilters(),
      filterUi: {
        catalogPage: this.isCatalogPage(),
        deferUsed: this.deferFilterUiUsed,
        hasFilterParams: BrowseFiltering.hasFilterParamsInUrl(undefined, { fallbackHref: window.location.href }),
        lowMotion: this.shouldEnableLowMotionMode(),
        panelVisible: this.filterPanelRendered || this.filterPanelOpen,
        urlFiltersApplied: this.urlFiltersApplied
      }
    });

    this.scoreProfile = state.scoreProfile;
    this.animeData = state.animeData;
    this.getCatalogRuntime().markFullLoaded(state.isFullDataLoaded);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.catalogStatus = state.catalogStatus;
      document.documentElement.dataset.catalogReady = String(state.catalogReady);
    }
    this.handleCatalogChange({ reason: 'replaced' });
    this.markCatalogFresh();
    if (state.activeFilters) this.activeFilters = state.activeFilters;

    await this.ensureStats();
    this.refreshWatchlistSnapshotsFromCatalog(intent.refreshWatchlistSnapshots);
    this.refreshTasteProfileEvidence();
    this.scheduleAiringDashboardRender(intent.scheduleAiringDashboard);
    this.extractFilterOptions();

    this.deferFilterUiOnce = intent.deferFilterUi;
    if (intent.applyUrlFilters) {
      this.setActiveFiltersFromUrl();
      this.urlFiltersApplied = true;
      if (intent.replaceUrlFilters) this.updateUrlForFilters({ replace: true });
    }

    if (intent.filterPanel !== 'none') this.updateSortOptions();
    if (intent.filterPanel === 'render') this.renderFilterPanel({ force: true });
    if (intent.filterPanel === 'schedule') this.scheduleFilterPanelRender();
    if (intent.renderQuickFilters) this.renderQuickFilters();
    this.applyFilters(intent.applyFilters);
    return state;
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
          </div>
        </div>
      </div>
    `;
  },

  renderLoadingState() {
    const recommendations = document.getElementById('recommendations-grid');
    const grid = document.getElementById('anime-grid');

    if (recommendations) {
      recommendations.classList.add('is-loading');
      recommendations.setAttribute('aria-busy', 'true');
      setHTML(recommendations, Array.from({ length: 3 }, () => this.renderCardSkeleton('recommendation')).join(''));
    }

    if (grid) {
      grid.classList.add('is-loading');
      grid.setAttribute('aria-busy', 'true');
      setHTML(grid, Array.from({ length: 6 }, () => this.renderCardSkeleton('catalog')).join(''));
    }

    this.renderDeferredUiLoadingState();
  },

  renderDeferredUiLoadingState() {
    const genreContainer = document.getElementById('genre-chips');
    const themeContainer = document.getElementById('theme-chips');
    const seasonalContainer = document.getElementById('seasonal-chips');

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
    const scoreProfile = CatalogPayload.isValidScoreProfile(this.scoreProfile)
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

  /**
   * Load embedded data only when fetch fails (keeps initial load light).
   */
  async loadEmbeddedData() {
    if (typeof ANIME_DATA !== 'undefined') {
      const validation = CatalogPayload.validateAnimeData(ANIME_DATA.anime);
      if (validation.isValid) {
        this.animeData = CatalogPayload.normalizeAnimeData(ANIME_DATA.anime || []);
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

    const validation = CatalogPayload.validateAnimeData(ANIME_DATA.anime);
    if (!validation.isValid) {
      const logger = this.getLogger();
      if (logger?.error) {
        logger.error('[loadEmbeddedData] Embedded data validation failed', { errors: validation.errors });
      } else {
        console.error('[loadEmbeddedData] Embedded data validation failed:', validation.errors);
      }
      return false;
    }

    this.animeData = CatalogPayload.normalizeAnimeData(ANIME_DATA.anime || []);
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

  findSearchMatches(query) {
    return BrowseFiltering.findSearchMatches({
      animeData: this.animeData,
      query,
      limit: this.searchMaxResults
    });
  },

  getCatalogSearchQuery() {
    return String(this.getSearchQueryFromUrl() || '').slice(0, 120).trim();
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
   * Extract unique filter options from data
   */
  extractFilterOptions() {
    this.filterOptions = BrowseFiltering.extractFilterOptions(this.animeData);
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.removeAllListeners();
    // Sort dropdown
    for (const id of ['sort-select', 'filter-sort-select']) {
      const sortSelect = document.getElementById(id);
      if (!sortSelect) continue;
      this.addTrackedListener(sortSelect, 'change', (e) => {
        this.currentSort = e.target.value;
        this.syncSortControls();
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

    document.querySelectorAll('#settings-toggle, #header-settings-toggle').forEach((settingsToggle) => {
      this.addTrackedListener(settingsToggle, 'click', () => {
        settingsToggle.closest('details')?.removeAttribute('open');
        this.toggleSettingsModal();
      });
    });

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

      if (target.closest?.('[data-renderer="watchlist-page"]')) return;
      const action = target.dataset?.action;
      if (action === 'watch-status') {
        const animeId = target.dataset.animeId || this.currentAnimeId;
        if (!animeId) return;
        this.setWatchStatus(animeId, target.value);
        target.focus({ preventScroll: true });
        return;
      }

      if (action === 'watch-progress') {
        const animeId = target.dataset.animeId || this.currentAnimeId;
        if (!animeId) return;
        this.setWatchProgress(animeId, target.value);
        return;
      }

      if (action === 'mal-conflict-choice') {
        this.getWatchlistImportWorkflow().choose(target.dataset.animeId, target.value === 'mal');
        return;
      }

      if (action === 'personal-data-file') {
        void this.restorePersonalDataFile(target.files?.[0] || null);
        target.value = '';
        return;
      }

      if (action === 'mal-watchlist-file') {
        void this.getWatchlistImportWorkflow().review(target.files?.[0] || null);
        target.value = '';
        return;
      }

      if (!target.classList.contains('settings-toggle-input')) return;
      const key = target.dataset.settingKey;
      if (!key) return;
      this.updateSetting(key, target.checked);
    });

    this.addTrackedListener(document, 'keydown', (event) => {
      if (this.getRuntimeCapabilities().handleGlobalEscape(event)) {
        event.preventDefault();
      }
    });

    this.addTrackedListener(window, 'storage', (event) => {
      this.handleExternalStorageChange(event);
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
      Object.values(BrowseFiltering.filterParamMap).forEach(param => url.searchParams.delete(param));
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

  /**
   * Handle header search input (opens anime detail)
   */
  handleHeaderSearch(query, { preserveActive = false } = {}) {
    const dropdown = document.getElementById('header-search-dropdown');
    const input = document.getElementById('header-search');
    if (!dropdown || !input) return;
    const searchDims = this.getImageProxyRuntime().getDimensions('search');
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
        placeholder: IMAGE_PLACEHOLDER
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
      this.getRuntimeCapabilities().setModalVisibility('filter-modal', this.filterPanelOpen, {
        initialFocusSelector: '#close-filter-modal'
      });
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
    this.getRuntimeCapabilities().setModalVisibility('filter-modal', false);
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
      { key: 'studio', label: 'Studios', advanced: true },
      { key: 'source', label: 'Sources', advanced: true }
    ];

    const filtersMarkup = filterConfig.map(config => {
      const options = this.filterOptions[config.key];
      if (!options || options.length === 0) return '';

      const safeLabel = this.escapeHtml(config.label);
      const safeType = this.escapeAttr(config.key);

      const pills = `
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
      `;
      return config.advanced
        ? `<details class="filter-section filter-disclosure"><summary class="filter-section-title">${safeLabel}</summary>${pills}</details>`
        : `<div class="filter-section"><div class="filter-section-title">${safeLabel}</div>${pills}</div>`;
    }).join('');

    html += filtersMarkup;
    setHTML(container, html);
    this.filterPanelRendered = true;
  },

  scheduleFilterPanelRender() {
    if (this.filterPanelRendered || this.filterPanelRenderHandle) return;
    this.filterPanelRenderHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
      this.filterPanelRenderHandle = null;
      this.renderFilterPanel({ force: true });
    }, { timeout: 2000 });
  },

  ensureFilterPanelRendered() {
    if (this.filterPanelRendered) return;
    if (this.filterPanelRenderHandle) {
      this.getRuntimeCapabilities().cancelIdleTask(this.filterPanelRenderHandle);
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
  },

  getDiscoveryShortlist() {
    if (!this.discoveryShortlist) {
      this.discoveryShortlist = createDiscoveryShortlist({
        findAnime: (animeId) => this.animeData.find(item => String(item?.id) === String(animeId)) || null,
        getTasteProfile: () => this.getTasteProfileStore(),
        getWatchlistEntries: () => this.getWatchlistLifecycle().getEntries(),
        getWatchlistRuntime: () => this.getWatchlistLifecycleRuntime(),
        getEpisodeCount: (anime) => CatalogPayload.getEpisodeCount(anime),
        recommendations: Recommendations,
        discovery: Discovery
      });
    }
    return this.discoveryShortlist;
  },

  // Render a Discovery Shortlist outcome: announce it, show any error, and move focus.
  applyShortlistOutcome(outcome) {
    if (!outcome) return;
    const status = document.getElementById('recommendations-status');
    if (status && outcome.announcement) status.textContent = outcome.announcement;
    if (outcome.error) this.showToast(outcome.error, { key: 'watchlist', type: 'error' });
    this.focusShortlistTarget(outcome.focus);
  },

  focusShortlistTarget(focus) {
    if (!focus) return;
    const byId = (selector) => [...document.querySelectorAll(selector)].find(element => element.dataset.animeId === focus.id);
    const targets = {
      'chosen-undo': () => document.querySelector('#chosen-title button[data-action="undo-recommendation-selection"]'),
      save: () => byId('[data-action="quick-save-recommendation"]'),
      pick: () => document.querySelectorAll('#recommendations-grid .recommendation-title')[focus.index],
      'latest-dismissal-undo': () => document.querySelector('#session-dismissals > p button'),
      'dismissal-review': () => document.querySelector('#session-dismissals:not([hidden]) summary'),
      taste: () => byId('.recommendation-card')?.querySelector('.recommendation-taste summary')
    };
    const target = targets[focus.target]?.()
      || document.querySelector('#recommendations-grid .recommendation-title')
      || document.getElementById('recommendations-heading');
    if (!target) return;
    if (target.tagName === 'H2' && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  },

  syncDiscoveryGardenVisibility() {
    const shouldHide = Boolean(this.getActiveFilterCount() || this.getCatalogSearchQuery());
    const hero = document.getElementById('discovery-garden');
    hero?.classList.toggle('is-hidden', shouldHide);
    hero?.classList.toggle('is-returning', this.getWatchlistLifecycle().getEntries().length > 0);
  },

  showSurpriseMe() {
    const surprise = this.getDiscoveryShortlist().pickSurprise(this.animeData);
    if (surprise) this.showAnimeDetail(surprise.id);
    return surprise;
  },

  /**
   * Toggle a filter on/off
   */
  toggleFilter(type, value) {
    const transition = BrowseFiltering.toggleFilterValue(this.activeFilters, type, value);
    this.activeFilters = transition.activeFilters;
    const ariaLabel = `${transition.isActive ? 'Remove' : 'Add'} ${transition.value} filter`;

    // Update pill state in modal
    const safeType = this.escapeCssValue(type);
    const pillCandidates = document.querySelectorAll(`.filter-pill[data-filter-type="${safeType}"]`);
    const pill = Array.from(pillCandidates).find(el => el.dataset.filterValue === transition.value);
    if (pill) {
      pill.classList.toggle('active', transition.isActive);
      pill.setAttribute('aria-pressed', transition.isActive ? 'true' : 'false');
      pill.setAttribute('aria-label', ariaLabel);
    }

    // Update quick chip state
    const chipCandidates = document.querySelectorAll(`.quick-chip[data-filter-type="${safeType}"]`);
    const chip = Array.from(chipCandidates).find(el => el.dataset.filterValue === transition.value);
    if (chip) {
      chip.classList.toggle('active', transition.isActive);
      chip.setAttribute('aria-pressed', transition.isActive ? 'true' : 'false');
      chip.setAttribute('aria-label', ariaLabel);
    }

    this.applyFilters();
  },

  /**
   * Count total active filters across all filter groups.
   * @returns {number} Active filter count
   */
  getActiveFilterCount() {
    return BrowseFiltering.getActiveFilterCount(this.activeFilters);
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
    target.open = true;
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
    document.querySelectorAll('.recommendation-card, .similar-card')
      .forEach(card => this.prefetchObserver.observe(card));
  },

  queuePrefetch(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key) return;
    if (this.prefetchQueue.has(key)) return;
    if (this.prefetchQueue.size >= this.prefetchLimit) return;
    this.prefetchQueue.add(key);

    this.getRuntimeCapabilities().queueIdleTask(() => this.prefetchAnime(key), { timeout: 2000 });
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
    this.activeFilters = BrowseFiltering.getDefaultActiveFilters();

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
    const searchQuery = this.getCatalogSearchQuery();
    const result = BrowseFiltering.applyFilters({
      animeData: this.animeData,
      activeFilters: this.activeFilters,
      searchQuery
    });
    this.lastAppliedSearchQuery = result.lastAppliedSearchQuery;
    this.filteredData = result.filteredData;

    // Reset pagination when filters change
    this.resetGridPagination();
    if (syncUrl) {
      this.updateUrlForFilters({ replace: replaceUrl });
    }
    this.render({ refreshRecommendations: true });
    if (updateMeta) {
      this.updateMetaForFilters();
    }
  },

  /**
   * Render the entire dashboard
   */
  render({ refreshRecommendations = false } = {}) {
    this.renderActiveFilters();
    this.renderContinueWatching();
    this.renderWatchlist();
    if (this.deferFilterUiOnce) {
      this.scheduleDeferredFilterUi();
    } else {
      this.renderSeasonalFilters();
    }
    this.renderAnimeGrid();
    this.updatePrefetchObserving();
    if (refreshRecommendations) {
      this.renderRecommendations();
    }
    this.scheduleSecondaryRenders({ force: refreshRecommendations, skipRecommendations: refreshRecommendations });
  },

  scheduleSecondaryRenders({ force = false, skipRecommendations = false } = {}) {
    if (this.secondaryDeferredTimeoutId && typeof window !== 'undefined') {
      window.clearTimeout(this.secondaryDeferredTimeoutId);
      this.secondaryDeferredTimeoutId = null;
    }
    if (force && this.secondaryRenderHandle) {
      this.getRuntimeCapabilities().cancelIdleTask(this.secondaryRenderHandle);
      this.secondaryRenderHandle = null;
    }
    if (force) {
      this.secondaryRenderInFlight = false;
    }
    if (this.secondaryRenderInFlight) return;
    this.secondaryRenderInFlight = true;
    const constrained = this.shouldDeferHeavyContent();
    const allTasks = [
      ...(skipRecommendations ? [] : [() => this.renderRecommendations()]),
      () => this.renderBecauseYouWatched()
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
          this.getRuntimeCapabilities().queueIdleTask(runNext, { timeout: constrained ? 2000 : 1200 });
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
        this.secondaryRenderHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
          this.secondaryRenderHandle = null;
          runQueue(deferredTasks, () => {
            this.secondaryRenderInFlight = false;
          });
        }, { timeout: 5000 });
      }, 5200);
      return;
    }

    this.secondaryRenderHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
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
    this.deferFilterUiHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
      this.deferFilterUiHandle = null;
      this.deferFilterUiOnce = false;
      this.deferFilterUiUsed = true;
      this.renderSeasonalFilters();
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
      // The row is labelled "By season", so each chip leads with the season itself.
      // Screen readers still hear the relative name ("This season: Fall 2026").
      const visibleLabel = filter.value || filter.label;
      const relativeLabel = filter.value ? `<span class="visually-hidden">${this.escapeHtml(filter.label)}: </span>` : '';
      const nowNote = filter.key === 'current' ? '<span class="seasonal-chip-note" aria-hidden="true">Now</span>' : '';
      return `
        <button class="seasonal-chip ${highlightClass} ${activeClass}"
                data-action="apply-seasonal"
                data-season-year="${this.escapeAttr(filter.value)}"
                type="button">${relativeLabel}${this.escapeHtml(visibleLabel)}${nowNote}</button>
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
   * Render Because You Watched section
   */
  renderBecauseYouWatched() {
    const section = document.getElementById('because-you-watched-section');
    const grid = document.getElementById('byw-grid');
    const seedContainer = document.getElementById('byw-seed');

    if (!section || !grid || !seedContainer) return;
    const seedDims = this.getImageProxyRuntime().getDimensions('seed');
    const seedDimAttrs = seedDims ? `width="${seedDims.width}" height="${seedDims.height}"` : '';
    const recDims = this.getImageProxyRuntime().getDimensions('recommendation');
    const recDimAttrs = recDims ? `width="${recDims.width}" height="${recDims.height}"` : '';

    const watchedIds = this.getWatchlistLifecycle().getIds({ statuses: ['watching', 'completed'] });
    const seedIds = watchedIds.length > 0
      ? watchedIds
      : this.getWatchlistLifecycle().getIds({ statuses: ['planned', 'watching', 'completed'] });

    const { recommendations, basedOn } = Recommendations.getBecauseYouWatched(
      this.animeData,
      seedIds,
      6,
      this.getWatchlistLifecycle().getEntries()
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
        placeholder: IMAGE_PLACEHOLDER
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
      const episodeCount = CatalogPayload.getEpisodeCount(anime);
      const signals = getRatingSignals(anime);
      const retention = signals.episodeRatingStrength !== null ? `${signals.episodeRatingStrength}/100` : 'N/A';
      const malScore = signals.communityScore !== null ? `${signals.communityScore.toFixed(1)}/10` : 'N/A';
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);

      const { src, srcset, sizes, fallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'recommendation' });
      const safeCover = this.escapeAttr(src || this.sanitizeImageUrl(anime.cover));
      const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
      const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
      const recFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: fallback,
        placeholder: IMAGE_PLACEHOLDER
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
              <span>Episode Rating Strength ${retention}</span><span>${this.escapeHtml(signals.evidenceLabel)}</span>
              <span>Community Score (MAL) ${malScore}</span>
            </div>
            <div class="recommendation-reason">${this.escapeHtml(anime.reason || '')}</div>
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

    const wantsPartial = Number.isFinite(requiredCount) && requiredCount > 0;
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
    if (this.gridSortHandle) return;
    const sortKey = this.currentSort;
    const source = this.filteredData;
    this.gridSortHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
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
      this.getRuntimeCapabilities().cancelIdleTask(this.gridSortHandle);
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
    return this.getImageProxyRuntime().getLoading(index, { eagerCount, priorityCount });
  },

  initCardTemplate() {
    if (this.animeCardTemplate || typeof document === 'undefined') return;
    const cardDims = this.getImageProxyRuntime().getDimensions('card');
    const cardDimAttrs = cardDims ? `width="${cardDims.width}" height="${cardDims.height}"` : '';
    const template = document.createElement('template');
    setHTML(template, `
      <div class="anime-card" data-action="open-anime" role="button" tabindex="0" aria-label="View details">
        <div class="card-media">
          <img class="card-cover" ${cardDimAttrs} loading="lazy" data-fallback-src="${IMAGE_PLACEHOLDER}">
        </div>
        <div class="card-body">
          <div class="card-heading">
            <div class="card-title-row">
              <h3 class="card-title"></h3>
            </div>
            <div class="card-alt-title"></div>
            <div class="card-year"></div>
          </div>
          <div class="card-score-wrap">
          <div class="card-scoreboard">
          <div class="card-primary-signal">
            <div class="card-primary-score">
              <span class="card-primary-value"></span>
              <span class="card-primary-label"></span>
            </div>
            <span class="card-primary-note"></span>
          </div>
          <div class="card-stats"></div>
          </div>
          </div>
          <div class="card-badges"></div>
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
    const decision = this.getCardDecisionData(anime);
    const cardStats = Recommendations.getCardStats(anime)
      .filter(stat => stat.label.toLowerCase() !== decision.label.toLowerCase());
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
      placeholder: IMAGE_PLACEHOLDER
    });

    const img = card.querySelector('.card-cover');
    const cardDims = this.getImageProxyRuntime().getDimensions('card');
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

    const altTitleEl = card.querySelector('.card-alt-title');
    if (altTitleEl) {
      altTitleEl.textContent = this.getDistinctEnglishTitle(anime);
    }

    const yearEl = card.querySelector('.card-year');
    if (yearEl) {
      setHTML(yearEl, `${safeYear} &bull; ${safeStudio}`);
    }

    const primarySignal = card.querySelector('.card-primary-signal');
    const primaryValue = card.querySelector('.card-primary-value');
    const primaryLabel = card.querySelector('.card-primary-label');
    const primaryNote = card.querySelector('.card-primary-note');
    if (primarySignal) {
      primarySignal.className = this.sanitizeClassList('card-primary-signal', decision.className);
    }
    if (primaryValue) {
      setHTML(primaryValue, this.renderCardScoreValue(decision.value));
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
            <span class="${statValueClass}">${safeValue}<small>${safeSuffix}</small></span>
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

  renderSettingsPanel({ includeTitle = true } = {}) {
    const settings = this.getSettings();
    const autoplayEnabled = Boolean(settings.trailerAutoplay);
    const dataSaverEnabled = Boolean(settings.dataSaver);
    const reducedMotionEnabled = Boolean(settings.reducedMotion);
    const highContrastEnabled = Boolean(settings.highContrast);
    const largeTextEnabled = Boolean(settings.largeText);
    const tasteProfile = this.getTasteProfileStore().getSettingsSummary();
    const renderChips = (values) => values.length > 0
      ? values.map(value => `<span class="taste-profile-chip">${this.escapeHtml(value)}</span>`).join('')
      : '<span class="taste-profile-empty">None yet</span>';
    const titleMarkup = includeTitle
      ? '<div class="filter-section-title">Viewing preferences</div>'
      : '';

    const themeSelector = ThemeManager.renderThemeSelector();
    const sidebarSelector = SidebarPreference.renderSelector();

    return `
      <div class="filter-section settings-section">
        ${titleMarkup}
        
        <!-- Theme Selection -->
        ${themeSelector}
        ${sidebarSelector}
        
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

        ${this.renderMalWatchlistImport()}

        <h3 class="filter-section-title filter-section-title--spaced" id="taste-profile-heading" tabindex="-1">Taste Profile</h3>
        <div class="taste-profile-panel">
          <p class="settings-description">Recommendation feedback and watchlist history stay editable here.</p>
          <div class="taste-profile-group">
            <span class="settings-title">Prefer more</span>
            <div class="taste-profile-chips">${renderChips(tasteProfile.preferredTags)}</div>
          </div>
          <div class="taste-profile-group">
            <span class="settings-title">Show less</span>
            <div class="taste-profile-chips">${renderChips(tasteProfile.reducedTags)}</div>
          </div>
          <div class="taste-profile-group">
            <span class="settings-title">Learned from watchlist</span>
            <div class="taste-profile-chips">${renderChips(tasteProfile.inferredTags)}</div>
          </div>
          <div class="taste-profile-actions">
            <button class="btn btn-outline btn-sm" type="button" data-action="reset-taste-profile">Reset profile</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="export-personal-data">Export backup</button>
            <button class="btn btn-outline btn-sm" type="button" data-action="restore-personal-data">Restore backup</button>
            <input class="visually-hidden" id="personal-data-restore" type="file" aria-label="Rekonime JSON backup" accept="application/json" data-action="personal-data-file">
          </div>
          <p class="settings-description" data-backup-status>No backup export recorded in this browser.</p>
          <p class="settings-description">Restore replaces the saved data included in your backup. MAL import merges progress separately.</p>
          <p class="settings-description">${this.escapeHtml(tasteProfile.hiddenCount)} hidden recommendation ${tasteProfile.hiddenCount === 1 ? 'title' : 'titles'}.</p>
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
    const label = document.getElementById('active-filters-label');
    const clearBtn = document.getElementById('active-filters-clear');
    if (!container || !list || !label || !clearBtn) return;

    const active = BrowseFiltering.buildActiveFilterItems({
      activeFilters: this.activeFilters,
      searchQuery: this.getCatalogSearchQuery(),
      filterTypeLabels: this.filterTypeLabels
    });
    this.syncDiscoveryGardenVisibility();

    if (active.length === 0) {
      list.replaceChildren();
      label.textContent = 'Showing';
      clearBtn.classList.add('is-hidden');
      container.classList.add('is-empty');
      return;
    }

    container.classList.remove('is-empty');
    const matchCount = Array.isArray(this.filteredData) ? this.filteredData.length : 0;
    label.textContent = `${matchCount.toLocaleString('en-US')} ${matchCount === 1 ? 'match' : 'matches'}`;
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

  renderCardScoreValue(value) {
    const match = String(value).match(/^(\d+(?:\.\d+)?)\/(\d+)$/);
    const [, score, scale] = match || ['', String(value), ''];
    return `${this.escapeHtml(score)}${scale ? `<small>/${this.escapeHtml(scale)}</small>` : ''}`;
  },

  getCardDecisionData(anime) {
    return getRatingSignals(anime).headline;
  },

  /**
   * Render recommendations section
   */
  renderChosenTitle(grid, chosen) {
    let panel = document.getElementById('chosen-title');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'chosen-title';
      panel.className = 'chosen-title';
      panel.setAttribute('aria-label', 'Your chosen title');
      grid.before(panel);
    }
    const selection = chosen;
    panel.hidden = !selection;
    if (!selection) { setHTML(panel, ''); return; }
    const title = this.escapeHtml(selection.title);
    setHTML(panel, `
      <p class="chosen-title-confirmation">${selection.status === 'planned' ? 'Saved to Want to watch' : 'Saved in your Watchlist'}</p>
      <button class="recommendation-title" type="button" data-action="open-anime" data-anime-id="${this.escapeAttr(selection.id)}" aria-label="View details for ${this.escapeAttr(selection.title)}">${title}</button>
      <div class="chosen-title-actions">
        <button class="btn btn-secondary btn-sm" type="button" data-action="undo-recommendation-selection" aria-label="Undo saving ${this.escapeAttr(selection.title)}">Undo</button>
        <a class="btn btn-primary btn-sm" href="/watchlist.html">View watchlist</a>
      </div>
    `);
  },

  // Discovery Shortlist actions. The shortlist records its decision context (such as the
  // chosen title) after the Watchlist change returns, so redraw once the action completes.
  // A failed Watchlist save leaves the page as it was so focus stays on the control.
  runShortlistAction(action, animeId) {
    const shortlist = this.getDiscoveryShortlist();
    const commands = {
      'quick-save-recommendation': () => shortlist.save(animeId),
      'undo-recommendation-selection': () => shortlist.undoSave(),
      'skip-recommendation': () => shortlist.skip(animeId),
      'restore-session-dismissal': () => shortlist.restore(animeId),
      'more-recommendations': () => shortlist.showMore()
    };
    const command = commands[action];
    if (!command) return null;
    const outcome = command();
    if (outcome?.changed || ['skip-recommendation', 'restore-session-dismissal'].includes(action)) this.renderRecommendations();
    this.applyShortlistOutcome(outcome);
    return outcome;
  },

  renderSessionDismissals(grid, dismissed) {
    let panel = document.getElementById('session-dismissals');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'session-dismissals';
      panel.className = 'session-dismissals';
      panel.setAttribute('aria-label', 'Skipped recommendations');
      grid.before(panel);
    }
    panel.hidden = dismissed.length === 0;
    if (!dismissed.length) { setHTML(panel, ''); return; }
    const expanded = Boolean(panel.querySelector('details[open]'));
    const latest = dismissed[dismissed.length - 1];
    setHTML(panel, `
      <p>Skipped for now: ${this.escapeHtml(latest.title)}
        <button class="btn btn-secondary btn-sm" type="button" data-action="restore-session-dismissal" data-anime-id="${this.escapeAttr(latest.id)}" aria-label="Undo skip ${this.escapeAttr(latest.title)}">Undo</button>
      </p>
      <details ${expanded ? 'open' : ''}>
        <summary data-action="review-session-dismissals">Review skipped titles (${dismissed.length})</summary>
        <p>These skips apply to this tab's session. They expire after four hours without activity.</p>
        <ul>${dismissed.map(item => `<li><span>${this.escapeHtml(item.title)}</span> <button class="btn btn-secondary btn-sm" type="button" data-action="restore-session-dismissal" data-anime-id="${this.escapeAttr(item.id)}" aria-label="Restore ${this.escapeAttr(item.title)}">Restore</button></li>`).join('')}</ul>
      </details>
    `);
  },

  // Romanized titles alone are hard to recognize; cards add the English title when it differs.
  getDistinctEnglishTitle(anime) {
    const englishTitle = typeof anime?.titleEnglish === 'string' ? anime.titleEnglish.trim() : '';
    return englishTitle && englishTitle.toLowerCase() !== String(anime?.title || '').trim().toLowerCase() ? englishTitle : '';
  },

  renderRecommendations() {
    const container = document.getElementById('recommendations-grid');
    if (!container) return;
    const model = this.getDiscoveryShortlist().getModel(this.filteredData);
    this.renderSessionDismissals(container, model.dismissed);
    this.renderChosenTitle(container, model.chosen);
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    const recDims = this.getImageProxyRuntime().getDimensions('recommendation');
    const recDimAttrs = recDims ? `width="${recDims.width}" height="${recDims.height}"` : '';

    const recommendations = model.items;
    const moreButton = document.getElementById('more-recommendations');
    if (moreButton) moreButton.hidden = !model.hasMore;
    const heading = document.getElementById('recommendations-heading');
    if (heading) heading.textContent = model.heading;
    const contextEl = document.getElementById('recommendations-context');
    if (contextEl && contextEl.textContent.trim() !== model.context) {
      contextEl.textContent = model.context;
    }


    if (recommendations.length === 0) {
      setHTML(container, '<p class="no-data">No recommendations available. Try changing your filters or browsing the catalog.</p>');
      document.getElementById('quick-filters')?.removeAttribute('inert');
      return;
    }

    // The fit label only earns its place when picks of different kinds share the
    // shelf; otherwise the section heading and subtitle already say it.
    const showFitLabel = new Set(recommendations.map(anime => anime.fitLabel)).size > 1;
    setHTML(container, recommendations.map((anime, index) => {
      const malSatisfaction = Number.isFinite(anime.communityScore) ? `${anime.communityScore.toFixed(1)}/10` : 'N/A';
      const satisfactionTooltipTitle = this.escapeHtml('Community Score (MAL)');
      const satisfactionTooltipText = this.escapeHtml('Community rating from MyAnimeList — overall quality and enjoyment.');
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeReason = this.escapeHtml(anime.fitReason || anime.reason || '');
      const safeYear = this.escapeHtml(anime.year || 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
      const safeAltTitle = this.escapeHtml(this.getDistinctEnglishTitle(anime));
      // Genres answer "what is this about?" before any rating does.
      const genreTags = [...(Array.isArray(anime.genres) ? anime.genres : []), ...(Array.isArray(anime.themes) ? anime.themes : [])]
        .filter((tag, tagIndex, tags) => typeof tag === 'string' && tag && !NON_GENRE_TAGS.has(tag) && tags.indexOf(tag) === tagIndex)
        .slice(0, 3)
        .map(tag => `<span class="recommendation-genre">${this.escapeHtml(tag)}</span>`)
        .join('');
      const decision = this.getCardDecisionData(anime);
      const decisionClass = this.sanitizeClassList('recommendation-signal', decision.className);
      const obiLabel = decision.kind === 'episode' ? 'Episode strength' : decision.kind === 'community' ? 'MAL score' : '';
      const [obiScore, obiScale] = String(decision.value).split('/');
      const obiScaleMarkup = obiScale ? `<small>/${this.escapeHtml(obiScale)}</small>` : '';
      const obiMarkup = obiLabel
        ? `<span class="recommendation-obi-label" aria-hidden="true">${obiLabel}</span><span class="recommendation-obi-score" aria-hidden="true">${this.escapeHtml(obiScore)}${obiScaleMarkup}</span>`
        : '';
      const labelTitle = anime.title || 'this anime';
      const labelYear = anime.year ? `, ${anime.year}` : '';
      const cardLabel = this.escapeAttr(`View details for ${labelTitle}${labelYear}`);
      const lessGenre = Array.isArray(anime.genres) && anime.genres[0] ? anime.genres[0] : '';
      const lessTheme = !lessGenre && Array.isArray(anime.themes) && anime.themes[0] ? anime.themes[0] : '';
      const lessLabel = lessGenre || lessTheme;

      const { src: recSrc, srcset: recSrcset, sizes: recSizes, fallback: recFallback } = this.buildImageSrcset(anime.cover, { sizeKey: 'recommendation' });
      const safeRecCover = this.escapeAttr(recSrc || this.sanitizeImageUrl(anime.cover));
      const recSrcsetAttr = recSrcset ? `srcset="${this.escapeAttr(recSrcset)}"` : '';
      const recSizesAttr = recSizes ? `sizes="${this.escapeAttr(recSizes)}"` : '';
      const recFallbackAttrs = this.getImageFallbackAttrs({
        fallbackSrc: recFallback,
        placeholder: IMAGE_PLACEHOLDER
      });
      const loadAttrs = this.getImageLoadingAttrs(index, { eagerCount: 2, priorityCount: 1 });
      const fetchPriorityAttr = loadAttrs.fetchpriority ? `fetchpriority="${loadAttrs.fetchpriority}"` : '';
      return `
        <div class="recommendation-card" data-action="open-anime" data-anime-id="${safeId}" role="group" tabindex="-1" aria-label="${safeTitle}">
          <div class="recommendation-media">
            ${obiMarkup ? `<span class="recommendation-obi">${obiMarkup}</span>` : ''}
            <img src="${safeRecCover}" ${recSrcsetAttr} ${recSizesAttr} alt="${safeTitle}" class="recommendation-cover" ${recDimAttrs} loading="${loadAttrs.loading}" decoding="${loadAttrs.decoding}" ${fetchPriorityAttr} ${recFallbackAttrs}>
          </div>
          <div class="recommendation-info">
            <button class="recommendation-title" type="button" data-action="open-anime" data-anime-id="${safeId}" aria-label="${cardLabel}">${safeTitle}</button>
            <div class="recommendation-alt-title">${safeAltTitle}</div>
            <div class="recommendation-submeta">${safeYear} &bull; ${safeStudio}</div>
            <div class="recommendation-genres">${genreTags}</div>
            ${showFitLabel ? `<div class="recommendation-fit-label">${this.escapeHtml(anime.fitLabel)}</div>` : ''}
            <div class="recommendation-reason">${safeReason}</div>
            <div class="recommendation-episodes">${this.escapeHtml(anime.episodeSummary)}</div>
              <div class="recommendation-quick-actions">
                <button class="btn btn-primary btn-sm" type="button" data-action="quick-save-recommendation" data-anime-id="${safeId}" aria-label="Want to watch ${this.escapeAttr(labelTitle)}">Want to watch</button>
                <button class="btn btn-secondary btn-sm" type="button" data-action="skip-recommendation" data-anime-id="${safeId}">Skip for now</button>
              </div>
            <div class="recommendation-more">
            <details class="recommendation-ratings" data-action="recommendation-ratings">
            <summary>Ratings and evidence</summary>
            <div class="recommendation-scoreboard">
            <div class="${decisionClass}">
              <div class="recommendation-primary-score">
                <span class="recommendation-signal-value">${this.renderCardScoreValue(decision.value)}</span>
                <span class="recommendation-signal-label">${this.escapeHtml(decision.label)}</span>
              </div>
              <span class="recommendation-signal-note">${this.escapeHtml(decision.note)}</span>
            </div>
            ${decision.kind === 'community' ? '' : `<div class="recommendation-meta">
              <span class="recommendation-stat has-tooltip" tabindex="0">
                <strong class="recommendation-community-value">${this.renderCardScoreValue(malSatisfaction)}</strong>
                <span class="recommendation-community-label">Community Score (MAL)</span>
                <div class="tooltip tooltip--bottom" role="tooltip">
                  <div class="tooltip-title">${satisfactionTooltipTitle}</div>
                  <div class="tooltip-text">${satisfactionTooltipText}</div>
                </div>
              </span>
              </div>`}
              </div>
              <p class="recommendation-rating-explanation">Episode Rating Strength (/100) is an episode-rating index adjusted for coverage and sample size, not a completion probability. Community Score (MAL, /10) is the audience rating from MyAnimeList.</p>
              </details>
              <div class="recommendation-taste-row">
              <details class="recommendation-taste" data-action="taste-preferences">
                <summary>Taste preferences</summary>
                <p class="recommendation-taste-note">These preferences stay saved. Not for me: Hide this title from future recommendations.</p>
                <div class="recommendation-feedback" aria-label="Tune recommendations for ${safeTitle}">
                <button class="rec-feedback-btn" type="button" data-action="rec-more-like" data-anime-id="${safeId}">More like this</button>
                <button class="rec-feedback-btn" type="button" data-action="rec-not-for-me" data-anime-id="${safeId}">Not for me</button>
                ${lessLabel ? `<button class="rec-feedback-btn" type="button" data-action="rec-less-tag" data-anime-id="${safeId}" data-genre="${this.escapeAttr(lessGenre)}" data-theme="${this.escapeAttr(lessTheme)}">Less ${this.escapeHtml(lessLabel)}</button>` : ''}
                </div>
              </details>
              <button class="rec-feedback-btn recommendation-seen-btn" type="button" data-action="rec-already-seen" data-anime-id="${safeId}">Already seen</button>
              </div>
            </div>
            </div>
        </div>
      `;
    }).join(''));
    document.getElementById('quick-filters')?.removeAttribute('inert');
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
    // Compare against what is on screen: a deferred first batch can render fewer
    // cards than the page requests, and the rest must stay reachable.
    const hasMore = endIndex < countForMore;

    if (!shouldAppend) {
      this.diffRenderAnimeGrid(container, visibleAnime, { startIndex });
    } else if (visibleAnime.length > 0) {
      const loadMoreEl = container.querySelector('.load-more-container');
      if (loadMoreEl) {
        loadMoreEl.remove();
      }
      container.appendChild(this.renderAnimeCardsDom(visibleAnime, { startIndex }));
    }

    if (!shouldAppend && visibleAnime.length > 0) {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('rekonime:catalog-content-rendered');
      }
      this.emitAppEvent('rekonime:catalog-content-rendered', {
        cards: visibleAnime.length,
        totalCount,
        status: document.documentElement?.dataset?.catalogStatus || ''
      });
    }

    this.gridRenderedCount = endIndex;
    if (!shouldAppend) {
      this.gridInitialBatchRendered = true;
    }

    if (shouldDeferInitialBatch && endIndex < targetEndIndex && !this.shouldDeferHeavyContent()) {
      if (this.gridDeferredRenderHandle) {
        this.getRuntimeCapabilities().cancelIdleTask(this.gridDeferredRenderHandle);
      }
      this.gridDeferredRenderHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
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
            Show more titles <span class="load-more-count">${Math.max(countForMore - endIndex, 0).toLocaleString('en-US')} left</span>
          </button>
        </div>
      `);
    }

    if (this.gridVirtualScrollHandle) {
      this.getRuntimeCapabilities().cancelIdleTask(this.gridVirtualScrollHandle);
    }
    this.gridVirtualScrollHandle = this.getRuntimeCapabilities().queueIdleTask(() => {
      this.gridVirtualScrollHandle = null;
      this.setupVirtualScrolling(container);
    }, { timeout: 1500 });
  },

  setupVirtualScrolling(container) {
    if (!this.virtualScrollingEnabled) return;
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
    // Finish the current page first when a deferred first batch left it short.
    if (this.gridRenderedCount >= this.gridCurrentPage * this.gridPageSize) {
      this.gridCurrentPage++;
    }
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
      this.getRuntimeCapabilities().cancelIdleTask(this.gridSortHandle);
      this.gridSortHandle = null;
    }
    if (this.gridDeferredRenderHandle) {
      this.getRuntimeCapabilities().cancelIdleTask(this.gridDeferredRenderHandle);
      this.gridDeferredRenderHandle = null;
    }
    if (this.gridVirtualScrollHandle) {
      this.getRuntimeCapabilities().cancelIdleTask(this.gridVirtualScrollHandle);
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
    if (metricKey === 'taste') {
      return this.getTasteProfileStore().prepareRecommendationSource(animeList).sort((a, b) =>
        b.tasteScore - a.tasteScore ||
        this.compareRankValues(
          Number.isFinite(a.stats?.retentionScore) ? a.stats.retentionScore : null,
          Number.isFinite(b.stats?.retentionScore) ? b.stats.retentionScore : null
        )
      );
    }
    const getValue = this.getRankValueGetter(metricKey);
    return [...animeList].sort((a, b) => this.compareRankValues(getValue(a), getValue(b)));
  },

  // Ranked views list titles without the ranked score after every scored title,
  // including scored titles whose value is genuinely 0.
  getRankValueGetter(metricKey) {
    return metricKey === 'satisfaction'
      ? (anime) => (Number.isFinite(anime?.communityScore) ? anime.communityScore : null)
      : (anime) => (Number.isFinite(anime?.stats?.retentionScore) ? anime.stats.retentionScore : null);
  },

  compareRankValues(aValue, bValue) {
    if (aValue === null || bValue === null) return (aValue === null ? 1 : 0) - (bValue === null ? 1 : 0);
    return bValue - aValue;
  },

  selectTopAnimeByMetric(animeList, metricKey, limit) {
    if (!Array.isArray(animeList) || animeList.length === 0) return [];
    const maxItems = Math.max(1, limit || 1);
    if (metricKey === 'taste') return this.sortAnimeByMetric(animeList, metricKey).slice(0, maxItems);
    const getValue = this.getRankValueGetter(metricKey);
    const byValue = (a, b) => this.compareRankValues(a.value, b.value);
    const top = [];

    for (let i = 0; i < animeList.length; i += 1) {
      const anime = animeList[i];
      const value = getValue(anime);

      if (top.length < maxItems) {
        top.push({ anime, value });
        if (top.length === maxItems) {
          top.sort(byValue);
        }
        continue;
      }

      if (this.compareRankValues(value, top[top.length - 1].value) >= 0) continue;
      top[top.length - 1] = { anime, value };
      top.sort(byValue);
    }

    // Fewer titles than the limit never reached the sort above.
    if (top.length < maxItems) top.sort(byValue);
    return top.map(entry => entry.anime);
  },

  /**
   * Handle card click
   */
  handleCardClick(animeId) {
    this.showAnimeDetail(animeId);
  },

  setupActionDelegates() {
    // Adapter at the DOM seam: find the action element and run its command from the table.
    this.addTrackedListener(document, 'click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      // The dedicated Watchlist page handles its own controls.
      if (actionEl.closest('[data-renderer="watchlist-page"]')) return;
      // Any delegated home action counts as activity for the Discovery session's sliding expiry.
      this.getDiscoveryShortlist().recordActivity();
      runHomeAction(this, actionEl, event);
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
      this.getImageProxyRuntime().handleImageError(event.target);
    }, true);
  },


  /**
   * Show anime detail modal
   */
  showAnimeDetail(animeId, options = {}) {
    return this.getDetailExperience().open(animeId, options);
  },

  /**
   * Close detail modal
   */
  closeDetailModal(options = {}) {
    return this.getDetailExperience().close(options);
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

  showToast(message, options = {}) {
    return showToastNotification(message, options);
  },

  dismissToast(toastId) {
    dismissToastNotification(toastId);
  },

  /**
   * Close metric help modal
   */
  closeMetricHelpModal() {
    this.getRuntimeCapabilities().setModalVisibility('metric-help-modal', false);
  },

  /**
   * Show recommendations help
   */
  showRecommendationsHelp() {
    const content = `
      <div class="recommendations-help">
        <h3>Why These Recommendations Stand Out</h3>
        <p>Rekonime starts with audience ratings, then considers your saved taste:</p>
        <div class="help-factor">
          <strong>Episode Rating Strength (/100)</strong>
          <p>A score out of 100 based on episode ratings, their pattern, and available coverage. Small samples are pulled toward the neutral midpoint. It is not a measured retention rate or a completion probability.</p>
        </div>
        <div class="help-factor">
          <strong>Community Score (MAL, /10)</strong>
          <p>Community sentiment from MyAnimeList that reflects how strongly viewers rated it.</p>
        </div>
        <div class="help-factor"><strong>Your taste</strong><p>Saved preferences and watchlist evidence adjust ranking. Each pick labels the reason used. Series continuations require completed entries in the catalog watch order, with one pick per known franchise.</p></div>
        <p class="help-note">Limited data means ratings are sparse, episode positions are unknown, or known vote counts are low. Unknown completion status and missing voter counts are shown in details.</p>
      </div>
    `;

    const body = document.getElementById('metric-help-body');
    const modal = document.getElementById('metric-help-modal');

    if (body && modal) {
      setHTML(body, content);
      this.getRuntimeCapabilities().setModalVisibility('metric-help-modal', true, {
        initialFocusSelector: '#close-metric-help'
      });
    }
  },

  /**
   * Apply a filter preset
   */
  applyFilterPreset(presetKey) {
    const preset = FilterPresets.get(presetKey);
    if (!preset) return;

    const filtered = FilterPresets.applyPreset(presetKey, this.animeData);
    this.filteredData = filtered;

    const sortKey = FilterPresets.getSortForPreset(presetKey);
    this.currentSort = sortKey;

    this.syncSortControls();

    this.resetGridPagination();
    this.render();

    const target = document.getElementById('catalog-section');
    if (target) {
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  },

  buildImageProxyUrl(coverUrl, { width, height } = {}) {
    return this.getImageProxyRuntime().resolveImage({ coverUrl, width, height }).optimized;
  },

  getImageFallbackSources({ fallbackSrc, placeholder }) {
    return this.getImageProxyRuntime().getFallbacks({ fallbackSrc, placeholder });
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
    return this.getImageProxyRuntime().resolveImage({ coverUrl, sizeKey, preferOptimized });
  }
};

export { App };


