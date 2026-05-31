// @ts-nocheck
import { ThemeManager } from './themeManager.js';
import { Logger } from './services/logger.ts';
import { initDeferredRuntimeServices, queueIdleTask } from './bootstrap/deferred-runtime.js';
import { createImageProxyRuntime } from './image-proxy-runtime.js';
import { sanitizeImageUrl as sanitizeSafeImageUrl } from './urlSanitizer.ts';
import {
  isProxyImageUrl,
  buildImageProxyUrl
} from './image-proxy.js';
import {
  normalizeWatchlistSnapshot as normalizeLifecycleWatchlistSnapshot,
  buildWatchlistDisplayModel,
  buildWatchlistTransitionEnvelope,
  createWatchlistLifecycle
} from './watchlist-state.js';
import {
  createWatchlistControlsElement,
  updateWatchlistControlsElement,
  getEpisodeCountFromItem as getPresentationEpisodeCountFromItem,
  getEpisodeCountFromCard as getPresentationEpisodeCountFromCard
} from './watchlist-entry-presentation.ts';
import { setHTML } from './security/trusted-types.js';
import './bootstrap/watchlist-cover-preload.js';
import './bootstrap/noncritical-styles.js';

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

let appInitPromise = null;
let currentWatchlistFilter = 'all';
let airingDashboardModulePromise = null;
let airingDashboardControllerPromise = null;
let airingDashboardUpdateHandle = null;
const imageProxyRuntime = createImageProxyRuntime({
  storageKey: IMAGE_PROXY_STATUS_KEY,
  ttlMs: IMAGE_PROXY_STATUS_TTL_MS,
  timeoutMs: IMAGE_PROXY_CHECK_TIMEOUT_MS,
  queueTask: (callback, options = {}) => queueIdleTask(callback, options.timeout ?? 2000),
  waitForLoad: false
});

const getWatchlistLifecycle = () => createWatchlistLifecycle({
  placeholderCover: PLACEHOLDER_COVER
});

