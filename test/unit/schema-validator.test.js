import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../../js/services/schema-validator.js';

test('SchemaValidator validates enum schemas', () => {
  assert.equal(SchemaValidator.validate('rekonime.theme', 'dark'), true);
  assert.equal(SchemaValidator.validate('rekonime.theme', 'light'), true);
  assert.equal(SchemaValidator.validate('rekonime.theme', 'purple'), false);
});

test('SchemaValidator validates array schemas', () => {
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', ['one', 'two']), true);
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', ['']), false);
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', 'nope'), false);
});

test('SchemaValidator validates pattern schemas', () => {
  assert.equal(SchemaValidator.validate('rekonime.tourStep', '3'), true);
  assert.equal(SchemaValidator.validate('rekonime.tourStep', '03'), true);
  assert.equal(SchemaValidator.validate('rekonime.tourStep', 'abc'), false);
});

test('SchemaValidator validates object schemas', () => {
  const ok = { trailerAutoplay: true, dataSaver: false };
  const bad = { trailerAutoplay: 'yes' };
  assert.equal(SchemaValidator.validate('rekonime.settings', ok), true);
  assert.equal(SchemaValidator.validate('rekonime.settings', bad), false);
});

test('SchemaValidator validates jikan review payload shape', () => {
  assert.equal(SchemaValidator.validate('api.jikan.reviews', { data: [] }), true);
  assert.equal(SchemaValidator.validate('api.jikan.reviews', {}), false);
});
