import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Stats } from '../../src/features/discovery/stats.ts';

// The real-catalog contract test rarely reaches tied breakpoints, values outside the table,
// invalid tables, or catalogs below the five-title minimum. This pins those Python branches
// to the browser implementation directly.

const series = (scores) => scores.map((score, i) => ({ episode: i + 1, score }));
const identity = Array.from({ length: 101 }, (_, k) => k);
const tied = identity.map(k => (k < 40 ? k : k <= 60 ? 50 : k));
const flat = new Array(101).fill(70);
const tables = { identity, tied, flat };
const raws = [-1, 0, 12.34, 39.5, 50, 70, 99.99, 100, 101];
const invalidTables = [identity.slice(0, 100), identity.map((v, k) => (k === 50 ? 10 : v)), identity.map((v, k) => (k === 100 ? 101 : v))];
const rawLists = [[90, 80, 70, 60], [90, 80, 80, 80, 70.5, 100, 100], [88.123, 91.456, 73.2, 95, 85.5, 85.5]];
const catalog = [
  { id: 'twin-a', episodes: series([4.6, 4.5, 4.7, 4.4, 4.6, 4.8, 4.5, 4.6, 4.7, 4.9, 4.8, 4.9]) },
  { id: 'twin-b', episodes: series([4.6, 4.5, 4.7, 4.4, 4.6, 4.8, 4.5, 4.6, 4.7, 4.9, 4.8, 4.9]) },
  { id: 'perfect', episodes: series(new Array(12).fill(5)) },
  { id: 'slump', episodes: series([4.3, 4.2, 4.1, 3.6, 3.5, 3.4, 3.6, 3.9, 4.0, 4.1, 3.9, 3.8]) },
  { id: 'single', episodes: series([5]) },
  { id: 'late-only', episodes: [{ episode: 10, score: 4.5 }, { episode: 11, score: 4.5 }, { episode: 12, score: 4.5 }], episodeCount: 12 },
  { id: 'unrated', episodes: [] }
];
const strengthCases = [[0, 1], [37.5, 0.25], [80, 0.5], [100, 1], [55.55, 0.91], [50.004, 1], [49.996, 1], [50.0051, 1]];

const browserResults = () => {
  const profile = Stats.buildScoreProfile(catalog);
  return {
    percentiles: Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, raws.map(raw => Stats.rawToCatalogPercentile(raw, table))])),
    valid: [identity, ...invalidTables].map(table => Stats.isValidStrengthQuantiles(table)),
    quantiles: rawLists.map(list => Stats.buildStrengthQuantiles(list)),
    profile,
    strengths: catalog.map(anime => Stats.calculateAllStats(anime, profile).retentionScore),
    withoutTable: strengthCases.map(([raw, weight]) => Stats.calculateRatingStrength(raw, weight, Stats.defaultScoreProfile)),
    withTable: strengthCases.map(([raw, weight]) => Stats.calculateRatingStrength(raw, weight, { strengthQuantiles: tied }))
  };
};

const pythonScript = `
import json, sys
sys.path.insert(0, sys.argv[1])
import build_catalogs as b
cases = json.loads(open(sys.argv[2], encoding="utf-8").read())
profile = b.build_score_profile(cases["catalog"])
print(json.dumps({
    "percentiles": {name: [b.raw_to_catalog_percentile(raw, table) for raw in cases["raws"]] for name, table in cases["tables"].items()},
    "valid": [b.is_valid_strength_quantiles(table) for table in [cases["tables"]["identity"], *cases["invalidTables"]]],
    "quantiles": [b.build_strength_quantiles(values) for values in cases["rawLists"]],
    "profile": profile,
    "strengths": [b.calculate_all_stats(anime, profile)["retentionScore"] for anime in cases["catalog"]],
    "withoutTable": [b.calculate_rating_strength(raw, weight, dict(b.DEFAULT_SCORE_PROFILE)) for raw, weight in cases["strengthCases"]],
    "withTable": [b.calculate_rating_strength(raw, weight, {"strengthQuantiles": cases["tables"]["tied"]}) for raw, weight in cases["strengthCases"]],
}))
`;

test('Python strength ranking matches the browser on ties, bounds, invalid tables, and small catalogs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-strength-parity-'));
  let output;
  try {
    const scriptPath = path.join(dir, 'strength_parity.py');
    const casesPath = path.join(dir, 'cases.json');
    fs.writeFileSync(scriptPath, pythonScript);
    fs.writeFileSync(casesPath, JSON.stringify({ tables, raws, invalidTables, rawLists, catalog, strengthCases }));
    output = execFileSync('bun', ['tools/run-python.js', scriptPath, path.join(process.cwd(), 'tools'), casesPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const python = JSON.parse(output);
  const browser = browserResults();

  assert.deepEqual(python, JSON.parse(JSON.stringify(browser)));
  assert.equal(browser.quantiles[0], null, 'fewer than five titles build no table');
  assert.equal(new Set(browser.profile.strengthQuantiles).size < 101, true, 'the twin series produce tied breakpoints');
  assert.equal(browser.strengths[0], browser.strengths[1]);
  assert.equal(browser.strengths.at(-1), 0);
});
