import { ThemeManager } from './themeManager.js';
import { Logger } from './services/logger.js';
import { initDeferredRuntimeServices, queueIdleTask } from './bootstrap/deferred-runtime.js';
import { createImageProxyRuntime } from './image-proxy-runtime.js';
import { sanitizeImageUrl as sanitizeSafeImageUrl } from './urlSanitizer.js';
import {
  isProxyImageUrl,
  buildImageProxyUrl
} from './image-proxy.js';
import {
  WATCH_STATUS_VALUES,
  normalizeWatchStatus,
  normalizeWatchProgress
} from './watchlist-state.js';
import { setHTML } from './security/trusted-types.js';
import './bootstrap/watchlist-cover-preload.js';
import './bootstrap/noncritical-styles.js';

const LEGACY_WATCHLIST_STORAGE_KEY = 'rekonime.bookmarks';
const WATCHLIST_STORAGE_KEY = 'rekonime.watchlist';
const PLACEHOLDER_COVER = 'https://via.placeholder.com/120x170?text=No+Image';
const CARD_DIMENSIONS = { width: 240, height: 360 };
const ALLOWED_IMAGE_HOSTS = [
  'cdn.myanimelist.net',
  'myanimelist.cdn-dena.com',
  'via.placeholder.com',
  'images.weserv.nl'
];
const WATCH_STATUS_OPTIONS = [
  { value: '', label: 'Not tracking' },
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' }
];
const IMAGE_PROXY_STATUS_KEY = 'rekonime.imageProxyStatus';
const IMAGE_PROXY_STATUS_TTL_MS = 6 * 60 * 60 * 1000;
const IMAGE_PROXY_CHECK_TIMEOUT_MS = 2500;

let appInitPromise = null;
let currentWatchlistFilter = 'all';
const imageProxyRuntime = createImageProxyRuntime({
  storageKey: IMAGE_PROXY_STATUS_KEY,
  ttlMs: IMAGE_PROXY_STATUS_TTL_MS,
  timeoutMs: IMAGE_PROXY_CHECK_TIMEOUT_MS,
  queueTask: (callback, options = {}) => queueIdleTask(callback, options.timeout ?? 2000),
  waitForLoad: false
});

