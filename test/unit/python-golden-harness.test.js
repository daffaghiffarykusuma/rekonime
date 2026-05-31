import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Python golden fixture harness runs through the Bun command surface', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(typeof packageJson.scripts['test:golden'], 'string');

  execFileSync('bun', ['run', 'test:golden'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
});

test('Python golden fixture harness exercises Python catalog build outputs', () => {
  const harness = fs.readFileSync(path.join(process.cwd(), 'tools', 'python_golden_harness.py'), 'utf8');

  assert.match(harness, /tools\/build_catalogs\.py/);
  assert.doesNotMatch(harness, /tools\/build-catalogs\.js/);
});
