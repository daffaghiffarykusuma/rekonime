import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Python catalog builder owns build internals instead of delegating to JS builder', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'tools', 'build_catalogs.py'), 'utf8');

  assert.doesNotMatch(source, /build-catalogs\.js/);
  assert.match(source, /def normalize_anime/);
  assert.match(source, /def build_score_profile/);
  assert.match(source, /def calculate_all_stats/);
  assert.match(source, /def build_catalogs/);
});
