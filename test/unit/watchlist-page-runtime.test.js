import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistPageRuntime } from '../../js/watchlist-page-runtime.ts';
import { setupDom } from '../helpers/dom.js';

const createRuntime = (result) => {
  const calls = [];
  return {
    calls,
    runtime: {
      setStatus: (id, status, options) => {
        calls.push(['setStatus', id, status, options]);
        return result || { transition: { changed: true, render: { controls: { shouldUpdate: true, entry: { id, status } }, watchlist: { shouldRender: true } } } };
      },
      setProgress: (id, progress, options) => {
        calls.push(['setProgress', id, progress, options]);
        return result || { transition: { changed: true, render: { controls: { shouldUpdate: true, entry: { id, progress } }, watchlist: { shouldRender: false } } } };
      },
      adjustProgress: (id, delta, options) => {
        calls.push(['adjustProgress', id, delta, options]);
        return result || { transition: { changed: true, render: { controls: { shouldUpdate: true, entry: { id, progress: delta } }, watchlist: { shouldRender: false } } } };
      }
    }
  };
};

test('Watchlist Page Runtime handles status changes through one transition path', () => {
  setupDom(`
    <article class="anime-card" data-anime-id="show-1" data-episode-count="12">
      <select data-action="watch-status" data-anime-id="show-1">
        <option value="planned">Planned</option>
        <option value="watching" selected>Watching</option>
      </select>
    </article>
  `);
  const { calls, runtime: watchlistRuntime } = createRuntime();
  const uiCalls = [];
  const runtime = createWatchlistPageRuntime({
    getEpisodeCountFromCard: () => 12,
    getWatchlistRuntime: () => watchlistRuntime,
    renderWatchlist: () => uiCalls.push(['renderWatchlist']),
    updateWatchlistUi: (...args) => uiCalls.push(['updateWatchlistUi', ...args])
  });

  const handled = runtime.handleWatchlistChange(document.querySelector('select'));

  assert.equal(handled, true);
  assert.deepEqual(calls.map(call => call[0]), ['setStatus']);
  assert.equal(calls[0][3].episodeCount, 12);
  assert.equal(uiCalls[0][0], 'updateWatchlistUi');
  assert.equal(uiCalls[1][0], 'renderWatchlist');
});

test('Watchlist Page Runtime handles progress clicks without re-rendering full watchlist', () => {
  setupDom(`
    <article class="anime-card" data-anime-id="show-1" data-episode-count="12">
      <div class="watchlist-controls">
        <button data-action="watch-progress-inc" data-anime-id="show-1">+</button>
      </div>
    </article>
  `);
  const { calls, runtime: watchlistRuntime } = createRuntime();
  const uiCalls = [];
  const runtime = createWatchlistPageRuntime({
    getEpisodeCountFromCard: () => 12,
    getWatchlistRuntime: () => watchlistRuntime,
    renderWatchlist: () => uiCalls.push(['renderWatchlist']),
    updateWatchlistUi: (...args) => uiCalls.push(['updateWatchlistUi', ...args])
  });

  const handled = runtime.handleWatchlistClick(document.querySelector('button'));

  assert.equal(handled, true);
  assert.deepEqual(calls.map(call => call[0]), ['adjustProgress']);
  assert.equal(uiCalls.length, 1);
  assert.equal(uiCalls[0][0], 'updateWatchlistUi');
});
