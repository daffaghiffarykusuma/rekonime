import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogCache } from '../../js/services/catalog-cache.ts';

const createRequest = (executor) => {
  const request = {
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null
  };

  setTimeout(() => {
    try {
      executor(request);
    } catch (error) {
      request.error = error;
      request.onerror?.();
    }
  }, 0);

  return request;
};

const createFakeIndexedDB = () => {
  const stores = new Map();

  const createDb = () => ({
    objectStoreNames: {
      contains: (name) => stores.has(name)
    },
    createObjectStore: (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return stores.get(name);
    },
    transaction: (name) => ({
      objectStore: () => {
        if (!stores.has(name)) stores.set(name, new Map());
        const data = stores.get(name);
        return {
          put: (record) => createRequest((request) => {
            data.set(record.id, record);
            request.result = record.id;
            request.onsuccess?.();
          }),
          get: (key) => createRequest((request) => {
            request.result = data.get(key);
            request.onsuccess?.();
          }),
          delete: (key) => createRequest((request) => {
            data.delete(key);
            request.result = undefined;
            request.onsuccess?.();
          })
        };
      }
    }),
    close: () => {}
  });

  return {
    open: () => createRequest((request) => {
      const needsUpgrade = !stores.has('catalogs');
      request.result = createDb();
      if (needsUpgrade) {
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    })
  };
};

const payload = {
  generatedAt: '2026-05-18T00:00:00.000Z',
  anime: [
    {
      id: 'alpha',
      title: 'Alpha'
    }
  ]
};

test('CatalogCache stores and reads the full catalog from IndexedDB', async () => {
  const indexedDBImpl = createFakeIndexedDB();

  const stored = await CatalogCache.putFullCatalog(payload, {
    indexedDBImpl,
    now: () => 1000
  });
  const cached = await CatalogCache.getFullCatalog({
    indexedDBImpl,
    now: () => 2000
  });

  assert.equal(stored, true);
  assert.deepEqual(cached, payload);
});

test('CatalogCache ignores stale full catalog entries', async () => {
  const indexedDBImpl = createFakeIndexedDB();

  await CatalogCache.putFullCatalog(payload, {
    indexedDBImpl,
    now: () => 1000
  });
  const cached = await CatalogCache.getFullCatalog({
    indexedDBImpl,
    now: () => 5000,
    maxAgeMs: 1000
  });

  assert.equal(cached, null);
});

test('CatalogCache rejects invalid catalog payloads', async () => {
  const indexedDBImpl = createFakeIndexedDB();

  const stored = await CatalogCache.putFullCatalog({ anime: [{ id: 'bad' }] }, { indexedDBImpl });
  const cached = await CatalogCache.getFullCatalog({ indexedDBImpl });

  assert.equal(stored, false);
  assert.equal(cached, null);
});

test('CatalogCache is a no-op when IndexedDB is unavailable', async () => {
  const stored = await CatalogCache.putFullCatalog(payload, { indexedDBImpl: null });
  const cached = await CatalogCache.getFullCatalog({ indexedDBImpl: null });

  assert.equal(stored, false);
  assert.equal(cached, null);
});
