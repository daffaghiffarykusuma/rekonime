// @ts-nocheck
import { CatalogCache } from './catalog-cache.ts';
import { isValidCatalogPayload } from './catalog-payload.ts';

const DEFAULT_FETCH_CONFIG = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 4000,
  timeoutMs: 12000
};

const DEFAULT_DATA_SOURCES = {
  full: 'data/anime.full.index.json',
  detailBase: 'data/anime.detail'
};

const getErrorStatus = (error) => {
  if (!error) return null;
  const status = Number(error.status || error.response?.status);
  if (Number.isFinite(status)) return status;
  const match = String(error.message || '').match(/\b(\d{3})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
};

const shouldRetryCatalog = (error, attempt, maxRetries) => {
  if (attempt >= maxRetries) return false;
  if (error?.name === 'AbortError') return false;
  if (error instanceof TypeError) return true;

  const status = getErrorStatus(error);
  if (Number.isFinite(status)) {
    return status >= 500 || status === 429;
  }

  const message = String(error?.message || '').toLowerCase();
  return message.includes('network') || message.includes('fetch');
};

const getCatalogRetryDelay = (baseDelay, attempt, maxDelay) => {
  const jitter = Math.random() * 120;
  return Math.min(baseDelay * (2 ** attempt) + jitter, maxDelay);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createCatalogSession = ({
  isFullLoaded = false,
  isLoadingFull = false,
  activeFullLoadPromise = null,
  scheduledFullLoadHandle = null,
  interactionCaptured = false,
  detailChunkPromises = new Map(),
  detailChunkLoadedIds = new Set(),
  onChange = () => {}
} = {}) => {
  let fullLoaded = Boolean(isFullLoaded);
  let loadingFull = Boolean(isLoadingFull);
  let fullLoadPromise = activeFullLoadPromise || null;
  let scheduleHandle = scheduledFullLoadHandle || null;
  let capturedInteraction = Boolean(interactionCaptured);
  const chunkPromises = detailChunkPromises instanceof Map ? detailChunkPromises : new Map();
  const loadedChunkIds = detailChunkLoadedIds instanceof Set ? detailChunkLoadedIds : new Set();

  const snapshot = () => ({
    isFullLoaded: fullLoaded,
    isLoadingFull: loadingFull,
    activeFullLoadPromise: fullLoadPromise,
    scheduledFullLoadHandle: scheduleHandle,
    interactionCaptured: capturedInteraction,
    detailChunkPromiseCount: chunkPromises.size,
    detailChunkLoadedCount: loadedChunkIds.size
  });

  const notify = () => onChange(snapshot());

  return {
    snapshot,
    isFullLoaded: () => fullLoaded,
    markFullLoaded(value) {
      fullLoaded = Boolean(value);
      notify();
    },
    setLoading(value) {
      loadingFull = Boolean(value);
      notify();
    },
    getActiveFullLoad: () => fullLoadPromise,
    setActiveFullLoad(promise) {
      fullLoadPromise = promise || null;
      notify();
    },
    getScheduledHandle: () => scheduleHandle,
    setScheduledHandle(handle) {
      scheduleHandle = handle || null;
      notify();
    },
    takeScheduledHandle() {
      const handle = scheduleHandle;
      scheduleHandle = null;
      notify();
      return handle;
    },
    hasInteractionCaptured: () => capturedInteraction,
    captureInteraction() {
      capturedInteraction = true;
      notify();
    },
    hasDetailLoad: (animeId) => chunkPromises.has(String(animeId ?? '').trim()),
    getDetailLoad: (animeId) => chunkPromises.get(String(animeId ?? '').trim()) || null,
    trackDetailLoad(animeId, promise) {
      const key = String(animeId ?? '').trim();
      if (!key) return null;
      chunkPromises.set(key, promise);
      notify();
      return promise;
    },
    clearDetailLoad(animeId) {
      chunkPromises.delete(String(animeId ?? '').trim());
      notify();
    },
    hasDetailLoaded: (animeId) => loadedChunkIds.has(String(animeId ?? '').trim()),
    markDetailLoaded(animeId) {
      const key = String(animeId ?? '').trim();
      if (!key) return;
      loadedChunkIds.add(key);
      notify();
    }
  };
};

const createCatalogRuntime = ({
  dataSources = DEFAULT_DATA_SOURCES,
  fetchConfig = DEFAULT_FETCH_CONFIG,
  fetchFn = (...args) => fetch(...args),
  getAssetPath = (path) => path,
  getLogger = () => null,
  getPerformanceNow = () => Date.now(),
  getLocationProtocol = () => (typeof window !== 'undefined' ? window.location.protocol : 'https:'),
  getCurrentAnimeData = () => [],
  session = createCatalogSession(),
  teardownFullCatalogInteractionTriggers = () => {},
  cancelIdleTask = () => {},
  addPreloadHints = () => {},
  emitAppEvent = () => {},
  emitCatalogEvent = () => {},
  loadEmbeddedData = async () => false,
  applyCatalogPayload = async () => {},
  mergeAnimeDetail = () => null,
  hasFullAnimeDetail = (anime) => Array.isArray(anime?.episodes) && anime.episodes.length > 0,
  clearDetailCache = () => {},
  catalogCache = CatalogCache,
  catalogCacheMaxAgeMs = 30 * 24 * 60 * 60 * 1000,
  fullCatalogTimeoutMs = 30000
} = {}) => {
  const emitDataLoadEnd = ({ source, loadStart, status }) => {
    emitAppEvent('rekonime:data-load-end', {
      source,
      durationMs: getPerformanceNow() - loadStart,
      status
    });
  };

  const fetchCatalog = async (path, options = {}) => {
    if (!path) return null;
    const url = getAssetPath(path);
    const maxRetries = Number.isFinite(options.maxRetries) ? options.maxRetries : fetchConfig.maxRetries;
    const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : fetchConfig.baseDelay;
    const maxDelay = Number.isFinite(options.maxDelay) ? options.maxDelay : fetchConfig.maxDelay;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : fetchConfig.timeoutMs;
    const externalSignal = options.signal;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (externalSignal?.aborted) return null;
      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchOptions = {
          cache: attempt === 0 ? 'force-cache' : 'no-cache',
          signal: controller.signal
        };
        const response = await fetchFn(url, fetchOptions);
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }
        const data = await response.json();

        if (!isValidCatalogPayload(data)) {
          throw new Error('Invalid catalog payload');
        }

        clearTimeout(timeoutId);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', onExternalAbort);
        }
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', onExternalAbort);
        }
        lastError = error;
        if (!shouldRetryCatalog(error, attempt, maxRetries)) break;
        await delay(getCatalogRetryDelay(baseDelay, attempt, maxDelay));
      }
    }

    if (lastError) {
      const logger = getLogger();
      if (logger?.error) {
        logger.error('[fetchCatalog] Failed to load catalog', { error: lastError });
      } else {
        console.error('[fetchCatalog] Failed to load catalog:', lastError);
      }
    }
    return null;
  };

  const cacheFullCatalog = async (payload) => {
    try {
      const stored = await catalogCache.putFullCatalog(payload);
      emitCatalogEvent(stored ? 'cache-write-ok' : 'cache-write-failed', { source: 'network-full' });
      return stored;
    } catch (error) {
      const logger = getLogger();
      logger?.warn?.('[cacheFullCatalog] Unable to cache full catalog', { error });
      emitCatalogEvent('cache-write-failed', { source: 'network-full', reason: 'exception' });
      return false;
    }
  };

  const loadCachedFullCatalog = async () => {
    try {
      const payload = await catalogCache.getFullCatalog({ maxAgeMs: catalogCacheMaxAgeMs });
      if (!payload) {
        emitCatalogEvent('indexeddb-full-miss');
        return null;
      }
      const logger = getLogger();
      logger?.info?.('[loadCachedFullCatalog] Loaded full catalog from IndexedDB cache');
      emitCatalogEvent('indexeddb-full-hit');
      return payload;
    } catch (error) {
      const logger = getLogger();
      logger?.warn?.('[loadCachedFullCatalog] Unable to read cached full catalog', { error });
      emitCatalogEvent('indexeddb-full-read-failed', { reason: 'exception' });
      return null;
    }
  };

  const loadInitialData = async () => {
    addPreloadHints();

    if (getLocationProtocol() === 'file:') {
      const source = 'embedded';
      const loadStart = getPerformanceNow();
      emitAppEvent('rekonime:data-load-start', { source });
      const loaded = await loadEmbeddedData();
      if (!loaded) {
        emitDataLoadEnd({ source, loadStart, status: 'failed' });
        return false;
      }

      emitCatalogEvent('embedded-fallback-used', { phase: 'initial' });
      await applyCatalogPayload({ anime: getCurrentAnimeData() }, { isFull: true, preserveFilters: false });
      emitDataLoadEnd({ source, loadStart, status: 'ok' });
      return true;
    }

    return loadFullCatalog();
  };

  const loadFullCatalog = async (options = {}) => {
    if (session.isFullLoaded()) return true;

    if (!session.hasInteractionCaptured()) {
      session.captureInteraction();
    }
    teardownFullCatalogInteractionTriggers();

    const scheduleHandle = session.takeScheduledHandle();
    if (scheduleHandle) {
      cancelIdleTask(scheduleHandle);
    }

    const activePromise = session.getActiveFullLoad();
    if (activePromise) return activePromise;

    const loadStart = getPerformanceNow();
    emitAppEvent('rekonime:data-load-start', { source: 'full' });

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : fullCatalogTimeoutMs;
    const controller = new AbortController();
    const timeoutId = Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    session.setLoading(true);
    const promise = (async () => {
      try {
        if (getLocationProtocol() === 'file:') {
          const loaded = await loadEmbeddedData();
          if (!loaded) return false;

          emitCatalogEvent('embedded-fallback-used', { phase: 'full', reason: 'file-protocol' });
          await applyCatalogPayload({ anime: getCurrentAnimeData() }, { isFull: true, preserveFilters: true });
          return true;
        }

        const fullPayload = await fetchCatalog(dataSources.full, { signal: controller.signal });

        if (controller.signal.aborted) return session.isFullLoaded();

        if (!fullPayload) {
          const cachedPayload = await loadCachedFullCatalog();
          if (cachedPayload && !controller.signal.aborted) {
            emitCatalogEvent('indexeddb-full-used', { reason: 'network-unavailable' });
            await applyCatalogPayload(cachedPayload, { isFull: true, preserveFilters: true });
            return true;
          }

          const loaded = await loadEmbeddedData();
          if (!loaded || controller.signal.aborted) return session.isFullLoaded();

          emitCatalogEvent('embedded-fallback-used', { phase: 'full', reason: 'network-and-cache-unavailable' });
          await applyCatalogPayload({ anime: getCurrentAnimeData() }, { isFull: true, preserveFilters: true });
          return true;
        }

        emitCatalogEvent('network-full-loaded', { path: dataSources.full });
        await applyCatalogPayload(fullPayload, { isFull: true, preserveFilters: true });
        await cacheFullCatalog(fullPayload);
        return true;
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          console.warn('[loadFullCatalog] Timed out');
          emitCatalogEvent('full-load-timeout', { timeoutMs });
          return session.isFullLoaded();
        }
        throw error;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })();

    session.setActiveFullLoad(promise);
    let result = false;
    try {
      result = await promise;
    } catch (error) {
      const logger = getLogger();
      if (logger?.error) {
        logger.error('[loadFullCatalog] Unexpected error', { error });
      } else {
        console.error('[loadFullCatalog] Unexpected error:', error);
      }
      result = false;
    } finally {
      session.setLoading(false);
      session.setActiveFullLoad(null);
      emitAppEvent('rekonime:data-load-end', {
        source: 'full',
        durationMs: getPerformanceNow() - loadStart,
        status: result ? 'ok' : 'failed'
      });
    }

    session.markFullLoaded(Boolean(result) || session.isFullLoaded());
    return result;
  };

  const getAnimeDetailChunkPath = (animeId) => {
    const key = String(animeId ?? '').trim();
    if (!key) return '';
    const base = String(dataSources.detailBase || 'data/anime.detail').replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(key)}.json`;
  };

  const loadAnimeDetailChunk = async (animeId) => {
    const key = String(animeId ?? '').trim();
    if (!key) return null;

    const existing = getCurrentAnimeData().find((anime) => String(anime.id) === key);
    if (hasFullAnimeDetail(existing)) return existing;
    if (session.hasDetailLoaded(key)) return existing || null;

    if (session.hasDetailLoad(key)) {
      return session.getDetailLoad(key);
    }

    const promise = (async () => {
      const payload = await fetchCatalog(getAnimeDetailChunkPath(key), {
        maxRetries: 1,
        timeoutMs: 8000
      });
      const detailAnime = Array.isArray(payload?.anime) ? payload.anime[0] : null;
      if (!detailAnime) return null;
      const merged = mergeAnimeDetail(detailAnime);
      session.markDetailLoaded(key);
      if (merged) {
        clearDetailCache(merged.id);
        emitCatalogEvent('detail-chunk-loaded', { animeId: key });
      }
      return merged;
    })()
      .catch((error) => {
        const logger = getLogger();
        logger?.warn?.('[loadAnimeDetailChunk] Unable to load detail chunk', { animeId: key, error });
        return null;
      })
      .finally(() => {
        session.clearDetailLoad(key);
      });

    session.trackDetailLoad(key, promise);
    return promise;
  };

  return {
    session,
    loadInitialData,
    loadFullCatalog,
    setScheduledFullLoadHandle: (handle) => session.setScheduledHandle(handle),
    loadAnimeDetailChunk
  };
};

const createAppCatalogRuntime = (app) => createCatalogRuntime({
  dataSources: app.dataSources,
  fetchConfig: app.fetchConfig,
  getAssetPath: (path) => (typeof app.getAssetPath === 'function' ? app.getAssetPath(path) : path),
  getLogger: () => app.getLogger(),
  getPerformanceNow: () => app.getPerformanceNow(),
  getCurrentAnimeData: () => app.animeData,
  session: createCatalogSession({
    isFullLoaded: app.isFullDataLoaded,
    isLoadingFull: app.loadingFullCatalog,
    activeFullLoadPromise: app.fullCatalogPromise,
    scheduledFullLoadHandle: app.fullCatalogScheduleHandle,
    interactionCaptured: app.fullCatalogInteractionCaptured,
    detailChunkPromises: app.animeDetailChunkPromises,
    detailChunkLoadedIds: app.animeDetailChunkLoadedIds,
    onChange: (snapshot) => {
      app.isFullDataLoaded = snapshot.isFullLoaded;
      app.loadingFullCatalog = snapshot.isLoadingFull;
      app.fullCatalogPromise = snapshot.activeFullLoadPromise;
      app.fullCatalogScheduleHandle = snapshot.scheduledFullLoadHandle;
      app.fullCatalogInteractionCaptured = snapshot.interactionCaptured;
    }
  }),
  teardownFullCatalogInteractionTriggers: () => app.teardownFullCatalogInteractionTriggers(),
  cancelIdleTask: (handle) => app.getRuntimeCapabilities().cancelIdleTask(handle),
  addPreloadHints: () => app.addPreloadHints(),
  emitAppEvent: (name, detail) => app.emitAppEvent(name, detail),
  emitCatalogEvent: (type, detail) => app.emitCatalogEvent(type, detail),
  loadEmbeddedData: () => app.loadEmbeddedData(),
  applyCatalogPayload: (payload, options) => app.applyCatalogPayload(payload, options),
  mergeAnimeDetail: (detailAnime) => app.mergeAnimeDetail(detailAnime),
  hasFullAnimeDetail: (anime) => app.hasFullAnimeDetail(anime),
  clearDetailCache: (animeId) => {
    app.detailCache.delete(animeId);
  },
  catalogCacheMaxAgeMs: app.catalogCacheMaxAgeMs,
  fullCatalogTimeoutMs: app.fullCatalogTimeoutMs
});

export {
  createAppCatalogRuntime,
  createCatalogRuntime,
  createCatalogSession,
  getErrorStatus,
  shouldRetryCatalog,
  getCatalogRetryDelay
};
