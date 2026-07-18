import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../../js/services/schema-validator.js';

test('SchemaValidator validates enum schemas', () => {
  assert.equal(SchemaValidator.validate('rekonime.theme', 'dark'), true);
  assert.equal(SchemaValidator.validate('rekonime.theme', 'light'), true);
  assert.equal(SchemaValidator.validate('rekonime.theme', 'purple'), false);
});

test('SchemaValidator validates legacy watchlist schema', () => {
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', ['one', 'two']), true);
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', ['']), false);
  assert.equal(SchemaValidator.validate('rekonime.bookmarks', 'nope'), false);
});

test('SchemaValidator validates object schemas', () => {
  const ok = { trailerAutoplay: true, dataSaver: false };
  const bad = { trailerAutoplay: 'yes' };
  assert.equal(SchemaValidator.validate('rekonime.settings', ok), true);
  assert.equal(SchemaValidator.validate('rekonime.settings', bad), false);
});

test('SchemaValidator validates watchlist schema', () => {
  const now = Date.now();
  const ok = {
    version: 1,
    updatedAt: now,
    entries: [
      {
        id: 'anime-1',
        status: 'planned',
        progress: 0,
        updatedAt: now,
        snapshot: {
          id: 'anime-1',
          title: 'Anime 1',
          cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
          year: null,
          studio: 'Studio A'
        }
      }
    ]
  };
  const bad = {
    version: 1,
    entries: [
      { id: '', status: 'nope', progress: 'x', updatedAt: now }
    ]
  };
  assert.equal(SchemaValidator.validate('rekonime.watchlist', ok), true);
  assert.equal(SchemaValidator.validate('rekonime.watchlist', bad), false);
});

test('SchemaValidator validates union types and null values', () => {
  const now = Date.now();
  const numericYear = {
    version: 1,
    updatedAt: now,
    entries: [{
      id: 'anime-1',
      status: 'planned',
      progress: 0,
      updatedAt: now,
      snapshot: {
        id: 'anime-1',
        title: 'Anime 1',
        cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
        year: 2024,
        studio: 'Studio A'
      }
    }]
  };
  const invalidYear = {
    version: 1,
    updatedAt: now,
    entries: [{
      id: 'anime-1',
      status: 'planned',
      progress: 0,
      updatedAt: now,
      snapshot: {
        id: 'anime-1',
        title: 'Anime 1',
        cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
        year: { bad: true },
        studio: 'Studio A'
      }
    }]
  };

  assert.equal(SchemaValidator.validate('rekonime.watchlist', numericYear), true);
  assert.equal(SchemaValidator.validate('rekonime.watchlist', invalidYear), false);
});

test('SchemaValidator validates jikan review payload shape', () => {
  assert.equal(SchemaValidator.validate('api.jikan.reviews', { data: [] }), true);
  assert.equal(SchemaValidator.validate('api.jikan.reviews', {}), false);
});
