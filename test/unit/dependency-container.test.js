import test from 'node:test';
import assert from 'node:assert/strict';
import { DependencyContainer } from '../../js/core/dependency-container.js';

test('DependencyContainer register/resolve/has', () => {
  DependencyContainer.clear();
  DependencyContainer.register('test', { ok: true });
  assert.equal(DependencyContainer.has('test'), true);
  assert.deepEqual(DependencyContainer.resolve('test'), { ok: true });
});

test('DependencyContainer remove/entries/clear', () => {
  DependencyContainer.clear();
  DependencyContainer.register('a', 1);
  DependencyContainer.register('b', 2);
  assert.equal(DependencyContainer.entries().length, 2);

  DependencyContainer.remove('a');
  assert.equal(DependencyContainer.has('a'), false);

  DependencyContainer.clear();
  assert.equal(DependencyContainer.entries().length, 0);
});
