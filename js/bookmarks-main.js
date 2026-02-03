import { ThemeManager } from './themeManager.js';
import { ServiceWorkerManager } from './serviceWorker.js';
import { AnalyticsService } from './services/analytics-service.js';
import { Logger } from './services/logger.js';
import { PerformanceMonitor } from './performanceMonitor.js';

const BOOKMARK_STORAGE_KEY = 'rekonime.bookmarks';
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
let imageProxyStatus = { ok: null, checkedAt: 0 };
let imageProxyStatusLoaded = false;
let imageProxyCheckPromise = null;

const queueIdleTask = (callback, timeoutMs = 2000) => {
  if (typeof callback !== 'function') return;
  if (typeof window === 'undefined') {
    callback();
    return;
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    window.setTimeout(callback, 0);
  }
};

const loadImageProxyStatus = () => {
  if (imageProxyStatusLoaded || typeof window === 'undefined') return;
  imageProxyStatusLoaded = true;
  try {
    const raw = localStorage.getItem(IMAGE_PROXY_STATUS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const ok = parsed.ok === true ? true : (parsed.ok === false ? false : null);
    const checkedAt = Number(parsed.checkedAt) || 0;
    imageProxyStatus = { ok, checkedAt };
  } catch (error) {
    // Ignore parse errors
  }
};

const getImageProxyStatus = () => {
  loadImageProxyStatus();
  const checkedAt = Number(imageProxyStatus?.checkedAt) || 0;
  if (!checkedAt) return null;
  if (Date.now() - checkedAt > IMAGE_PROXY_STATUS_TTL_MS) return null;
  const ok = imageProxyStatus?.ok;
  return ok === true ? true : (ok === false ? false : null);
};

const storeImageProxyStatus = (ok) => {
  imageProxyStatus = { ok: ok === true, checkedAt: Date.now() };
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(IMAGE_PROXY_STATUS_KEY, JSON.stringify(imageProxyStatus));
  } catch (error) {
    // Ignore storage errors
  }
};

const checkImageProxyAvailability = () => {
  if (imageProxyCheckPromise) return imageProxyCheckPromise;
  imageProxyCheckPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      storeImageProxyStatus(false);
      resolve(false);
      return;
    }
    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      img.src = '';
      storeImageProxyStatus(false);
      resolve(false);
    }, IMAGE_PROXY_CHECK_TIMEOUT_MS);

    const finalize = (ok) => {
      window.clearTimeout(timeoutId);
      storeImageProxyStatus(ok);
      resolve(ok);
    };

    img.onload = () => finalize(true);
    img.onerror = () => finalize(false);
    img.src = `https://images.weserv.nl/?url=cdn.myanimelist.net/images/anime/1/1l.jpg&w=2&h=2&fit=cover&output=webp&cb=${Date.now()}`;
  }).finally(() => {
    imageProxyCheckPromise = null;
  });

  return imageProxyCheckPromise;
};

const scheduleImageProxyCheck = () => {
  if (imageProxyCheckPromise) return;
  if (getImageProxyStatus() !== null) return;
  queueIdleTask(() => {
    checkImageProxyAvailability().catch(() => null);
  }, 2000);
};

const shouldUseImageProxy = () => {
  const status = getImageProxyStatus();
  if (status === null) {
    scheduleImageProxyCheck();
    return false;
  }
  return status === true;
};

const isProxyUrl = (url) => {
  if (!url) return false;
  return String(url).includes('images.weserv.nl');
};

const markImageProxyFailed = () => {
  storeImageProxyStatus(false);
};

