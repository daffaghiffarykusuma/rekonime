import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runCli = (command, mockPath, args) => execFileSync(
  command === 'refresh-season-scores.js' ? 'bun' : 'node',
  [command === 'refresh-season-scores.js' ? '--preload' : '--import',
    command === 'refresh-season-scores.js' ? mockPath : pathToFileURL(mockPath).href,
    fileURLToPath(new URL('../../tools/' + command, import.meta.url)), ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }
);

// Process tests cover CLI wiring; workflow outcomes use injected adapters in score-refresh-run.test.js.
for (const command of ['refresh-scores.js', 'refresh-season-scores.js']) {
  for (const stopMode of ['blocked', 'SIGINT', 'SIGTERM']) {
    test(`${command} saves completed work and reports a safe resume point when ${stopMode}`, () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'rekonime-refresh-block-'));
      const dataPath = path.join(directory, 'anime.json');
      const mockPath = path.join(directory, 'fetch.mjs');
      const initial = { anime: [1, 2, 3].map((id) => ({
        mal_id: id, metadata: { id: `title-${id}`, score: 7, season: 'Fall', year: 2026 },
        episodes: [{ episode: 1, score: 3 }]
      })) };
      const mock = `
        globalThis.fetch = async (url) => {
          console.log('FETCH ' + url);
          if (url.includes('/anime/2')) {
            if (${JSON.stringify(stopMode)} !== 'blocked') process.emit(${JSON.stringify(stopMode)});
            return new Response('', { status: 403 });
          }
          if (url.includes('api.jikan.moe')) return Response.json({ data: { score: 8 } });
          return new Response('<tr class="episode-list-data"><td class="episode-number" data-raw="1"></td><td class="episode-poll" data-raw="4"></td></tr>');
        };
      `;
      try {
        writeFileSync(dataPath, JSON.stringify(initial));
        let failure;
        try {
          writeFileSync(mockPath, mock);
          runCli(command, mockPath, [
            '--data', dataPath, '--date', '2026-10-04', '--score-source', 'auto',
            '--mal-delay-ms', '0', '--jikan-delay-ms', '0'
          ]);
        } catch (error) { failure = error; }
        assert.equal(failure?.status, stopMode === 'blocked' ? 1 : 130);
        if (stopMode === 'blocked') assert.match(failure.stderr, /Refresh stopped:.*HTTP 403/);
        assert.match(failure.stdout, /MAL delay: 0ms.*Jikan delay: 0ms.*Concurrency: 1/);
        assert.match(failure.stdout, /--start-index 1/);
        assert.doesNotMatch(failure.stdout, /FETCH .*\/anime\/3|Refresh complete|Rebuilding catalog outputs/);
        const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
        assert.equal(saved.anime[0].metadata.score, 8);
        assert.deepEqual(saved.anime[0].episodes, [{ episode: 1, score: 4 }]);
        assert.deepEqual(saved.anime.slice(1), initial.anime.slice(1));
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}

for (const command of ['refresh-scores.js', 'refresh-season-scores.js']) {
  test(`${command} defaults to MAL without making any Jikan requests`, () => {
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
        globalThis.fetch = async (url) => {
          console.log('FETCH ' + url);
          if (url.includes('jikan')) throw new Error('Jikan must not be called');
          if (url.endsWith('/episode')) return new Response('<tr class="episode-list-data"><td class="episode-number" data-raw="1"></td><td class="episode-poll" data-raw="4"></td></tr>');
          return new Response('<span itemprop="ratingValue">8.5</span>');
        };
      `);
      const output = runCli(command, mockPath, [
        '--data', dataPath, '--date', '2026-10-04', '--skip-build', '--mal-delay-ms', '0'
      ]);
      const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
      const seasonal = command === 'refresh-season-scores.js';
      if (seasonal) assert.match(output, /Seasons: Fall 2026, Summer 2026/);
      assert.match(output, /Community score source: mal/);
      assert.doesNotMatch(output, /api\.jikan\.moe|Jikan delay/);
      assert.match(output, /Community score errors: 0/);
      for (const anime of saved.anime.slice(0, seasonal ? 2 : 3)) {
        assert.equal(anime.metadata.score, 8.5);
        assert.deepEqual(anime.episodes, [{ episode: 1, score: 4 }]);
      }
      if (seasonal) assert.deepEqual(saved.anime[2], initial.anime[2]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
