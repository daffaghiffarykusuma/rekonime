import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseScoreRefreshArgs, refreshScores } from '../../tools/refresh-scores.js';

test('score refresh arguments preserve selection, pacing, and safe numeric defaults', () => {
  const defaults = parseScoreRefreshArgs([]);
  assert.equal(defaults.scoreSource, 'mal');
  assert.equal(defaults.concurrency, 1);
  assert.equal(defaults.malDelayMs, 10000);
  const options = parseScoreRefreshArgs([
    '--data', 'fixture.json', '--score-source', 'auto', '--limit', '3',
    '--start-index', '2', '--save-interval', '4', '--mal-delay-ms', '15000',
    '--jikan-delay-ms', '5000', '--concurrency', '2', '--mal-ids', '1,invalid,2,1,-3'
  ]);
  assert.deepEqual(options, {
    ...defaults, dataPath: path.resolve('fixture.json'), scoreSource: 'auto',
    limit: 3, startIndex: 2, saveInterval: 4, malDelayMs: 15000,
    jikanDelayMs: 5000, concurrency: 2, malIds: new Set([1, 2])
  });
  const invalid = parseScoreRefreshArgs([
    '--limit', '0', '--start-index', '-1', '--save-interval', '0',
    '--mal-delay-ms', 'NaN', '--jikan-delay-ms', '-1', '--concurrency', '0',
    '--mal-ids', 'invalid,0,-1'
  ]);
  assert.deepEqual(invalid, { ...defaults, saveInterval: 1 });
  assert.throws(() => parseScoreRefreshArgs(['--score-source', 'invalid']), /must be auto or mal/);
});

// Run the real CLI adapter in this process so coverage includes file persistence,
// reporting, and listener cleanup. Subprocess tests separately verify OS exit/signals.
for (const blocked of [false, true]) {
  test(`score refresh CLI ${blocked ? 'saves partial work and reports a protection stop' : 'persists MAL results and reports completion'}`, async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'rekonime-cli-adapter-'));
    const dataPath = path.join(directory, 'anime.json');
    const initial = { anime: [1, 2, 3].map(mal_id => ({
      mal_id, metadata: { id: `title-${mal_id}`, score: 7 },
      episodes: [{ episode: 1, score: 3 }]
    })) };
    const originalFetch = globalThis.fetch;
    const originalLog = console.log, originalError = console.error;
    const originalExitCode = process.exitCode;
    const listeners = ['SIGINT', 'SIGTERM'].map(signal => [signal, process.listeners(signal)]);
    const output = [], errors = [], urls = [];
    try {
      writeFileSync(dataPath, JSON.stringify(initial));
      globalThis.fetch = async url => {
        urls.push(url);
        if (blocked && url.includes('/anime/2')) return new Response('', { status: 403 });
        return new Response(url.endsWith('/episode')
          ? '<tr class="episode-list-data"><td class="episode-number" data-raw="1"></td><td class="episode-poll" data-raw="4"></td></tr>'
          : '<span itemprop="ratingValue">8.5</span>');
      };
      console.log = message => output.push(String(message));
      console.error = message => errors.push(String(message));
      process.exitCode = 0;
      const result = await refreshScores(parseScoreRefreshArgs([
        '--data', dataPath, '--mal-delay-ms', '0', '--save-interval', '1', '--mal-ids', '1,2'
      ]));
      const saved = JSON.parse(readFileSync(dataPath, 'utf8'));
      assert.equal(saved.anime[0].metadata.score, 8.5);
      assert.deepEqual(saved.anime[0].episodes, [{ episode: 1, score: 4 }]);
      assert.deepEqual(saved.anime[2], initial.anime[2]);
      assert.ok(urls.every(url => url.startsWith('https://myanimelist.net/')));
      assert.match(output.join('\n'), /Community score source: mal/);
      assert.match(output.join('\n'), /Saved progress: 1\/2/);
      assert.doesNotMatch(output.join('\n'), /Jikan delay/);
      if (blocked) {
        assert.equal(result.status, 'stopped');
        assert.equal(process.exitCode, 1);
        assert.deepEqual(saved.anime[1], initial.anime[1]);
        assert.match(errors.join('\n'), /Refresh stopped:.*HTTP 403/);
        assert.match(output.join('\n'), /--start-index 1/);
        assert.match(output.join('\n'), /Failed MAL IDs: 2/);
        assert.doesNotMatch(output.join('\n'), /Refresh complete/);
      } else {
        assert.equal(result.status, 'completed');
        assert.equal(process.exitCode, 0);
        assert.equal(saved.anime[1].metadata.score, 8.5);
        assert.match(output.join('\n'), /Refresh complete/);
        assert.match(output.join('\n'), /Community score errors: 0/);
        assert.deepEqual(errors, []);
      }
      for (const [signal, before] of listeners) assert.deepEqual(process.listeners(signal), before);
    } finally {
      globalThis.fetch = originalFetch;
      console.log = originalLog;
      console.error = originalError;
      process.exitCode = originalExitCode;
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
