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
    '--no-strict',
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

test('build-catalogs strict mode fails quality gates on undersized corpus', () => {
  const dir = makeTempDir();
  const inputPath = path.join(dir, 'anime.json');
  const fullPath = path.join(dir, 'anime.full.json');
  const previewPath = path.join(dir, 'anime.preview.json');

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
  let failed = false;
  try {
    execFileSync(process.execPath, [scriptPath, inputPath, fullPath, previewPath]);
  } catch (error) {
    failed = true;
  }

  assert.equal(failed, true);
});

test('build-catalogs disambiguates duplicate ids with MAL ids', () => {
  const dir = makeTempDir();
  const inputPath = path.join(dir, 'anime.json');
  const fullPath = path.join(dir, 'anime.full.json');
  const previewPath = path.join(dir, 'anime.preview.json');

  const payload = {
    anime: [
      {
        id: 'duplicate-id',
        malId: 101,
        title: 'Alpha',
        cover: 'https://example.com/alpha.jpg',
        episodes: [
          { episode: 1, score: 4.2 },
          { episode: 2, score: 4.1 }
        ]
      },
      {
        id: 'duplicate-id',
        malId: 202,
        title: 'Beta',
        cover: 'https://example.com/beta.jpg',
        episodes: [
          { episode: 1, score: 4.4 },
          { episode: 2, score: 4.3 }
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
    '--no-strict'
  ]);

  const full = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  assert.deepEqual(full.anime.map((entry) => entry.id), ['duplicate-id', 'duplicate-id-202']);
});

test('build-catalogs attaches franchise metadata from a shared franchise map', () => {
  const dir = makeTempDir();
  const inputPath = path.join(dir, 'anime.json');
  const fullPath = path.join(dir, 'anime.full.json');
  const previewPath = path.join(dir, 'anime.preview.json');
  const franchisePath = path.join(dir, 'franchise-map.json');

  const payload = {
    anime: [
      {
        id: 'alpha',
        anilistId: 101,
        title: 'Alpha',
        cover: 'https://example.com/alpha.jpg',
        episodes: [
          { episode: 1, score: 4.2 },
          { episode: 2, score: 4.1 }
        ]
      }
    ]
  };

  const franchiseMap = {
    franchises: {
      'alpha-franchise': {
        id: 'alpha-franchise',
        title: 'Alpha',
        mode: 'linear',
        entryAnimeId: 'alpha',
        entryTitle: 'Alpha',
        totalCount: 2,
        catalogCount: 1,
        mainCount: 2,
        items: [
          {
            animeId: 'alpha',
            externalKey: null,
            title: 'Alpha',
            year: 2024,
            format: 'TV',
            bucket: 'main',
            relationType: 'ENTRY',
            isEntry: true,
            isInCatalog: true,
            anchorAnimeId: null,
            anchorTitle: '',
            mainOrder: 1,
            order: 1
          }
        ]
      }
    },
    byAnimeId: {
      alpha: 'alpha-franchise'
    }
  };

  fs.writeFileSync(inputPath, JSON.stringify(payload));
  fs.writeFileSync(franchisePath, JSON.stringify(franchiseMap));

  const scriptPath = path.join(process.cwd(), 'tools', 'build-catalogs.js');
  execFileSync(process.execPath, [
    scriptPath,
    inputPath,
    fullPath,
    previewPath,
    '--no-strict',
    '--franchise-map',
    franchisePath
  ]);

  const full = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  assert.equal(full.anime[0].franchise?.id, 'alpha-franchise');
  assert.equal(full.anime[0].franchise?.entryAnimeId, 'alpha');
});
