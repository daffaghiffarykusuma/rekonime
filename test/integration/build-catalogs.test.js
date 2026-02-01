import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-build-'));

test('build-catalogs generates full and preview outputs', () => {
  const dir = makeTempDir();
  const inputPath = path.join(dir, 'anime.json');
  const fullPath = path.join(dir, 'anime.full.json');
  const previewPath = path.join(dir, 'anime.preview.json');
  const reportPath = path.join(dir, 'build-report.json');
  const statePath = path.join(dir, '.build-state.json');

  const payload = {
    anime: [
      {
        id: 'alpha',
        title: 'Alpha',
        cover: 'https://example.com/alpha.jpg',
        episodes: [
          { episode: 1, score: 4.2 },
          { episode: 2, score: 4.1 }
        ]
      }
    ]
  };

  fs.writeFileSync(inputPath, JSON.stringify(payload));

  const scriptPath = path.join(process.cwd(), 'tools', 'build-catalogs.js');
  execFileSync(process.execPath, [
    scriptPath,
    inputPath,
    fullPath,
    previewPath,
    '--report',
    '--report-path',
    reportPath,
    '--state',
    statePath
  ]);

  assert.ok(fs.existsSync(fullPath));
  assert.ok(fs.existsSync(previewPath));
  assert.ok(fs.existsSync(reportPath));

  const full = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  assert.equal(full.anime.length, 1);
});
