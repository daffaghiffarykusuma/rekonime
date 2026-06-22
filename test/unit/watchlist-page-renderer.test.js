import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistPageRenderer } from '../../js/watchlist-page-renderer.ts';
import { setupDom } from '../helpers/dom.js';

const createRenderer = ({
  entries = [],
  map = new Map(entries.map((entry) => [entry.id, entry])),
  currentFilter = 'all'
} = {}) => {
  const calls = [];
  const renderer = createWatchlistPageRenderer({
    documentRef: document,
    getCurrentFilter: () => currentFilter,
    getWatchlistState: () => ({ map, entries, version: 1 }),
    migrateLegacyBookmarksToWatchlist: () => calls.push(['migrateLegacyBookmarksToWatchlist']),
    placeholderCover: 'https://placeholder.example/cover.webp',
    resolveImage: ({ coverUrl, placeholder, index }) => ({
      src: coverUrl ? `https://proxy.example/${coverUrl}` : placeholder,
      fallbackSrc: coverUrl ? `https://cdn.example/${coverUrl}` : placeholder,
      fallbackSecondary: coverUrl ? placeholder : '',
      width: 240,
      height: 360,
      loading: index < 2 ? 'eager' : 'lazy',
      decoding: 'async',
      fetchpriority: index === 0 ? 'high' : 'auto'
    }),
    saveWatchlistMap: (...args) => calls.push(['saveWatchlistMap', ...args]),
    scheduleAiringDashboardUpdate: (...args) => calls.push(['scheduleAiringDashboardUpdate', ...args])
  });
  return { calls, renderer };
};

test('Watchlist Page Renderer renders empty state and schedules empty dashboard update', () => {
  setupDom(`
    <section id="watchlist-section">
      <div id="watchlist-filter-chips"></div>
      <div id="watchlist-grid"><article></article></div>
      <p id="watchlist-empty"></p>
    </section>
  `);
  const { calls, renderer } = createRenderer();

  const rendered = renderer.renderWatchlist();

  assert.equal(rendered, true);
  assert.equal(document.getElementById('watchlist-section').classList.contains('is-empty'), true);
  assert.equal(document.querySelectorAll('#watchlist-grid .anime-card').length, 0);
  assert.deepEqual(calls, [
    ['migrateLegacyBookmarksToWatchlist'],
    ['scheduleAiringDashboardUpdate', [], [], { timeout: 1200 }]
  ]);
});

test('Watchlist Page Renderer builds cards, filters, snapshots, and dashboard input', () => {
  setupDom(`
    <section id="watchlist-section" class="is-empty">
      <div id="watchlist-filter-chips"></div>
      <div id="watchlist-grid"></div>
      <p id="watchlist-empty"></p>
    </section>
  `);
  const entry = { id: 'show-1', status: 'watching', progress: 3 };
  const { calls, renderer } = createRenderer({ entries: [entry], currentFilter: 'watching' });

  const rendered = renderer.renderWatchlist();
  const card = document.querySelector('.anime-card');
  const activeFilter = document.querySelector('.watchlist-filter-chip.is-active');

  assert.equal(rendered, true);
  assert.equal(document.getElementById('watchlist-section').classList.contains('is-empty'), false);
  assert.equal(card.dataset.animeId, 'show-1');
  assert.equal(card.querySelector('.card-title').textContent, 'Unknown title');
  assert.equal(card.querySelector('.card-year').textContent, 'Unknown • Unknown');
  assert.equal(card.querySelector('img').src, 'https://proxy.example/https://placeholder.example/cover.webp');
  assert.equal(activeFilter.dataset.filter, 'watching');
  assert.equal(entry.snapshot.title, 'Unknown title');
  assert.equal(calls[0][0], 'migrateLegacyBookmarksToWatchlist');
  assert.equal(calls[1][0], 'saveWatchlistMap');
  assert.equal(calls[2][0], 'scheduleAiringDashboardUpdate');
  assert.equal(calls[2][1][0], entry);
  assert.equal(calls[2][2][0].id, 'show-1');
  assert.deepEqual(calls[2][3], { timeout: 1800 });
});
