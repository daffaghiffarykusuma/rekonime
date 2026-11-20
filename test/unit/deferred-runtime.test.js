import test from 'node:test';
import assert from 'node:assert/strict';
import { RETIRED_STORAGE_KEYS, removeRetiredStorageKeys } from '../../src/app/bootstrap/deferred-runtime.js';

test('retired preferences are removed and live ones are kept', () => {
  const store = new Map([['rekonime.theme', 'light'], ['rekonime.watchlist', '{}']]);
  const storage = { removeItem: key => store.delete(key) };

  removeRetiredStorageKeys(storage);

  assert.deepEqual(RETIRED_STORAGE_KEYS, ['rekonime.theme']);
  assert.equal(store.has('rekonime.theme'), false);
  assert.equal(store.get('rekonime.watchlist'), '{}');
});

test('retired preference cleanup tolerates unavailable storage', () => {
  assert.doesNotThrow(() => removeRetiredStorageKeys({ removeItem: () => { throw new Error('blocked'); } }));
  assert.doesNotThrow(() => removeRetiredStorageKeys(null));
});
