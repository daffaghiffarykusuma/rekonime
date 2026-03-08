const queueIdleTask = (callback, timeoutMs = 2000) => {
  if (typeof callback !== 'function') return null;
  if (typeof window === 'undefined') {
    callback();
    return null;
  }
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: timeoutMs });
  }
  return window.setTimeout(callback, 0);
};

const runAfterWindowLoad = (callback) => {
  if (typeof callback !== 'function') return;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    callback();
    return;
  }
  if (document.readyState === 'complete') {
    callback();
    return;
  }
  window.addEventListener('load', callback, { once: true });
};

const initDeferredRuntimeServices = ({
  timeoutMs = 2000,
  loadModules,
  onReady,
  onError
} = {}) => {
  const run = () => queueIdleTask(async () => {
    try {
      const modules = typeof loadModules === 'function' ? await loadModules() : [];
      if (typeof onReady === 'function') {
        await onReady(modules);
      }
    } catch (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  }, timeoutMs);

  runAfterWindowLoad(run);
};

export {
  queueIdleTask,
  runAfterWindowLoad,
  initDeferredRuntimeServices
};
