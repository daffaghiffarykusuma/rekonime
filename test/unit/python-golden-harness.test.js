import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Python golden fixture harness normalizes CI relative temp paths', () => {
  const harness = fs.readFileSync(path.join(process.cwd(), 'tools', 'python_golden_harness.py'), 'utf8');

  assert.match(harness, /\(\?:\\\.\\\.\/\)\+\\\.\\\.\/tmp\/rekonime-golden/);
  assert.match(harness, /\(\?:\\\.\\\.\/\)\+\\\.\\\.<fixture-workdir>/);
});
