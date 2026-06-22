import {
  buildImageProxyUrl,
  isProxyImageUrl,
  readImageProxyStatus,
  getFreshImageProxyStatus,
  writeImageProxyStatus,
  probeImageProxyAvailability
} from './image-proxy.js';

const defaultQueueTask = (callback, { timeout = 2000 } = {}) => {
  if (typeof callback !== 'function') return null;
  if (typeof window === 'undefined') {
    callback();
    return null;
  }
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout });
  }
  return window.setTimeout(callback, 0);
};

const createImageProxyRuntime = ({
  storageKey,
  ttlMs = 0,
  timeoutMs = 2500,
  queueTask = defaultQueueTask,
  waitForLoad = true,
  enabled = true,
  smartLoading = true,
  sanitizeImageUrl = value => String(value || ''),
  dimensions = {}
} = {}) => {
  let status = { ok: null, checkedAt: 0 };
  let statusLoaded = false;
  let checkPromise = null;
  let checkScheduled = false;

  const enqueue = (callback, options = {}) => {
    if (typeof queueTask === 'function') {
      return queueTask(callback, options);
    }
    return defaultQueueTask(callback, options);
  };

  const schedule = (callback, timeout) => {
    if (!waitForLoad || typeof window === 'undefined' || typeof document === 'undefined') {
      enqueue(callback, { timeout });
      return;
    }
    if (document.readyState === 'complete') {
      enqueue(callback, { timeout });
      return;
    }
    window.addEventListener('load', () => {
      enqueue(callback, { timeout });
    }, { once: true });
  };

  const runtime = {
    getDimensions(sizeKey) {
      const configured = dimensions?.[sizeKey];
      const width = Number(configured?.width);
      const height = Number(configured?.height);
      return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
    },

    getLoading(index = 0, { eagerCount = 0, priorityCount = 0 } = {}) {
      const eager = smartLoading && index < eagerCount;
      return {
        loading: eager ? 'eager' : 'lazy',
        decoding: 'async',
        fetchpriority: smartLoading && index < priorityCount ? 'high' : (eager ? 'auto' : (smartLoading ? 'low' : 'auto'))
      };
    },

    isProxyImageUrl,

    getFallbacks({ fallbackSrc = '', placeholder = '' } = {}) {
      return {
        primary: fallbackSrc || placeholder || '',
        secondary: fallbackSrc && placeholder && fallbackSrc !== placeholder ? placeholder : ''
      };
    },

    loadStatus() {
      if (statusLoaded) return status;
      statusLoaded = true;
      status = readImageProxyStatus(storageKey);
      return status;
    },

    getStatus() {
      runtime.loadStatus();
      return getFreshImageProxyStatus(status, ttlMs);
    },

    storeStatus(ok) {
      status = writeImageProxyStatus(storageKey, ok);
      statusLoaded = true;
      return status;
    },

    checkAvailability() {
      if (checkPromise) return checkPromise;
      checkPromise = probeImageProxyAvailability({ timeoutMs })
        .then((ok) => {
          runtime.storeStatus(ok);
          return ok;
        })
        .catch(() => {
          runtime.storeStatus(false);
          return false;
        })
        .finally(() => {
          checkPromise = null;
        });
      return checkPromise;
    },

    scheduleCheck({ timeout = 5000 } = {}) {
      if (checkPromise) return;
      if (runtime.getStatus() !== null) return;
      if (checkScheduled) return;
      checkScheduled = true;
      schedule(() => {
        checkScheduled = false;
        runtime.checkAvailability().catch(() => null);
      }, timeout);
    },

    shouldUseProxy() {
      if (!enabled) return false;
      const nextStatus = runtime.getStatus();
      if (nextStatus === null) {
        runtime.scheduleCheck();
        return true;
      }
      return nextStatus === true;
    },

    markFailed() {
      runtime.storeStatus(false);
    },

    resolveImage({
      coverUrl,
      sizeKey = '',
      width,
      height,
      placeholder = '',
      index = 0,
      eagerCount = 0,
      priorityCount = 0,
      preferOptimized
    } = {}) {
      const sanitized = sanitizeImageUrl(coverUrl);
      const configured = runtime.getDimensions(sizeKey) || {};
      const resolvedWidth = Number.isFinite(width) ? width : Number(configured.width);
      const resolvedHeight = Number.isFinite(height) ? height : Number(configured.height);
      const hasDimensions = Number.isFinite(resolvedWidth) && Number.isFinite(resolvedHeight);
      const useProxy = typeof preferOptimized === 'boolean' ? preferOptimized : runtime.shouldUseProxy();
      const optimized = sanitized && useProxy && hasDimensions
        ? buildImageProxyUrl(sanitized, {
            sanitizeImageUrl,
            width: resolvedWidth,
            height: resolvedHeight,
            fit: 'cover',
            output: 'webp'
          })
        : '';
      const hasDistinctOptimizedSource = Boolean(optimized && optimized !== sanitized);
      const primaryFallback = hasDistinctOptimizedSource ? sanitized : placeholder;
      const secondaryFallback = hasDistinctOptimizedSource && sanitized && placeholder && sanitized !== placeholder ? placeholder : '';
      const loading = runtime.getLoading(index, { eagerCount, priorityCount });
      return {
        optimized,
        src: optimized || sanitized || placeholder,
        srcset: '',
        sizes: '',
        fallback: hasDistinctOptimizedSource ? sanitized : '',
        fallbackSrc: primaryFallback,
        fallbackSecondary: secondaryFallback,
        width: hasDimensions ? resolvedWidth : null,
        height: hasDimensions ? resolvedHeight : null,
        ...loading
      };
    },

    handleImageError(img) {
      if (!img || img.tagName !== 'IMG') return false;
      if (isProxyImageUrl(img.currentSrc || img.src)) runtime.markFailed();
      if (img.dataset.fallbackApplied) return false;
      const fallback = img.dataset.fallbackSrc;
      if (!fallback) return false;
      img.dataset.fallbackApplied = 'true';
      img.src = fallback;
      if (img.dataset.fallbackSecondary) {
        img.dataset.fallbackSrc = img.dataset.fallbackSecondary;
        delete img.dataset.fallbackSecondary;
        delete img.dataset.fallbackApplied;
      }
      return true;
    }
  };

  return runtime;
};

export { createImageProxyRuntime };
