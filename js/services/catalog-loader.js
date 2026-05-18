const emitCatalogEvent = (app, type, detail = {}) => {
  if (typeof app?.emitCatalogEvent === 'function') {
    app.emitCatalogEvent(type, detail);
  }
};

const emitDataLoadEnd = (app, { source, loadStart, status }) => {
  app.emitAppEvent('rekonime:data-load-end', {
    source,
    durationMs: app.getPerformanceNow() - loadStart,
    status
  });
};

const CatalogLoader = {
  async loadInitialData(app) {
    if (app.features.parallelLoading) {
      app.addPreloadHints();
    }

    const source = window.location.protocol === 'file:' ? 'embedded' : 'preview';
    const loadStart = app.getPerformanceNow();
    app.emitAppEvent('rekonime:data-load-start', { source });

    if (window.location.protocol === 'file:') {
      const loaded = await app.loadEmbeddedData();
      if (!loaded) {
        emitDataLoadEnd(app, { source, loadStart, status: 'failed' });
        return false;
      }

      emitCatalogEvent(app, 'embedded-fallback-used', { phase: 'initial' });
      await app.applyCatalogPayload({ anime: app.animeData }, { isFull: true, preserveFilters: false });
      emitDataLoadEnd(app, { source, loadStart, status: 'ok' });
      return true;
    }

    const previewPayload = await app.fetchCatalog(app.dataSources.preview);
    if (previewPayload) {
      emitCatalogEvent(app, 'preview-network-loaded', { path: app.dataSources.preview });
      await app.applyCatalogPayload(previewPayload, { isFull: false, preserveFilters: false });
      emitDataLoadEnd(app, { source, loadStart, status: 'ok' });
      return true;
    }

    emitDataLoadEnd(app, { source, loadStart, status: 'failed' });
    return app.loadFullCatalog();
  },

  async loadFullCatalog(app, options = {}) {
    if (app.isFullDataLoaded) {
      return true;
    }

    if (!app.fullCatalogInteractionCaptured) {
      app.fullCatalogInteractionCaptured = true;
    }
    app.teardownFullCatalogInteractionTriggers();

    if (app.fullCatalogScheduleHandle) {
      app.cancelIdleTask(app.fullCatalogScheduleHandle);
      app.fullCatalogScheduleHandle = null;
    }

    if (app.fullCatalogPromise) {
      return app.fullCatalogPromise;
    }

    const loadStart = app.getPerformanceNow();
    app.emitAppEvent('rekonime:data-load-start', { source: 'full' });

    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : app.fullCatalogTimeoutMs;
    const controller = new AbortController();
    const timeoutId = Number.isFinite(timeoutMs)
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    app.loadingFullCatalog = true;
    app.fullCatalogPromise = (async () => {
      try {
        if (window.location.protocol === 'file:') {
          const loaded = await app.loadEmbeddedData();
          if (!loaded) {
            return false;
          }

          emitCatalogEvent(app, 'embedded-fallback-used', { phase: 'full', reason: 'file-protocol' });
          await app.applyCatalogPayload({ anime: app.animeData }, { isFull: true, preserveFilters: true });
          return true;
        }

        let fullPayload = null;
        if (app.features.parallelLoading) {
          const [fullResult] = await Promise.allSettled([
            app.fetchCatalog(app.dataSources.full, { signal: controller.signal })
          ]);
          if (controller.signal.aborted) {
            return app.isFullDataLoaded;
          }
          if (fullResult.status === 'fulfilled' && fullResult.value) {
            fullPayload = fullResult.value;
          }
        } else {
          fullPayload = await app.fetchCatalog(app.dataSources.full, { signal: controller.signal });
        }

        if (controller.signal.aborted) {
          return app.isFullDataLoaded;
        }

        if (!fullPayload) {
          const cachedPayload = await app.loadCachedFullCatalog();
          if (cachedPayload && !controller.signal.aborted) {
            emitCatalogEvent(app, 'indexeddb-full-used', { reason: 'network-unavailable' });
            await app.applyCatalogPayload(cachedPayload, { isFull: true, preserveFilters: true });
            return true;
          }

          const loaded = await app.loadEmbeddedData();
          if (!loaded || controller.signal.aborted) {
            return app.isFullDataLoaded;
          }

          emitCatalogEvent(app, 'embedded-fallback-used', { phase: 'full', reason: 'network-and-cache-unavailable' });
          await app.applyCatalogPayload({ anime: app.animeData }, { isFull: true, preserveFilters: true });
          return true;
        }

        emitCatalogEvent(app, 'network-full-loaded', { path: app.dataSources.full });
        await app.applyCatalogPayload(fullPayload, { isFull: true, preserveFilters: true });
        await app.cacheFullCatalog(fullPayload);
        return true;
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          console.warn('[loadFullCatalog] Timed out');
          emitCatalogEvent(app, 'full-load-timeout', { timeoutMs });
          return app.isFullDataLoaded;
        }
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    })();

    let result = false;
    try {
      result = await app.fullCatalogPromise;
    } catch (error) {
      const logger = app.getLogger();
      if (logger?.error) {
        logger.error('[loadFullCatalog] Unexpected error', { error });
      } else {
        console.error('[loadFullCatalog] Unexpected error:', error);
      }
      result = false;
    } finally {
      app.loadingFullCatalog = false;
      app.fullCatalogPromise = null;
      app.emitAppEvent('rekonime:data-load-end', {
        source: 'full',
        durationMs: app.getPerformanceNow() - loadStart,
        status: result ? 'ok' : 'failed'
      });
    }

    app.isFullDataLoaded = Boolean(result) || app.isFullDataLoaded;
    return result;
  }
};

export { CatalogLoader };
export default CatalogLoader;
