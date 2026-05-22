import { CatalogCache } from './catalog-cache.js';

const DEFAULT_FETCH_CONFIG = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 4000,
  timeoutMs: 12000
};

const DEFAULT_DATA_SOURCES = {
  preview: 'data/anime.preview.json',
  full: 'data/anime.full.index.json',
  detailBase: 'data/anime.detail'
};

const isValidCatalogPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.anime)) return false;
  if (payload.anime.length === 0) return true;
  const firstItem = payload.anime[0];
  return Boolean(firstItem && typeof firstItem.id !== 'undefined' && typeof firstItem.title === 'string');
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

const createCatalogRuntime = ({
  dataSources = DEFAULT_DATA_SOURCES,
  fetchConfig = DEFAULT_FETCH_CONFIG,
  features = {},
  getAssetPath = (path) => path,
  getApiClient = () => null,
  getLogger = () => null,
  getPerformanceNow = () => Date.now(),
  getLocationProtocol = () => (typeof window !== 'undefined' ? window.location.protocol : 'https:'),
  getCurrentAnimeData = () => [],
  isFullDataLoaded = () => false,
  setFullDataLoaded = () => {},
  setLoadingFullCatalog = () => {},
  getFullCatalogPromise = () => null,
  setFullCatalogPromise = () => {},
  getFullCatalogScheduleHandle = () => null,
  setFullCatalogScheduleHandle = () => {},
  getFullCatalogInteractionCaptured = () => false,
  setFullCatalogInteractionCaptured = () => {},
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
  detailChunkPromises = new Map(),
  detailChunkLoadedIds = new Set(),
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
        const apiClient = getApiClient();
        const data = apiClient
          ? await apiClient.getJson(url, fetchOptions)
          : await (async () => {
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
              const error = new Error(`HTTP ${response.status}`);
              error.status = response.status;
              error.response = response;
              throw error;
            }
            return response.json();
          })();

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
    if (features.parallelLoading) {
      addPreloadHints();
    }

    const source = getLocationProtocol() === 'file:' ? 'embedded' : 'preview';
    const loadStart = getPerformanceNow();
    emitAppEvent('rekonime:data-load-start', { source });

    if (getLocationProtocol() === 'file:') {
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

    const previewPayload = await fetchCatalog(dataSources.preview);
    if (previewPayload) {
      emitCatalogEvent('preview-network-loaded', { path: dataSources.preview });
      await applyCatalogPayload(previewPayload, { isFull: false, preserveFilters: false });
      emitDataLoadEnd({ source, loadStart, status: 'ok' });
      return true;
    }

    emitDataLoadEnd({ source, loadStart, status: 'failed' });
    return loadFullCatalog();
  };

  const loadFullCatalog = async (options = {}) => {
    if (isFullDataLoaded()) return true;

    if (!getFullCatalogInteractionCaptured()) {
      setFullCatalogInteractionCaptured(true);
    }
    teardownFullCatalogInteractionTriggers();

    const scheduleHandle = getFullCatalogScheduleHandle();
    if (scheduleHandle) {
      cancelIdleTask(scheduleHandle);
      setFullCatalogScheduleHandle(null);
    }

    const activePromise = getFullCatalogPromise();
    if (activePromise) return activePromise;

    const loadStart = getPerformanceNow();
    emitAppEvent('rekonime:data-load-start', { source: 'full' });

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : fullCatalogTimeoutMs;
    const controller = new AbortController();
    const timeoutId = Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    setLoadingFullCatalog(true);
    const promise = (async () => {
      try {
        if (getLocationProtocol() === 'file:') {
          const loaded = await loadEmbeddedData();
          if (!loaded) return false;

          emitCatalogEvent('embedded-fallback-used', { phase: 'full', reason: 'file-protocol' });
          await applyCatalogPayload({ anime: getCurrentAnimeData() }, { isFull: true, preserveFilters: true });
          return true;
        }

        let fullPayload = null;
        if (features.parallelLoading) {
          const [fullResult] = await Promise.allSettled([
            fetchCatalog(dataSources.full, { signal: controller.signal })
          ]);
          if (controller.signal.aborted) return isFullDataLoaded();
          if (fullResult.status === 'fulfilled' && fullResult.value) {
            fullPayload = fullResult.value;
          }
        } else {
          fullPayload = await fetchCatalog(dataSources.full, { signal: controller.signal });
        }

        if (controller.signal.aborted) return isFullDataLoaded();

        if (!fullPayload) {
          const cachedPayload = await loadCachedFullCatalog();
          if (cachedPayload && !controller.signal.aborted) {
            emitCatalogEvent('indexeddb-full-used', { reason: 'network-unavailable' });
            await applyCatalogPayload(cachedPayload, { isFull: true, preserveFilters: true });
            return true;
          }

          const loaded = await loadEmbeddedData();
          if (!loaded || controller.signal.aborted) return isFullDataLoaded();

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
          return isFullDataLoaded();
        }
        throw error;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })();

    setFullCatalogPromise(promise);
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
      setLoadingFullCatalog(false);
      setFullCatalogPromise(null);
      emitAppEvent('rekonime:data-load-end', {
        source: 'full',
        durationMs: getPerformanceNow() - loadStart,
        status: result ? 'ok' : 'failed'
      });
    }

    setFullDataLoaded(Boolean(result) || isFullDataLoaded());
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
    if (detailChunkLoadedIds.has(key)) return existing || null;

    if (detailChunkPromises.has(key)) {
      return detailChunkPromises.get(key);
    }

    const promise = (async () => {
      const payload = await fetchCatalog(getAnimeDetailChunkPath(key), {
        maxRetries: 1,
        timeoutMs: 8000
      });
      const detailAnime = Array.isArray(payload?.anime) ? payload.anime[0] : null;
      if (!detailAnime) return null;
      const merged = mergeAnimeDetail(detailAnime);
      detailChunkLoadedIds.add(key);
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
        detailChunkPromises.delete(key);
      });

    detailChunkPromises.set(key, promise);
    return promise;
  };

  return {
    loadInitialData,
    loadFullCatalog,
    fetchCatalog,
    cacheFullCatalog,
    loadCachedFullCatalog,
    getAnimeDetailChunkPath,
    loadAnimeDetailChunk
  };
};

