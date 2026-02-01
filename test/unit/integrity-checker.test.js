import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReferentialIntegrity } from '../../tools/lib/integrity-checker.js';

test('checkReferentialIntegrity reports duplicate malId', () => {
  const data = [
    {
      metadata: { id: 'a', malId: 100, episodes_count: 1 },
      episodes: [{ episode: 1, score: 4 }]
    },
    {
      metadata: { id: 'b', malId: 100, episodes_count: 1 },
      episodes: [{ episode: 1, score: 4 }]
    }
  ];
  const issues = checkReferentialIntegrity(data);
  assert.ok(issues.some(issue => issue.field === 'malId' && issue.severity === 'error'));
});

test('checkReferentialIntegrity reports episode count mismatches', () => {
  const data = [
    {
      metadata: { id: 'a', episodes_count: 3 },
      episodes: [{ episode: 1, score: 4 }]
    }
  ];
  const issues = checkReferentialIntegrity(data);
  assert.ok(issues.some(issue => issue.field === 'metadata.episodes_count' && issue.severity === 'warning'));
});
