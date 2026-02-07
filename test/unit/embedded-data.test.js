import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmbeddedData,
  serializeEmbeddedData,
  validateEmbeddedAnimeShape
} from '../../tools/lib/embedded-data.js';

test('embedded data round-trips through serializer and parser', () => {
  const payload = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    scoreProfile: { p35: 4.1, p50: 4.2, p65: 4.3 },
    anime: [{
      id: 'sample',
      title: 'Sample',
      genres: ['Action'],
      themes: ['School'],
      episodes: [{ episode: 1, score: 4.2 }],
      trailer: { id: 'abc', url: 'https://www.youtube.com/watch?v=abc', embedUrl: 'https://www.youtube.com/embed/abc' },
      stats: { retentionScore: 80 }
    }]
  };

  const script = serializeEmbeddedData(payload);
  const parsed = extractEmbeddedData(script);
  assert.deepEqual(parsed, payload);
});

test('embedded shape validation rejects flattened/truncated fields', () => {
  const payload = {
    anime: [{
      id: 'bad',
      title: 'Bad',
      genres: 'Action',
      themes: [],
      episodes: '[]',
      trailer: '@{site=youtube}',
      stats: '@{retentionScore=80}'
    }]
  };

  const result = validateEmbeddedAnimeShape(payload, { sampleSize: 1 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.includes('.genres')));
  assert.ok(result.errors.some((entry) => entry.includes('.episodes')));
  assert.ok(result.errors.some((entry) => entry.includes('.trailer')));
  assert.ok(result.errors.some((entry) => entry.includes('.stats')));
});
