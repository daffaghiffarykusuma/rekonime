import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('catalog build command is exposed through a Python-capable Bun launcher', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['data:build'], /^bun tools\/run-build-catalogs\.js$/);
  assert.equal(fs.existsSync(path.join(process.cwd(), 'tools', 'build_catalogs.py')), true);
});

test('data:build launcher preserves catalog output behavior', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-build-launcher-'));
  const inputPath = path.join(dir, 'anime.json');
  const fullPath = path.join(dir, 'anime.full.json');
  const previewPath = path.join(dir, 'anime.preview.json');
  const payload = {
    anime: [{
      id: 'alpha',
      title: 'Alpha',
      cover: 'https://example.com/alpha.jpg',
      episodes: [
        { episode: 1, score: 4.2 },
        { episode: 2, score: 4.1 }
      ]
    }]
  };

  fs.writeFileSync(inputPath, JSON.stringify(payload));
  execFileSync('bun', [
    'run',
    'data:build',
    '--',
    inputPath,
    fullPath,
    previewPath,
    '--no-strict'
  ], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  const full = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
  assert.equal(full.anime.length, 1);
  assert.equal(preview.anime.length, 1);
  assert.equal(full.anime[0].stats.average, 4.15);
});