const loadFullApp = async () => {
  if (appInitPromise) return appInitPromise;
  appInitPromise = import('./app.js')
    .then(async (module) => {
      const { App } = module;
      if (!App.__bookmarksInit) {
        App.__bookmarksInit = true;
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
  if (!rawUrl) return '';
  const value = String(rawUrl).trim();
  if (!value) return '';

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  if (!hasScheme) {
    return value;
  }

  try {
    const parsed = new URL(value, window.location.href);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_IMAGE_HOSTS.some((allowed) =>
      host === allowed || host.endsWith(`.${allowed}`)
    );
    return isAllowed ? parsed.toString() : '';
  } catch (error) {
    return '';
  }
};

const buildProxyUrl = (coverUrl) => {
  if (!shouldUseImageProxy()) return '';
  const sanitized = sanitizeImageUrl(coverUrl);
  if (!sanitized) return '';
  const host = new URL(sanitized).hostname.toLowerCase();
  if (host === 'images.weserv.nl') return sanitized;
  const normalized = sanitized.replace(/^https?:\/\//i, '').replace(/^\/\//, '');
  const url = new URL('https://images.weserv.nl/');
  url.searchParams.set('url', normalized);
  url.searchParams.set('w', String(CARD_DIMENSIONS.width));
  url.searchParams.set('h', String(CARD_DIMENSIONS.height));
  url.searchParams.set('fit', 'cover');
  url.searchParams.set('output', 'webp');
  return url.toString();
};

const parseBookmarks = () => {
  if (typeof window === 'undefined') return { ids: [], items: [] };
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY);
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
    Logger?.warn?.('Failed to parse bookmarks', { error });
  }
  return { ids: [], items: [] };
};

const normalizeBookmarkItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  const title = String(item.title || '').trim();
  const cover = String(item.cover || '').trim();
  if (!id || !title || !cover) return null;
  return {
    id,
    title,
    year: item.year || null,
    studio: item.studio || '',
    cover,
    stats: item.stats || null
  };
};

const buildCard = (item, index) => {
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

  const toggle = document.createElement('button');
  toggle.className = 'bookmark-card-toggle is-bookmarked';
  toggle.type = 'button';
  toggle.setAttribute('data-action', 'toggle-bookmark');
  toggle.setAttribute('data-anime-id', item.id);
  toggle.setAttribute('aria-label', 'Remove bookmark');
  toggle.setAttribute('title', 'Remove bookmark');
  toggle.innerHTML = '<span aria-hidden="true">&#9733;</span><span class="visually-hidden">Remove bookmark</span>';

  media.appendChild(img);
  media.appendChild(toggle);
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

  card.appendChild(body);
  return card;
};

const renderBookmarks = () => {
  const section = document.getElementById('bookmarks-section');
  const grid = document.getElementById('bookmarks-grid');
  const empty = document.getElementById('bookmarks-empty');
  if (!section || !grid || !empty) return;

  const { items } = parseBookmarks();
  const normalized = items.map(normalizeBookmarkItem).filter(Boolean);
  if (normalized.length === 0) {
    section.classList.add('is-empty');
    grid.innerHTML = '';
    return;
  }

  section.classList.remove('is-empty');
  const fragment = document.createDocumentFragment();
  normalized.forEach((item, index) => fragment.appendChild(buildCard(item, index)));
  grid.replaceChildren(fragment);
};

const removeBookmark = (animeId) => {
  const { ids, items } = parseBookmarks();
  const nextIds = ids.filter((id) => id !== animeId);
  const nextItems = items.filter((item) => String(item?.id || '') !== animeId);
  const payload = { version: 2, ids: nextIds, items: nextItems };
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    Logger?.warn?.('Failed to persist bookmarks', { error });
  }
};

const handleBookmarkClick = async (target) => {
  const button = target.closest?.('.bookmark-card-toggle');
  if (!button) return false;
  const animeId = String(button.dataset.animeId || '').trim();
  if (!animeId) return true;
  removeBookmark(animeId);
  renderBookmarks();
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
  const grid = document.getElementById('bookmarks-grid');
  if (!grid) return;

  grid.addEventListener('click', async (event) => {
    if (await handleBookmarkClick(event.target)) return;
    await handleCardOpen(event.target);
  });

  grid.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest?.('.anime-card');
    if (!card) return;
    event.preventDefault();
    const app = await loadFullApp();
    app.showAnimeDetail(String(card.dataset.animeId || '').trim());
  });

  grid.addEventListener('error', (event) => {
    const img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    if (isProxyUrl(img.currentSrc || img.src)) {
      markImageProxyFailed();
    }
    if (img.dataset.fallbackApplied) return;
    const fallback = img.dataset.fallbackSrc;
    if (!fallback) return;
    img.dataset.fallbackApplied = 'true';
    img.src = fallback;
  }, true);
};

const setupSettingsHandler = () => {
  const settingsToggle = document.getElementById('settings-toggle');
  if (!settingsToggle) return;
  settingsToggle.addEventListener('click', async () => {
    const app = await loadFullApp();
    app.toggleSettingsModal();
  });
};

const bootstrap = () => {
  Logger.init({ level: 'info', captureGlobalErrors: true });
  AnalyticsService.init();
  PerformanceMonitor.init();
  ThemeManager.init();
  ServiceWorkerManager.register();
  ServiceWorkerManager.initConnectivityListeners();
  scheduleImageProxyCheck();

  renderBookmarks();
  setupGridHandlers();
  setupSettingsHandler();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