const initNonCriticalServices = () => {
  initDeferredRuntimeServices({
    timeoutMs: 2000,
    loadModules: async () => Promise.all([
        import('./serviceWorker.js'),
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
  appInitPromise = import('./app.js')
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

const parseLegacyWatchlist = () => {
  if (typeof window === 'undefined') return { ids: [], items: [] };
  try {
    const raw = localStorage.getItem(LEGACY_WATCHLIST_STORAGE_KEY);
    if (!raw) return { ids: [], items: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { ids: parsed.map(String), items: [] };
    }
    if (parsed && typeof parsed === 'object') {
      const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : [];
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return { ids, items };
    }
  } catch (error) {
    Logger?.warn?.('Failed to parse legacy watchlist', { error });
  }
  return { ids: [], items: [] };
};

const parseWatchlist = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const version = Number.isInteger(parsed.version) ? parsed.version : 1;
    const updatedAt = Number(parsed.updatedAt) || 0;
    return { version, updatedAt, entries };
  } catch (error) {
    return null;
  }
};

const shouldShowWatchProgress = (status) => {
  return status === 'watching' || status === 'completed' || status === 'dropped';
};

const normalizeWatchlistSnapshot = (item, fallbackId = '') => {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || fallbackId || '').trim();
  if (!id) return null;
  const title = String(item.title || '').trim() || 'Unknown title';
  const cover = String(item.cover || '').trim() || PLACEHOLDER_COVER;
  return {
    id,
    title,
    year: item.year || null,
    studio: item.studio || '',
    cover,
    stats: item.stats || item.statsSnapshot || null,
    communityScore: Number.isFinite(item.communityScore) ? item.communityScore : null,
    genres: Array.isArray(item.genres) ? [...item.genres] : [],
    themes: Array.isArray(item.themes) ? [...item.themes] : []
  };
};

const buildWatchlistEntry = ({ id, status, progress, updatedAt, startedAt, completedAt, snapshot } = {}) => {
  const key = String(id || '').trim();
  if (!key) return null;
  const now = Date.now();
  const entry = {
    id: key,
    status: normalizeWatchStatus(status),
    progress: normalizeWatchProgress(progress),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now
  };

  if (Number.isFinite(startedAt) && startedAt > 0) {
    entry.startedAt = Math.floor(startedAt);
  }
  if (Number.isFinite(completedAt) && completedAt > 0) {
    entry.completedAt = Math.floor(completedAt);
  }

  const normalizedSnapshot = normalizeWatchlistSnapshot(snapshot, key);
  if (normalizedSnapshot) {
    entry.snapshot = normalizedSnapshot;
  }

  return entry;
};

const getWatchlistState = () => {
  const data = parseWatchlist();
  const map = new Map();
  const ordered = [];
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  entries.forEach((entry) => {
    const normalized = buildWatchlistEntry(entry);
    if (!normalized || map.has(normalized.id)) return;
    map.set(normalized.id, normalized);
    ordered.push(normalized);
  });
  return { map, entries: ordered, version: data?.version || 1 };
};

const saveWatchlistMap = (map, version = 1) => {
  const entries = [...map.values()];
  const payload = {
    version,
    updatedAt: Date.now(),
    entries
  };
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage errors
  }
};

const migrateLegacyBookmarksToWatchlist = () => {
  const legacy = parseLegacyWatchlist();
  if (!legacy) return;
  const hasLegacyData = legacy.ids.length > 0 || legacy.items.length > 0;
  if (!hasLegacyData) return;

  const { map, version } = getWatchlistState();
  const snapshotMap = new Map();
  legacy.items.forEach((item) => {
    const normalized = normalizeWatchlistSnapshot(item);
    if (!normalized || snapshotMap.has(normalized.id)) return;
    snapshotMap.set(normalized.id, normalized);
  });

  let changed = false;

  const legacyIds = legacy.ids.length > 0 ? legacy.ids : [...snapshotMap.keys()];
  legacyIds.forEach((id) => {
    const key = String(id || '').trim();
    if (!key) return;
    const snapshot = snapshotMap.get(key) || null;
    if (map.has(key)) {
      const existing = map.get(key);
      if (existing && !existing.snapshot && snapshot) {
        existing.snapshot = snapshot;
        map.set(key, existing);
        changed = true;
      }
      return;
    }
    const entry = buildWatchlistEntry({ id: key, status: 'planned', progress: 0, snapshot });
    if (!entry) return;
    map.set(key, entry);
    changed = true;
  });

  snapshotMap.forEach((snapshot, id) => {
    if (!map.has(id)) {
      const entry = buildWatchlistEntry({ id, status: 'planned', progress: 0, snapshot });
      if (entry) {
        map.set(id, entry);
        changed = true;
      }
      return;
    }
    const existing = map.get(id);
    if (existing && !existing.snapshot) {
      existing.snapshot = snapshot;
      map.set(id, existing);
      changed = true;
    }
  });

  if (changed) {
    saveWatchlistMap(map, version);
  }

  try {
    localStorage.removeItem(LEGACY_WATCHLIST_STORAGE_KEY);
  } catch (error) {
    // Ignore storage errors
  }
};

const setWatchStatus = (animeId, status, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const { map, version } = getWatchlistState();
  const now = Date.now();
  if (!status) {
    map.delete(key);
    saveWatchlistMap(map, version);
    return null;
  }

  const nextStatus = normalizeWatchStatus(status);
  const current = map.get(key);
  const snapshot = current?.snapshot || null;
  let entry = buildWatchlistEntry({
    id: key,
    status: nextStatus,
    progress: current?.progress || 0,
    updatedAt: now,
    startedAt: current?.startedAt,
    completedAt: current?.completedAt,
    snapshot
  });

  if (!entry) return null;

  if (nextStatus === 'planned') {
    entry.progress = 0;
    delete entry.startedAt;
    delete entry.completedAt;
  } else {
    if (!entry.startedAt) entry.startedAt = now;
    if (nextStatus === 'completed') {
      entry.completedAt = now;
      if (Number.isFinite(episodeCount) && episodeCount > 0) {
        entry.progress = Math.max(entry.progress, episodeCount);
      }
    } else {
      delete entry.completedAt;
    }
  }

  map.set(key, entry);
  saveWatchlistMap(map, version);
  return entry;
};

const setWatchProgress = (animeId, progress, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const { map, version } = getWatchlistState();
  const now = Date.now();
  const normalized = normalizeWatchProgress(progress);
  const maxEpisodes = Number.isFinite(episodeCount) && episodeCount > 0 ? episodeCount : null;
  const clamped = maxEpisodes ? Math.min(normalized, maxEpisodes) : normalized;

  let entry = map.get(key);
  if (!entry) {
    entry = buildWatchlistEntry({
      id: key,
      status: 'watching',
      progress: clamped,
      updatedAt: now,
      startedAt: now
    });
  } else {
    entry = { ...entry, progress: clamped, updatedAt: now };
    if (entry.status === 'planned' && clamped > 0) {
      entry.status = 'watching';
      entry.startedAt = entry.startedAt || now;
    }
  }

  if (entry.status === 'completed' && maxEpisodes && clamped >= maxEpisodes) {
    entry.completedAt = entry.completedAt || now;
  }

  map.set(key, entry);
  saveWatchlistMap(map, version);
  return entry;
};

const adjustWatchProgress = (animeId, delta, episodeCount) => {
  const key = String(animeId || '').trim();
  if (!key) return null;
  const { map } = getWatchlistState();
  const entry = map.get(key);
  const current = Number.isFinite(entry?.progress) ? entry.progress : 0;
  return setWatchProgress(key, current + (Number(delta) || 0), episodeCount);
};

const getEpisodeCountFromItem = (item) => {
  const raw = item?.stats?.episodeCount;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const getEpisodeCountFromCard = (card) => {
  if (!card) return null;
  const parsed = Number(card.dataset.episodeCount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const buildWatchlistControls = (item, entry) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'watchlist-controls';
  wrapper.setAttribute('data-watchlist', 'true');

  const label = document.createElement('div');
  label.className = 'watchlist-controls-label';
  label.textContent = 'Watch status';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.className = 'watchlist-controls-select';
  select.setAttribute('data-action', 'watch-status');
  select.setAttribute('data-anime-id', item.id);

  const status = entry?.status || '';
  WATCH_STATUS_OPTIONS.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === status) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
  wrapper.appendChild(select);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'watchlist-controls-progress';
  if (!shouldShowWatchProgress(status)) {
    progressWrap.classList.add('is-hidden');
  }

  const progressLabel = document.createElement('span');
  progressLabel.className = 'watchlist-controls-progress-label';
  progressLabel.textContent = 'Episode';
  progressWrap.appendChild(progressLabel);

  const stepper = document.createElement('div');
  stepper.className = 'watchlist-controls-stepper';

  const dec = document.createElement('button');
  dec.type = 'button';
  dec.className = 'watchlist-controls-stepper-btn';
  dec.setAttribute('data-action', 'watch-progress-dec');
  dec.setAttribute('data-anime-id', item.id);
  dec.setAttribute('aria-label', 'Decrease episode');
  dec.textContent = '−';

  const input = document.createElement('input');
  input.className = 'watchlist-controls-input';
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.setAttribute('data-action', 'watch-progress');
  input.setAttribute('data-anime-id', item.id);
  input.setAttribute('inputmode', 'numeric');
  input.setAttribute('aria-label', 'Episode progress');
  input.value = String(Number.isFinite(entry?.progress) ? entry.progress : 0);

  const total = document.createElement('span');
  total.className = 'watchlist-controls-total';

  const episodeCount = getEpisodeCountFromItem(item);
  if (episodeCount) {
    input.max = String(episodeCount);
    total.textContent = `of ${episodeCount}`;
  }

  const inc = document.createElement('button');
  inc.type = 'button';
  inc.className = 'watchlist-controls-stepper-btn';
  inc.setAttribute('data-action', 'watch-progress-inc');
  inc.setAttribute('data-anime-id', item.id);
  inc.setAttribute('aria-label', 'Increase episode');
  inc.textContent = '+';

  stepper.appendChild(dec);
  stepper.appendChild(input);
  stepper.appendChild(total);
  stepper.appendChild(inc);
  progressWrap.appendChild(stepper);
  wrapper.appendChild(progressWrap);

  return wrapper;
};

const updateWatchlistUi = (card, entry) => {
  if (!card) return;
  const select = card.querySelector('.watchlist-controls-select');
  const progressWrap = card.querySelector('.watchlist-controls-progress');
  const input = card.querySelector('.watchlist-controls-input');
  const total = card.querySelector('.watchlist-controls-total');
  if (!select || !progressWrap || !input || !total) return;

  const status = entry?.status || '';
  select.value = status;

  const showProgress = shouldShowWatchProgress(status);
  progressWrap.classList.toggle('is-hidden', !showProgress);

  const progressValue = Number.isFinite(entry?.progress) ? entry.progress : 0;
  input.value = String(progressValue);

  const episodeCount = getEpisodeCountFromCard(card);
  if (episodeCount) {
    input.max = String(episodeCount);
    total.textContent = `of ${episodeCount}`;
  } else {
    input.removeAttribute('max');
    total.textContent = '';
  }
};

const getWatchlistStatus = (entry) => {
  const status = String(entry?.status || '').trim().toLowerCase();
  if (WATCH_STATUS_VALUES.includes(status)) return status;
  return 'planned';
};

const buildWatchlistCounts = (entries) => {
  const counts = {
    all: entries.length,
    planned: 0,
    watching: 0,
    completed: 0,
    dropped: 0
  };

  entries.forEach((entry) => {
    const status = getWatchlistStatus(entry);
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  });

  return counts;
};

const renderWatchlistFilters = (counts) => {
  const container = document.getElementById('watchlist-filter-chips');
  if (!container) return;
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'planned', label: 'Planned' },
    { key: 'watching', label: 'Watching' },
    { key: 'completed', label: 'Completed' },
    { key: 'dropped', label: 'Dropped' }
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

const filterWatchlistByStatus = (entries) => {
  if (currentWatchlistFilter === 'all') return entries;
  return entries.filter((entry) => getWatchlistStatus(entry) === currentWatchlistFilter);
};

const getDisplayItemForEntry = (entry) => {
  const snapshot = normalizeWatchlistSnapshot(entry?.snapshot, entry?.id);
  if (snapshot) return snapshot;
  const fallbackId = String(entry?.id || '').trim();
  return {
    id: fallbackId || 'unknown',
    title: 'Unknown title',
    year: null,
    studio: '',
    cover: PLACEHOLDER_COVER,
    stats: null
  };
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
    return;
  }

  section.classList.remove('is-empty');
  ensureWatchlistSnapshots(watchlistMap, version);
  const counts = buildWatchlistCounts(entries);
  renderWatchlistFilters(counts);
  const visible = filterWatchlistByStatus(entries);
  const fragment = document.createDocumentFragment();
  visible.forEach((entry, index) => {
    const item = getDisplayItemForEntry(entry);
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
    const entry = setWatchStatus(animeId, target.value, episodeCount);
    updateWatchlistUi(card, entry);
    renderWatchlist();
    return true;
  }

  if (action === 'watch-progress') {
    const entry = setWatchProgress(animeId, target.value, episodeCount);
    updateWatchlistUi(card, entry);
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
    const entry = adjustWatchProgress(animeId, 1, episodeCount);
    updateWatchlistUi(card, entry);
    return true;
  }

  if (action === 'watch-progress-dec') {
    const entry = adjustWatchProgress(animeId, -1, episodeCount);
    updateWatchlistUi(card, entry);
    return true;
  }

  return true;
};

const handleCardOpen = async (target) => {
  const card = target.closest?.('.anime-card');
  if (!card) return false;
  const animeId = String(card.dataset.animeId || '').trim();
  if (!animeId) return true;
  const app = await loadFullApp();
  app.showAnimeDetail(animeId);
  return true;
};

const setupGridHandlers = () => {
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;

  grid.addEventListener('click', async (event) => {
    if (handleWatchlistClick(event.target)) return;
    await handleCardOpen(event.target);
  });

  grid.addEventListener('change', (event) => {
    if (handleWatchlistChange(event.target)) return;
  });

  grid.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const isFormControl = event.target?.matches?.('input, select, textarea, button');
    if (isFormControl || event.target?.closest?.('.watchlist-controls')) return;
    const card = event.target.closest?.('.anime-card');
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
