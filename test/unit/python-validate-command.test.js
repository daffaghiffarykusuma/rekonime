import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('data validation package scripts use the Python-capable launcher', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(packageJson.scripts['data:validate'], /^bun tools\/run-python\.js tools\/validate_data\.py --enforce-baseline/);
  assert.equal(packageJson.scripts['data:validate:strict'], 'bun tools/run-python.js tools/validate_data.py');
});

test('data:validate:strict launcher preserves validation behavior', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-validate-launcher-'));
  const dataPath = path.join(dir, 'anime.full.json');
  const embeddedPath = path.join(dir, 'data.js');
  const indexPath = path.join(dir, 'index.html');
  const payload = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    scoreProfile: { p35: 4.1, p50: 4.2, p65: 4.3, sampleSize: 1000, source: 'test' },
    anime: [{
      id: 'alpha',
      title: 'Alpha',
      cover: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
      year: 2024,
      season: 'Spring',
      studio: 'Studio A',
      source: 'Manga',
      score: 8.1,
      anilistId: 123,
      genres: ['Action'],
      themes: ['School'],
      episodes: [{ episode: 1, score: 4.2 }],
      trailer: {
        id: 'abc123',
        url: 'https://www.youtube.com/watch?v=abc123',
        embedUrl: 'https://www.youtube.com/embed/abc123'
      },
      stats: { retentionScore: 80 }
    }]
  };

  fs.writeFileSync(dataPath, JSON.stringify(payload));
  fs.writeFileSync(embeddedPath, `const ANIME_DATA=${JSON.stringify(payload)};`);
  fs.writeFileSync(indexPath, '<!doctype html><html><body><script type="module" src="/js/main.ts"></script></body></html>');

  execFileSync('bun', [
    'run',
    'data:validate:strict',
    '--',
    '--data',
    dataPath,
    '--embedded',
    embeddedPath,
    '--index',
    indexPath
  ], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });
});
