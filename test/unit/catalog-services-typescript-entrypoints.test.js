import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/services/api-client.ts';
import { CacheManager } from '../../js/services/cache-manager.ts';
import { isValidCatalogPayload } from '../../js/services/catalog-cache.ts';
import { createCatalogSession } from '../../js/services/catalog-loader.ts';
import { ErrorHandler } from '../../js/services/error-handler.ts';
import { Logger } from '../../js/services/logger.ts';

test('TypeScript Catalog Runtime service entrypoints expose stable service behavior', () => {
  const session = createCatalogSession();
  session.markFullLoaded(true);

  CacheManager.clearMemory();
  CacheManager.setMemory('catalog-service-entrypoint', { ok: true });

  assert.equal(session.isFullLoaded(), true);
  assert.equal(isValidCatalogPayload({ anime: [] }), true);
  assert.deepEqual(CacheManager.getMemory('catalog-service-entrypoint'), { ok: true });
  assert.equal(typeof ApiClient.getJson, 'function');
  assert.equal(typeof ErrorHandler.report, 'function');
  assert.equal(typeof Logger.getSessionId, 'function');
});
