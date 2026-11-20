import { queueIdleTask } from '../../shared/runtime/runtime-capabilities.ts';

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

// Preferences for features that no longer exist. Removing them keeps exported
// browser data and storage quota free of dead values.
const RETIRED_STORAGE_KEYS = ['rekonime.theme'];

const removeRetiredStorageKeys = (storage = globalThis.localStorage) => {
  try {
    for (const key of RETIRED_STORAGE_KEYS) storage?.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
};

const initDeferredRuntimeServices = ({
  timeoutMs = 2000,
  loadModules,
  onReady,
  onError
} = {}) => {
  const run = () => queueIdleTask(async () => {
    removeRetiredStorageKeys();
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
  RETIRED_STORAGE_KEYS,
  removeRetiredStorageKeys,
  runAfterWindowLoad,
  initDeferredRuntimeServices
};
