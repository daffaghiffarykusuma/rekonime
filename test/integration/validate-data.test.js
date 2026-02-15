import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeEmbeddedData } from '../../tools/lib/embedded-data.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rekonime-validate-'));

const createBasePayload = () => ({
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
});

test('validate-data succeeds with valid js/data.js payload', () => {
  const dir = makeTempDir();
  const dataPath = path.join(dir, 'anime.full.json');
  const embeddedPath = path.join(dir, 'data.js');
  const indexPath = path.join(dir, 'index.html');
  const payload = createBasePayload();

  fs.writeFileSync(dataPath, JSON.stringify(payload));
  fs.writeFileSync(embeddedPath, serializeEmbeddedData(payload));
  fs.writeFileSync(indexPath, '<!doctype html><html><body><script type="module" src="/js/main.js"></script></body></html>');

  const scriptPath = path.join(process.cwd(), 'tools', 'validate-data.js');
  execFileSync(process.execPath, [
    scriptPath,
    '--data',
    dataPath,
    '--embedded',
    embeddedPath,
    '--index',
    indexPath
  ]);
});

test('validate-data fails when js/data.js payload is malformed', () => {
  const dir = makeTempDir();
  const dataPath = path.join(dir, 'anime.full.json');
  const embeddedPath = path.join(dir, 'data.js');
  const indexPath = path.join(dir, 'index.html');
  const payload = createBasePayload();

  fs.writeFileSync(dataPath, JSON.stringify(payload));
  fs.writeFileSync(embeddedPath, 'const ANIME_DATA={"anime":[{"id":"bad","title":"Bad","genres":"Action","themes":[],"episodes":"[]","trailer":"bad","stats":"bad"}]};');
  fs.writeFileSync(indexPath, '<!doctype html><html><body><script type="module" src="/js/main.js"></script></body></html>');

  const scriptPath = path.join(process.cwd(), 'tools', 'validate-data.js');
  let failed = false;
  try {
    execFileSync(process.execPath, [
      scriptPath,
      '--data',
      dataPath,
      '--embedded',
      embeddedPath,
      '--index',
      indexPath
    ]);
  } catch (error) {
    failed = true;
  }

  assert.equal(failed, true);
});

test('validate-data fails on trailer URLs outside trusted hosts', () => {
  const dir = makeTempDir();
  const dataPath = path.join(dir, 'anime.full.json');
  const embeddedPath = path.join(dir, 'data.js');
  const indexPath = path.join(dir, 'index.html');
  const payload = createBasePayload();

  payload.anime[0].trailer.url = 'https://youtube.com.evil.example/watch?v=abc123';
  payload.anime[0].trailer.embedUrl = 'https://youtube.com.evil.example/embed/abc123';

  fs.writeFileSync(dataPath, JSON.stringify(payload));
  fs.writeFileSync(embeddedPath, serializeEmbeddedData(payload));
  fs.writeFileSync(indexPath, '<!doctype html><html><body><script type="module" src="/js/main.js"></script></body></html>');

  const scriptPath = path.join(process.cwd(), 'tools', 'validate-data.js');
  let failed = false;
  try {
    execFileSync(process.execPath, [
      scriptPath,
      '--data',
      dataPath,
      '--embedded',
      embeddedPath,
      '--index',
      indexPath
    ]);
  } catch (error) {
    failed = true;
  }

  assert.equal(failed, true);
});
