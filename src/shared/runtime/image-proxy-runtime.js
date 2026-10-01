import {
  buildImageProxyUrl,
  isProxyImageUrl,
  readImageProxyStatus,
  getFreshImageProxyStatus,
  writeImageProxyStatus,
  probeImageProxyAvailability
} from './image-proxy.js';
import { queueIdleTask } from './runtime-capabilities.ts';
import { IMAGE_PLACEHOLDER } from './image-placeholder.js';

const createImageProxyRuntime = ({
  storageKey,
  ttlMs = 0,
  timeoutMs = 2500,
  queueTask = queueIdleTask,
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
    return queueIdleTask(callback, options);
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

    getFallbacks({ fallbackSrc = '', placeholder = IMAGE_PLACEHOLDER } = {}) {
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
        return false;
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
      placeholder = IMAGE_PLACEHOLDER,
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
      if (!img.hasAttribute('data-fallback-src') || img.src === IMAGE_PLACEHOLDER) return false;
      if (isProxyImageUrl(img.currentSrc || img.src)) runtime.markFailed();
      const fallback = !img.dataset.fallbackApplied && img.dataset.fallbackSrc
        ? img.dataset.fallbackSrc
        : IMAGE_PLACEHOLDER;
      img.dataset.fallbackApplied = 'true';
      // A responsive candidate takes precedence over src unless it is removed.
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = fallback === img.src ? IMAGE_PLACEHOLDER : fallback;
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
