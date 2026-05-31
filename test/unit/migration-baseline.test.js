import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

test('migration baseline exposes a Bun-first TypeScript typecheck gate', () => {
  const packageJson = readJson('package.json');
  const ciMatrix = readText('docs/ci-local-matrix.md');
  const ciWorkflow = readText('.github/workflows/ci.yml');

  assert.equal(packageJson.scripts?.typecheck, 'bunx tsc --noEmit');
  assert.match(ciMatrix, /TypeScript typecheck \| `bun run typecheck` \| Yes/);
  assert.match(ciWorkflow, /name: TypeScript typecheck\s+run: bun --silent run typecheck/);
});

test('migration baseline makes Python availability explicit in CI', () => {
  const ciWorkflow = readText('.github/workflows/ci.yml');

  assert.match(ciWorkflow, /uses: actions\/setup-python@v\d+/);
  assert.match(ciWorkflow, /python-version: ['"]?3\.11['"]?/);
  assert.ok(ciWorkflow.indexOf('Setup Python') < ciWorkflow.indexOf('Python migration golden fixtures'));
});

test('migration baseline documents Node compatibility exceptions with removal conditions', () => {
  const inventory = readJson('docs/node-compatibility-exceptions.json');

  assert.ok(Array.isArray(inventory.exceptions));
  assert.ok(inventory.exceptions.length > 0);

  for (const entry of inventory.exceptions) {
    assert.equal(typeof entry.command, 'string');
    assert.equal(typeof entry.reason, 'string');
    assert.equal(typeof entry.owner, 'string');
    assert.equal(typeof entry.removalCondition, 'string');
    assert.ok(entry.command.length > 0);
    assert.ok(entry.reason.length > 0);
    assert.ok(entry.owner.length > 0);
    assert.ok(entry.removalCondition.length > 0);
  }
});

test('migration baseline records measured critical paths and the regression budget', () => {
  const baseline = readText('docs/migration-baseline-2026-05-31.md');

  [
    'data validation',
    'catalog build/regenerate',
    'scraper tests',
    'build verification',
    'bundle size',
    'initial load',
    'preview render',
    'detail-modal latency',
    'watchlist interaction latency',
    'Lighthouse performance',
    'Lighthouse accessibility'
  ].forEach((label) => {
    assert.match(baseline, new RegExp(label, 'i'));
  });

  assert.match(baseline, /5% slowdown/i);
  assert.match(baseline, /Facts/i);
  assert.match(baseline, /Assumptions/i);
  assert.match(baseline, /Unknowns/i);
});
