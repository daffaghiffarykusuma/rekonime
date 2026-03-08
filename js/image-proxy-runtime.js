import {
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
  waitForLoad = true
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
      const nextStatus = runtime.getStatus();
      if (nextStatus === null) {
        runtime.scheduleCheck();
        return true;
      }
      return nextStatus === true;
    },

    markFailed() {
      runtime.storeStatus(false);
    }
  };

  return runtime;
};

export { createImageProxyRuntime };
