import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQualityReport, runQualityGates } from '../../tools/lib/quality-reporter.js';

test('buildQualityReport summarizes stats and validation', () => {
  const report = buildQualityReport({
    anime: [
      { episodes: [{ episode: 1, score: 4 }, { episode: 2, score: 4 }] },
      { episodes: [] }
    ],
    validation: {
      errors: [{ animeId: 'a', field: 'id', message: 'Missing id', severity: 'error' }],
      warnings: [{ animeId: 'b', field: 'episodes', message: 'Missing episodes', severity: 'warning' }]
    },
    integrityIssues: [],
    scoreProfile: { p35: 3.2, p50: 3.6, p65: 4.0, sampleSize: 10 },
    durationMs: 1234
  });

  assert.equal(report.stats.totalAnime, 2);
  assert.equal(report.stats.totalEpisodes, 2);
  assert.equal(report.validation.schemaErrors, 1);
  assert.equal(report.validation.schemaWarnings, 1);
});

test('runQualityGates flags low sample size in strict mode', () => {
  const report = buildQualityReport({
    anime: [{ episodes: [{ episode: 1, score: 4 }] }],
    validation: { errors: [], warnings: [] },
    integrityIssues: [],
    scoreProfile: { p35: 3.2, p50: 3.6, p65: 4.0, sampleSize: 10 },
    durationMs: 10
  });
  const gates = runQualityGates(report, { strict: true });
  assert.ok(gates.some(gate => gate.name === 'minSampleSize' && gate.severity === 'error'));
});