const createAppCatalogRuntime = (app) => createCatalogRuntime({
  dataSources: app.dataSources,
  fetchConfig: app.fetchConfig,
  features: app.features,
  getAssetPath: (path) => (typeof app.getAssetPath === 'function' ? app.getAssetPath(path) : path),
  getApiClient: () => app.getApiClient(),
  getLogger: () => app.getLogger(),
  getPerformanceNow: () => app.getPerformanceNow(),
  getCurrentAnimeData: () => app.animeData,
  isFullDataLoaded: () => app.isFullDataLoaded,
  setFullDataLoaded: (value) => { app.isFullDataLoaded = value; },
  setLoadingFullCatalog: (value) => { app.loadingFullCatalog = value; },
  getFullCatalogPromise: () => app.fullCatalogPromise,
  setFullCatalogPromise: (promise) => { app.fullCatalogPromise = promise; },
  getFullCatalogScheduleHandle: () => app.fullCatalogScheduleHandle,
  setFullCatalogScheduleHandle: (handle) => { app.fullCatalogScheduleHandle = handle; },
  getFullCatalogInteractionCaptured: () => app.fullCatalogInteractionCaptured,
  setFullCatalogInteractionCaptured: (value) => { app.fullCatalogInteractionCaptured = value; },
  teardownFullCatalogInteractionTriggers: () => app.teardownFullCatalogInteractionTriggers(),
  cancelIdleTask: (handle) => app.cancelIdleTask(handle),
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
  detailChunkPromises: app.animeDetailChunkPromises,
  detailChunkLoadedIds: app.animeDetailChunkLoadedIds,
  fullCatalogTimeoutMs: app.fullCatalogTimeoutMs
});

const CatalogLoader = {
  createRuntime: createAppCatalogRuntime,

  loadInitialData(app) {
    return createAppCatalogRuntime(app).loadInitialData();
  },

  loadFullCatalog(app, options = {}) {
    return createAppCatalogRuntime(app).loadFullCatalog(options);
  }
};

export {
  CatalogLoader,
  createCatalogRuntime,
  isValidCatalogPayload,
  getErrorStatus,
  shouldRetryCatalog,
  getCatalogRetryDelay
};
export default CatalogLoader;
