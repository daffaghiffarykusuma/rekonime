import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const findPython = () => {
  const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return '';
};

test('pipeline parity contract owns fixture and trailer vectors', () => {
  const python = findPython();
  assert.notEqual(python, '', 'Python is required for the pipeline parity contract test');

  const output = execFileSync(python, [
    '-c',
    [
      'import json, sys',
      'sys.path.insert(0, "tools")',
      'import pipeline_parity_contract as c',
      'payload = {"manifest": c.contract_manifest(), "anime": c.representative_catalog_input()["anime"], "vectors": c.trailer_policy_vectors()}',
      'print(json.dumps(payload))'
    ].join(';')
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  const payload = JSON.parse(output);
  assert.equal(payload.manifest.generatedBy, 'tools/pipeline_parity_contract.py');
  assert.equal(payload.anime.length, 2);
  assert.equal(payload.vectors.some((vector) => vector.valid === false), true);
});
