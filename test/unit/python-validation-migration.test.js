import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Python validation and quality reporting internals are present', () => {
  const validatePath = path.join(process.cwd(), 'tools', 'validate_data.py');
  const qualityPath = path.join(process.cwd(), 'tools', 'quality_reporter.py');
  const harnessPath = path.join(process.cwd(), 'tools', 'python_golden_harness.py');

  assert.equal(fs.existsSync(validatePath), true);
  assert.equal(fs.existsSync(qualityPath), true);

  const harness = fs.readFileSync(harnessPath, 'utf8');
  assert.match(harness, /validate_data\.py/);
  assert.match(harness, /quality_reporter/);
});
