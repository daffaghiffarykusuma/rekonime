import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('pipeline parity contract owns fixture and trailer vectors', () => {
  const output = execFileSync('python', [
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
