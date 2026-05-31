import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('data:regenerate command preserves embedded data output through migration launcher', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['data:regenerate'], /run-regenerate-data\.js/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-regenerate-'));
  const inputPath = path.join(dir, 'anime.preview.json');
  const outputPath = path.join(dir, 'data.js');
  const payload = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    scoreProfile: { p35: 4, p50: 4.1, p65: 4.2, sampleSize: 1, source: 'fixture' },
    anime: [{
      id: 'alpha',
      title: 'Alpha',
      genres: [],
      themes: [],
      episodes: [],
      trailer: null,
      stats: {}
    }]
  };

  fs.writeFileSync(inputPath, JSON.stringify(payload));
  execFileSync('bun', ['run', 'data:regenerate', '--', '--input', inputPath, '--output', outputPath], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  assert.equal(fs.readFileSync(outputPath, 'utf8'), `const ANIME_DATA=${JSON.stringify(payload)};`);
});
