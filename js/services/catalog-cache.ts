// @ts-nocheck
const DB_NAME = 'rekonime-catalog-cache';
const DB_VERSION = 1;
const STORE_NAME = 'catalogs';
const FULL_CATALOG_KEY = 'full';
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const isValidCatalogPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  if (!Array.isArray(payload.anime)) return false;
  if (payload.anime.length === 0) return true;
  const firstItem = payload.anime[0];
  return Boolean(firstItem && typeof firstItem.id !== 'undefined' && typeof firstItem.title === 'string');
};

const resolveIndexedDB = (indexedDBImpl, hasOverride = false) => {
  if (hasOverride) return indexedDBImpl || null;
  if (indexedDBImpl) return indexedDBImpl;
  if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  return null;
};

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const openDatabase = (options = {}) => {
  const { indexedDBImpl } = options;
  const hasOverride = Object.prototype.hasOwnProperty.call(options, 'indexedDBImpl');
  const dbFactory = resolveIndexedDB(indexedDBImpl, hasOverride);
  if (!dbFactory) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = dbFactory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open catalog cache'));
  });
};

const withStore = async (mode, operation, options = {}) => {
  const db = await openDatabase(options);
  if (!db) return null;

  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    return await operation(store);
  } finally {
    if (typeof db.close === 'function') {
      db.close();
    }
  }
};

const CatalogCache = {
  maxAgeMs: DEFAULT_MAX_AGE_MS,

  isAvailable(options = {}) {
    const hasOverride = Object.prototype.hasOwnProperty.call(options, 'indexedDBImpl');
    return Boolean(resolveIndexedDB(options.indexedDBImpl, hasOverride));
  },

  async putFullCatalog(payload, { now = Date.now, source = 'network', indexedDBImpl } = {}) {
    if (!isValidCatalogPayload(payload)) {
      return false;
    }
    const dbOptions = indexedDBImpl === undefined ? {} : { indexedDBImpl };
    if (!this.isAvailable(dbOptions)) {
      return false;
    }

    const cachedAt = now();
    const record = {
      id: FULL_CATALOG_KEY,
      schemaVersion: 1,
      source,
      cachedAt,
      generatedAt: payload.generatedAt || null,
      payload
    };

    try {
      await withStore('readwrite', (store) => requestToPromise(store.put(record)), dbOptions);
      return true;
    } catch (error) {
      return false;
    }
  },

  async getFullCatalog({ now = Date.now, maxAgeMs = DEFAULT_MAX_AGE_MS, indexedDBImpl } = {}) {
    const dbOptions = indexedDBImpl === undefined ? {} : { indexedDBImpl };
    if (!this.isAvailable(dbOptions)) {
      return null;
    }

    try {
      const record = await withStore('readonly', (store) => requestToPromise(store.get(FULL_CATALOG_KEY)), dbOptions);
      if (!record || !isValidCatalogPayload(record.payload)) {
        return null;
      }

      const cachedAt = Number(record.cachedAt);
      const ageMs = now() - cachedAt;
      if (!Number.isFinite(cachedAt) || ageMs < 0 || ageMs > maxAgeMs) {
        await this.clearFullCatalog(dbOptions);
        return null;
      }

      return record.payload;
    } catch (error) {
      return null;
    }
  },

  async clearFullCatalog({ indexedDBImpl } = {}) {
    const dbOptions = indexedDBImpl === undefined ? {} : { indexedDBImpl };
    if (!this.isAvailable(dbOptions)) {
      return false;
    }

    try {
      await withStore('readwrite', (store) => requestToPromise(store.delete(FULL_CATALOG_KEY)), dbOptions);
      return true;
    } catch (error) {
      return false;
    }
  }
};

export {
  CatalogCache,
  DEFAULT_MAX_AGE_MS,
  FULL_CATALOG_KEY,
  isValidCatalogPayload
};
