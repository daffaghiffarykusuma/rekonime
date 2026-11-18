import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistPageRuntime } from '../../src/features/watchlist/watchlist-page-runtime.ts';
import { setupDom } from '../helpers/dom.js';

const createRuntime = () => {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push([name, ...args]);
    return { changed: true };
  };
  return {
    calls,
    runtime: {
      setStatus: record('setStatus'),
      setProgress: record('setProgress'),
      adjustProgress: record('adjustProgress')
    }
  };
};

const createPageRuntime = (watchlistRuntime) => createWatchlistPageRuntime({
  getEpisodeCountFromCard: (card) => Number(card.dataset.episodeCount) || null,
  getWatchlistRuntime: () => watchlistRuntime
});

test('Watchlist Page Runtime sends status changes to the Watchlist Lifecycle Runtime with the card total', () => {
  setupDom(`
    <article class="anime-card" data-anime-id="show-1" data-episode-count="12">
      <select data-action="watch-status" data-anime-id="show-1">
        <option value="planned">Planned</option>
        <option value="watching" selected>Watching</option>
      </select>
    </article>
  `);
  const { calls, runtime } = createRuntime();

  const handled = createPageRuntime(runtime).handleWatchlistChange(document.querySelector('select'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [['setStatus', 'show-1', 'watching', { episodeCount: 12 }]]);
});

test('Watchlist Page Runtime sends progress clicks as adjustments', () => {
  setupDom(`
    <article class="anime-card" data-anime-id="show-1" data-episode-count="12">
      <div class="watchlist-controls">
        <button data-action="watch-progress-inc" data-anime-id="show-1">+</button>
        <button data-action="watch-progress-dec" data-anime-id="show-1">-</button>
      </div>
    </article>
  `);
  const { calls, runtime } = createRuntime();
  const pageRuntime = createPageRuntime(runtime);

  assert.equal(pageRuntime.handleWatchlistClick(document.querySelector('[data-action="watch-progress-inc"]')), true);
  assert.equal(pageRuntime.handleWatchlistClick(document.querySelector('[data-action="watch-progress-dec"]')), true);

  assert.deepEqual(calls, [
    ['adjustProgress', 'show-1', 1, { episodeCount: 12 }],
    ['adjustProgress', 'show-1', -1, { episodeCount: 12 }]
  ]);
});

test('Watchlist Page Runtime ignores targets outside Watchlist controls and unknown actions', () => {
  setupDom(`
    <article class="anime-card" data-anime-id="show-1">
      <button id="outside" data-action="open-anime">Open</button>
      <input id="other" data-action="something-else" />
    </article>
  `);
  const { calls, runtime } = createRuntime();
  const pageRuntime = createPageRuntime(runtime);

  assert.equal(pageRuntime.handleWatchlistClick(document.getElementById('outside')), false);
  assert.equal(pageRuntime.handleWatchlistChange(document.getElementById('other')), false);
  assert.deepEqual(calls, []);
});
