import { setupDom } from './helpers/dom.js';

setupDom();

globalThis.__TEST_UTILS__ = {
  setupDom
};

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = async () => {
    throw new Error('fetch is not available');
  };
} else {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.__REAL_FETCH__ = realFetch;
  globalThis.fetch = async () => {
    throw new Error('fetch not mocked');
  };
}

if (!globalThis.navigator.serviceWorker) {
  globalThis.navigator.serviceWorker = {};
}
