import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('data operation package commands use Python-capable migration launcher', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

  assert.match(packageJson.scripts['test:scraper'], /^bun tools\/run-scraper-tests\.js$/);
  assert.match(packageJson.scripts['data:backup'], /^bun tools\/run-deploy-data\.js backup$/);
  assert.match(packageJson.scripts['data:rollback'], /^bun tools\/run-deploy-data\.js rollback$/);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'tools', 'deploy_data.py')), true);
});

const runScraperLauncherWithoutPython = (extraEnv = {}) => spawnSync(process.execPath, ['tools/run-scraper-tests.js'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: {
    ...process.env,
    PATH: '',
    Path: '',
    CI: '',
    REKONIME_IGNORE_LOCAL_VENV: '1',
    ...extraEnv
  }
});

test('scraper launcher skips missing local Python but fails missing CI Python', () => {
  const local = runScraperLauncherWithoutPython();
  assert.equal(local.status, 0);
  assert.match(local.stderr, /Python interpreter not found; skipping local scraper tests/);

  const ci = runScraperLauncherWithoutPython({ CI: 'true' });
  assert.notEqual(ci.status, 0);
  assert.match(ci.stderr, /Unable to find a Python interpreter for scraper tests/);
});
