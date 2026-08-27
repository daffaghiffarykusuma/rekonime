import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('data operation package commands use Python-capable migration launcher', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

  assert.equal(
    packageJson.scripts['test:scraper'],
    'bun tools/run-python.js -m unittest discover -s tools/scraper/tests -p "test_*.py"'
  );
  assert.equal(packageJson.scripts['data:backup'], 'bun tools/run-python.js tools/deploy_data.py backup');
  assert.equal(packageJson.scripts['data:rollback'], 'bun tools/run-python.js tools/deploy_data.py rollback');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'tools', 'deploy_data.py')), true);
});
