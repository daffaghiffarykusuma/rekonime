import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistPageInteractions } from '../../js/watchlist-page-interactions.ts';
import { setupDom } from '../helpers/dom.js';

const createInteractions = (overrides = {}) => {
  const calls = [];
  const app = {
    showAnimeDetail: (id) => calls.push(['showAnimeDetail', id]),
    toggleSettingsModal: () => calls.push(['toggleSettingsModal']),
    ensureSettingsRendered: () => calls.push(['ensureSettingsRendered']),
    getRuntimeCapabilities: () => ({
      setModalVisibility: (...args) => calls.push(['setModalVisibility', ...args])
    })
  };
  const interactions = createWatchlistPageInteractions({
    documentRef: document,
    handleImageError: (img) => {
      calls.push(['handleImageError']);
      img.dataset.fallbackApplied = 'true';
      img.src = img.dataset.fallbackSrc;
      return true;
    },
    handleWatchlistChange: (target) => {
      calls.push(['handleWatchlistChange', target.dataset.action]);
      return Boolean(overrides.changeHandled);
    },
    handleWatchlistClick: (target) => {
      calls.push(['handleWatchlistClick', target.dataset.action]);
      return Boolean(overrides.clickHandled);
    },
    loadFullApp: async () => app,
    onFilterChange: (next) => calls.push(['onFilterChange', next]),
    renderWatchlist: () => calls.push(['renderWatchlist'])
  });
  return { calls, interactions };
};

test('Watchlist Page Interactions delegates watchlist controls before card opening', async () => {
  setupDom(`
    <section>
      <div id="watchlist-grid">
        <article class="anime-card" data-anime-id="show-1">
          <div class="watchlist-controls">
            <button data-action="watch-progress-inc">+</button>
          </div>
        </article>
      </div>
      <div id="airing-dashboard-grid"></div>
    </section>
  `);
  const { calls, interactions } = createInteractions({ clickHandled: true });
  interactions.setupGridHandlers();

  document.querySelector('button').click();
  await Promise.resolve();

  assert.deepEqual(calls, [['handleWatchlistClick', 'watch-progress-inc']]);
});

test('Watchlist Page Interactions opens cards and forwards filter changes', async () => {
  setupDom(`
    <section>
      <div id="watchlist-grid">
        <article class="anime-card" data-anime-id="show-1"></article>
      </div>
      <div id="airing-dashboard-grid"></div>
      <div id="watchlist-filter-chips">
        <button data-filter="watching"><span>Watching</span></button>
      </div>
      <button id="settings-toggle" type="button">Settings</button>
      <button id="mal-import-toggle" type="button">Import from MAL</button>
    </section>
  `);
  const { calls, interactions } = createInteractions();
  interactions.setupPageHandlers();

  document.querySelector('.anime-card').click();
  document.querySelector('[data-filter] span').click();
  document.getElementById('settings-toggle').click();
  document.getElementById('mal-import-toggle').click();
  window.dispatchEvent(new CustomEvent('rekonime:watchlist-updated'));
  await Promise.resolve();

  assert.deepEqual(calls, [
    ['handleWatchlistClick', undefined],
    ['onFilterChange', 'watching'],
    ['renderWatchlist'],
    ['showAnimeDetail', 'show-1'],
    ['toggleSettingsModal'],
    ['ensureSettingsRendered'],
    ['setModalVisibility', 'settings-modal', true, { initialFocusSelector: '#mal-watchlist-import-file' }]
  ]);
});

test('Watchlist Page Interactions applies image fallback and records proxy failure', () => {
  setupDom(`
    <div id="watchlist-grid">
      <img src="https://images.example/proxy/show.webp" data-fallback-src="https://cdn.example/show.webp" />
    </div>
  `);
  const { calls, interactions } = createInteractions();
  interactions.attachCardHandlers(document.getElementById('watchlist-grid'));

  const img = document.querySelector('img');
  img.dispatchEvent(new Event('error', { bubbles: true }));

  assert.equal(img.dataset.fallbackApplied, 'true');
  assert.equal(img.src, 'https://cdn.example/show.webp');
  assert.deepEqual(calls, [['handleImageError']]);
});
