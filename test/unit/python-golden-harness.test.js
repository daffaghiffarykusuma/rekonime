import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Python golden fixture harness is exposed through the Bun command surface', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['test:golden'], 'bun tools/run-python-golden-harness.js');
});

test('Python golden fixture harness exercises Python catalog build outputs', () => {
  const harness = fs.readFileSync(path.join(process.cwd(), 'tools', 'python_golden_harness.py'), 'utf8');

  assert.match(harness, /tools\/build_catalogs\.py/);
  assert.doesNotMatch(harness, /tools\/build-catalogs\.js/);
});