const initNonCriticalServices = () => {
  initDeferredRuntimeServices({
    timeoutMs: 2000,
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
  imageProxyRuntime.scheduleCheck({ timeout: 2000 });
};

const shouldUseImageProxy = () => {
  return imageProxyRuntime.shouldUseProxy();
};

const markImageProxyFailed = () => {
  imageProxyRuntime.markFailed();
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

const buildProxyUrl = (coverUrl) => {
  if (!shouldUseImageProxy()) return '';
  return buildImageProxyUrl(coverUrl, {
    sanitizeImageUrl,
    width: CARD_DIMENSIONS.width,
    height: CARD_DIMENSIONS.height,
    fit: 'cover',
    output: 'webp'
  });
};

const normalizeWatchlistSnapshot = (item, fallbackId = '') => {
  return normalizeLifecycleWatchlistSnapshot(item, {
    fallbackId,
    placeholderCover: PLACEHOLDER_COVER,
    requireCover: false
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

const setWatchStatus = (animeId, status, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const lifecycle = getWatchlistLifecycle();
  lifecycle.load();
  const current = lifecycle.getEntry(key);
  const result = lifecycle.setStatus(key, status, {
    episodeCount,
    snapshot: current?.snapshot || null
  });
  return buildWatchlistTransitionEnvelope(result);
};

const setWatchProgress = (animeId, progress, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const lifecycle = getWatchlistLifecycle();
  lifecycle.load();
  const current = lifecycle.getEntry(key);
  const result = lifecycle.setProgress(key, progress, {
    episodeCount,
    snapshot: current?.snapshot || null
  });
  return buildWatchlistTransitionEnvelope(result, { renderMode: 'controls' });
};

const adjustWatchProgress = (animeId, delta, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const lifecycle = getWatchlistLifecycle();
  lifecycle.load();
  const current = lifecycle.getEntry(key);
  const result = lifecycle.adjustProgress(key, delta, {
    episodeCount,
    snapshot: current?.snapshot || null
  });
  return buildWatchlistTransitionEnvelope(result, { renderMode: 'controls' });
};

const getEpisodeCountFromItem = (item) => getPresentationEpisodeCountFromItem(item);

const getEpisodeCountFromCard = (card) => getPresentationEpisodeCountFromCard(card);

const buildWatchlistControls = (item, entry) => createWatchlistControlsElement(item, entry);

const updateWatchlistUi = (card, entry) => {
  if (!card) return;
  updateWatchlistControlsElement(card, entry, {
    episodeCount: getEpisodeCountFromCard(card)
  });
};

const applyWatchlistTransition = (card, transition) => {
  if (!transition?.changed) return;
  if (transition.render?.controls?.shouldUpdate) {
    updateWatchlistUi(card, transition.render.controls.entry);
  }
  if (transition.render?.watchlist?.shouldRender) {
    renderWatchlist();
  }
};

const renderWatchlistFilters = (counts) => {
  const container = document.getElementById('watchlist-filter-chips');
  if (!container) return;
  const filters = [
    { key: 'all', label: 'All titles' },
    { key: 'planned', label: 'Want to watch' },
    { key: 'watching', label: 'Watching now' },
    { key: 'completed', label: 'Finished' },
    { key: 'dropped', label: 'Stopped' }
  ];

  setHTML(container, filters.map((filter) => {
    const isActive = currentWatchlistFilter === filter.key;
    const count = Number.isFinite(counts[filter.key]) ? counts[filter.key] : 0;
    return `
      <button class="watchlist-filter-chip ${isActive ? 'is-active' : ''}" type="button"
        data-filter="${filter.key}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">
        <span class="chip-label">${filter.label}</span>
        <span class="chip-count">${count}</span>
      </button>
    `;
  }).join(''));
};

const getDisplayItemForEntry = (entry) => {
  return buildWatchlistDisplayModel([entry], [], { placeholder: PLACEHOLDER_COVER }).displayItems[0];
};

const buildCard = (item, index, watchEntry) => {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.setAttribute('data-action', 'open-anime');
  card.setAttribute('data-anime-id', item.id);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View details for ${item.title}`);

  const media = document.createElement('div');
  media.className = 'card-media';

  const img = document.createElement('img');
  img.className = 'card-cover';
  img.alt = item.title;
  img.width = CARD_DIMENSIONS.width;
  img.height = CARD_DIMENSIONS.height;
  const proxyUrl = buildProxyUrl(item.cover);
  const fallbackSrc = sanitizeImageUrl(item.cover);
  img.src = proxyUrl || fallbackSrc || PLACEHOLDER_COVER;
  if (fallbackSrc && proxyUrl) {
    img.dataset.fallbackSrc = fallbackSrc;
    img.dataset.fallbackSecondary = PLACEHOLDER_COVER;
  } else {
    img.dataset.fallbackSrc = PLACEHOLDER_COVER;
  }
  const eager = index < 2;
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.setAttribute('fetchpriority', index === 0 ? 'high' : (eager ? 'auto' : 'low'));

  media.appendChild(img);
  card.appendChild(media);

  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title;
  const meta = document.createElement('div');
  meta.className = 'card-year';
  const year = item.year ? String(item.year) : 'Unknown';
  const studio = item.studio || 'Unknown';
  meta.textContent = `${year} • ${studio}`;
  body.appendChild(title);
  body.appendChild(meta);

  const episodeCount = getEpisodeCountFromItem(item);
  if (episodeCount) {
    card.dataset.episodeCount = String(episodeCount);
  }
  body.appendChild(buildWatchlistControls(item, watchEntry));

  card.appendChild(body);
  return card;
};

const ensureWatchlistSnapshots = (map, version) => {
  let changed = false;
  map.forEach((entry, id) => {
    if (entry?.snapshot) return;
    const fallback = getDisplayItemForEntry(entry);
    if (!fallback || !fallback.id) return;
    entry.snapshot = { ...fallback };
    map.set(id, entry);
    changed = true;
  });

  if (changed) {
    saveWatchlistMap(map, version);
  }
};

const loadAiringDashboardFactory = async () => {
  if (airingDashboardModulePromise) return airingDashboardModulePromise;
  airingDashboardModulePromise = import('./airing-dashboard.ts')
    .then((module) => module.createAiringDashboardController)
    .catch((error) => {
      airingDashboardModulePromise = null;
      throw error;
    });
  return airingDashboardModulePromise;
};

const getAiringDashboardController = async () => {
  if (airingDashboardControllerPromise) return airingDashboardControllerPromise;
  airingDashboardControllerPromise = loadAiringDashboardFactory()
    .then((createAiringDashboardController) => createAiringDashboardController({
      sectionId: 'airing-dashboard-section',
      subtitleId: 'airing-dashboard-subtitle',
      summaryId: 'airing-dashboard-summary',
      gridId: 'airing-dashboard-grid',
      emptyId: 'airing-dashboard-empty',
      hideWhenNoEntries: true
    }))
    .catch((error) => {
      airingDashboardControllerPromise = null;
      throw error;
    });
  return airingDashboardControllerPromise;
};

const scheduleAiringDashboardUpdate = (entries, animeItems, { timeout = 2500 } = {}) => {
  if (airingDashboardUpdateHandle) {
    if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof airingDashboardUpdateHandle === 'number') {
      window.cancelIdleCallback(airingDashboardUpdateHandle);
    } else {
      clearTimeout(airingDashboardUpdateHandle);
    }
    airingDashboardUpdateHandle = null;
  }

  airingDashboardUpdateHandle = queueIdleTask(async () => {
    airingDashboardUpdateHandle = null;
    try {
      const controller = await getAiringDashboardController();
      await controller.update({ entries, animeItems });
    } catch (error) {
      Logger?.warn?.('Failed to update airing dashboard', { error });
    }
  }, timeout);
};

const renderWatchlist = () => {
  const section = document.getElementById('watchlist-section');
  const grid = document.getElementById('watchlist-grid');
  const empty = document.getElementById('watchlist-empty');
  if (!section || !grid || !empty) return;

  migrateLegacyBookmarksToWatchlist();
  const { map: watchlistMap, entries, version } = getWatchlistState();

  if (!entries.length) {
    section.classList.add('is-empty');
    grid.replaceChildren();
    scheduleAiringDashboardUpdate([], [], { timeout: 1200 });
    return;
  }

  section.classList.remove('is-empty');
  ensureWatchlistSnapshots(watchlistMap, version);
  const model = buildWatchlistDisplayModel(entries, [], {
    statusFilter: currentWatchlistFilter,
    placeholder: PLACEHOLDER_COVER
  });
  renderWatchlistFilters(model.counts);
  const dashboardItems = model.allDisplayItems;
  scheduleAiringDashboardUpdate(entries, dashboardItems, { timeout: 1800 });
  const fragment = document.createDocumentFragment();
  model.visibleEntries.forEach((entry, index) => {
    const item = model.displayItems[index];
    fragment.appendChild(buildCard(item, index, entry));
  });
  grid.replaceChildren(fragment);
};

const handleWatchlistChange = (target) => {
  if (!target || !target.dataset) return false;
  const action = target.dataset.action;
  if (!action) return false;
  const card = target.closest?.('.anime-card');
  if (!card) return true;
  const animeId = String(target.dataset.animeId || card.dataset.animeId || '').trim();
  if (!animeId) return true;
  const episodeCount = getEpisodeCountFromCard(card);

  if (action === 'watch-status') {
    const transition = setWatchStatus(animeId, target.value, episodeCount);
    applyWatchlistTransition(card, transition);
    return true;
  }

  if (action === 'watch-progress') {
    const transition = setWatchProgress(animeId, target.value, episodeCount);
    applyWatchlistTransition(card, transition);
    return true;
  }

  return false;
};

const handleWatchlistClick = (target) => {
  const wrapper = target.closest?.('.watchlist-controls');
  if (!wrapper) return false;
  const actionEl = target.closest?.('[data-action]');
  if (!actionEl) return true;
  const action = actionEl.dataset.action;
  if (!action) return true;

  const card = target.closest?.('.anime-card');
  if (!card) return true;
  const animeId = String(actionEl.dataset.animeId || card.dataset.animeId || '').trim();
  if (!animeId) return true;
  const episodeCount = getEpisodeCountFromCard(card);

  if (action === 'watch-progress-inc') {
    const transition = adjustWatchProgress(animeId, 1, episodeCount);
    applyWatchlistTransition(card, transition);
    return true;
  }

  if (action === 'watch-progress-dec') {
    const transition = adjustWatchProgress(animeId, -1, episodeCount);
    applyWatchlistTransition(card, transition);
    return true;
  }

  return true;
};

const handleCardOpen = async (target) => {
  const card = target.closest?.('.anime-card, .airing-card');
  if (!card) return false;
  const animeId = String(card.dataset.animeId || '').trim();
  if (!animeId) return true;
  const app = await loadFullApp();
  app.showAnimeDetail(animeId);
  return true;
};

const attachCardHandlers = (grid, { includeControls = false } = {}) => {
  if (!grid) return;

  grid.addEventListener('click', async (event) => {
    if (includeControls && handleWatchlistClick(event.target)) return;
    await handleCardOpen(event.target);
  });

  if (includeControls) {
    grid.addEventListener('change', (event) => {
      if (handleWatchlistChange(event.target)) return;
    });
  }

  grid.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const isFormControl = event.target?.matches?.('input, select, textarea, button');
    if (isFormControl || event.target?.closest?.('.watchlist-controls')) return;
    const card = event.target.closest?.('.anime-card, .airing-card');
    if (!card) return;
    event.preventDefault();
    const app = await loadFullApp();
    app.showAnimeDetail(String(card.dataset.animeId || '').trim());
  });

  grid.addEventListener('error', (event) => {
    const img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    if (isProxyImageUrl(img.currentSrc || img.src)) {
      markImageProxyFailed();
    }
    if (img.dataset.fallbackApplied) return;
    const fallback = img.dataset.fallbackSrc;
    if (!fallback) return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallback;
  }, true);
};

const setupGridHandlers = () => {
  attachCardHandlers(document.getElementById('watchlist-grid'), { includeControls: true });
  attachCardHandlers(document.getElementById('airing-dashboard-grid'));
};

const setupFilterHandlers = () => {
  const chips = document.getElementById('watchlist-filter-chips');
  if (!chips) return;
  chips.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-filter]');
    if (!button) return;
    const next = String(button.dataset.filter || '').trim();
    if (!next || next === currentWatchlistFilter) return;
    currentWatchlistFilter = next;
    renderWatchlist();
  });
};

const setupSettingsHandler = () => {
  const settingsToggle = document.getElementById('settings-toggle');
  if (!settingsToggle) return;
  settingsToggle.addEventListener('click', async () => {
    const app = await loadFullApp();
    app.toggleSettingsModal();
  });
};

const setupWatchlistSync = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('rekonime:watchlist-updated', () => {
    renderWatchlist();
  });
};

const bootstrap = () => {
  Logger.init({ level: 'info', captureGlobalErrors: true });
  ThemeManager.init();
  initNonCriticalServices();
  scheduleImageProxyCheck();

  renderWatchlist();
  setupGridHandlers();
  setupFilterHandlers();
  setupSettingsHandler();
  setupWatchlistSync();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
