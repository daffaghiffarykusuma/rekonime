import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../../tools/lib/schema-validator.js';

test('validateCatalog reports missing required fields', () => {
  const data = [
    { title: 'No ID', episodes: [{ episode: 1, score: 4.2 }] }
  ];
  const result = validateCatalog(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.field === 'id'));
});

test('validateCatalog warns on missing episodes', () => {
  const data = [
    { id: 'a', title: 'Title', cover: 'https://example.com/cover.jpg' }
  ];
  const result = validateCatalog(data);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some(warning => warning.field === 'episodes'));
});

test('validateCatalog detects duplicate ids', () => {
  const data = [
    { id: 'dup', title: 'One', cover: 'https://example.com/1.jpg', episodes: [{ episode: 1, score: 4 }] },
    { id: 'dup', title: 'Two', cover: 'https://example.com/2.jpg', episodes: [{ episode: 1, score: 4 }] }
  ];
  const result = validateCatalog(data);
  assert.ok(result.errors.some(error => error.message.includes('Duplicate id')));
});

test('validateCatalog flags episode gaps as warnings by default', () => {
  const data = [
    {
      id: 'gap',
      title: 'Gap Show',
      cover: 'https://example.com/cover.jpg',
      episodes: [
        { episode: 1, score: 4 },
        { episode: 3, score: 4 }
      ]
    }
  ];
  const result = validateCatalog(data);
  assert.ok(result.warnings.some(warning => warning.message.includes('gaps')));
});
