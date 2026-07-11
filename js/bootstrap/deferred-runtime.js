import { queueIdleTask } from '../runtime-capabilities.ts';

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
  }, { timeout: timeoutMs });

  runAfterWindowLoad(run);
};

export {
  runAfterWindowLoad,
  initDeferredRuntimeServices
};
