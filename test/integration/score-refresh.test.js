import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('refresh CLI saves partial successes and retains values for failed requests', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rekonime-refresh-test-'));
  const dataPath = path.join(directory, 'anime.json');
  const initial = { anime: [1, 2].map((id) => ({
    mal_id: id, metadata: { id: `title-${id}`, score: 7, episodes_count: 1 },
    episodes: [{ episode: 1, score: 3 }]
  })) };
  const mock = `
    globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0; };
    globalThis.fetch = async (url) => {
      if (url.includes('api.jikan.moe/v4/anime/1')) return Response.json({ data: { score: 8 } });
      if (url.includes('/anime/2/') && url.endsWith('/episode')) {
        return new Response('<tr class="episode-list-data"><td class="episode-number" data-raw="1"></td><td class="episode-poll" data-raw="4"></td></tr>');
      }
      throw new Error('fixture failure');
    };
  `;
  try {
    writeFileSync(dataPath, JSON.stringify(initial));
    const output = execFileSync('node', [
      '--import', `data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`,
      fileURLToPath(new URL('../../tools/refresh-scores.js', import.meta.url)),
      '--data', dataPath, '--mal-delay-ms', '0', '--jikan-delay-ms', '0', '--save-interval', '1'
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
    assert.equal(saved.anime[0].metadata.score, 8);
    assert.deepEqual(saved.anime[0].episodes, initial.anime[0].episodes);
    assert.equal(saved.anime[1].metadata.score, 7);
    assert.deepEqual(saved.anime[1].episodes, [{ episode: 1, score: 4 }]);
    assert.match(output, /Community score errors: 1/);
    assert.match(output, /Episode errors: 1/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('seasonal wrapper refreshes Fall and Summer directly from MAL', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rekonime-season-test-'));
  const dataPath = path.join(directory, 'anime.json');
  const mockPath = path.join(directory, 'fetch.mjs');
  const initial = { anime: ['Fall', 'Summer', 'Spring'].map((season, index) => ({
    mal_id: index + 1,
    metadata: { id: `title-${index + 1}`, season, year: 2026, score: 7 },
    episodes: []
  })) };
  try {
    writeFileSync(dataPath, JSON.stringify(initial));
    writeFileSync(mockPath, `
      globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0; };
      globalThis.fetch = async (url) => {
        if (url.includes('jikan')) throw new Error('Jikan must not be called');
        if (url.endsWith('/episode')) return new Response('<tr class="episode-list-data"><td class="episode-number" data-raw="1"></td><td class="episode-poll" data-raw="4"></td></tr>');
        return new Response('<span itemprop="ratingValue">8.5</span>');
      };
    `);
    const output = execFileSync('node', [
      fileURLToPath(new URL('../../tools/refresh-season-scores.js', import.meta.url)),
      '--data', dataPath, '--date', '2026-10-04', '--skip-build',
      '--score-source', 'mal', '--mal-delay-ms', '0'
    ], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(mockPath).href}` }
    });
    const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
    assert.match(output, /Seasons: Fall 2026, Summer 2026/);
    assert.match(output, /Community score source: mal/);
    assert.match(output, /Community score errors: 0/);
    for (const anime of saved.anime.slice(0, 2)) {
      assert.equal(anime.metadata.score, 8.5);
      assert.deepEqual(anime.episodes, [{ episode: 1, score: 4 }]);
    }
    assert.deepEqual(saved.anime[2], initial.anime[2]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
