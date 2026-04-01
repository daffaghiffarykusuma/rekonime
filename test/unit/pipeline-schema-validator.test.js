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

test('validateCatalog keeps missing episodes as warnings in strict mode when allowed', () => {
  const data = [
    { id: 'missing-episodes', title: 'Title', cover: 'https://example.com/cover.jpg', episodes: [] }
  ];
  const result = validateCatalog(data, { strict: true, allowMissingEpisodes: true });
  assert.equal(result.errors.some(error => error.field === 'episodes'), false);
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

test('validateCatalog can allow duplicate ids for downstream disambiguation', () => {
  const data = [
    { id: 'dup', title: 'One', cover: 'https://example.com/1.jpg', episodes: [{ episode: 1, score: 4 }] },
    { id: 'dup', title: 'Two', cover: 'https://example.com/2.jpg', episodes: [{ episode: 1, score: 4 }] }
  ];
  const result = validateCatalog(data, { allowDuplicateIds: true });
  assert.equal(result.errors.some(error => error.message.includes('Duplicate id')), false);
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

test('validateCatalog keeps episode gaps as warnings in strict mode', () => {
  const data = [
    {
      id: 'gap-strict',
      title: 'Gap Show Strict',
      cover: 'https://example.com/cover.jpg',
      episodes: [
        { episode: 2, score: 4 },
        { episode: 4, score: 4.2 }
      ]
    }
  ];
  const result = validateCatalog(data, { strict: true });
  assert.equal(result.errors.some(error => error.message.includes('Episode sequence')), false);
  assert.ok(result.warnings.some(warning => warning.message.includes('Episode sequence')));
});

test('validateCatalog rejects insecure or untrusted trailer URLs', () => {
  const data = [
    {
      id: 'bad-trailer',
      title: 'Bad Trailer',
      cover: 'https://example.com/cover.jpg',
      trailer: {
        url: 'http://youtube.com/watch?v=abc123',
        embedUrl: 'https://youtube.com.evil.example/embed/abc123'
      },
      episodes: [{ episode: 1, score: 4 }]
    }
  ];

  const result = validateCatalog(data, { strict: true, allowMissingTrailer: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.field === 'trailer'));
});
