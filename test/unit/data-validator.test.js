import test from 'node:test';
import assert from 'node:assert/strict';
import { DataValidator } from '../../js/services/data-validator.js';

test('DataValidator reports invalid items in sample', () => {
  const catalog = [
    { id: 'one', title: 'One', cover: 'cover.jpg' },
    { id: '', title: 'Two', cover: '' }
  ];

  const stats = DataValidator.validateCatalog(catalog, { source: 'test' });
  assert.equal(stats.total, 2);
  assert.equal(stats.checked, 2);
  assert.equal(stats.invalid, 1);
});
