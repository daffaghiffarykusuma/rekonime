import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOME_ACTION_COMMANDS, NON_CLICK_ACTIONS, runHomeAction } from '../../src/app/home-action-commands.ts';
import { setupDom } from '../helpers/dom.js';

const root = path.resolve(import.meta.dirname, '../..');
const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return sourceFiles(full);
  return /\.(ts|js|html)$/.test(entry.name) ? [full] : [];
});

test('every data-action rendered by the home page maps to a click command or a named other delegate', () => {
  const rendered = new Set();
  const pattern = /data-action=\\?["']([a-z][a-z-]*)\\?["']|dataset\.action = '([a-z-]+)'|'data-action', '([a-z-]+)'|\bbutton\('([a-z-]+)'/g;
  for (const file of [...sourceFiles(path.join(root, 'src')), path.join(root, 'index.html'), path.join(root, 'watchlist.html')]) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(pattern)) rendered.add(match[1] || match[2] || match[3] || match[4]);
  }
  const handled = new Set([...Object.keys(HOME_ACTION_COMMANDS), ...NON_CLICK_ACTIONS]);
  const unhandled = [...rendered].filter(action => !handled.has(action)).sort();
  assert.deepEqual(unhandled, []);
  const neverRendered = Object.keys(HOME_ACTION_COMMANDS).filter(action => !rendered.has(action)).sort();
  assert.deepEqual(neverRendered, []);
});

test('a command reads the action element and calls one App command', () => {
  setupDom('<div class="recommendation-card"><button data-action="skip-recommendation" data-anime-id="42">Skip</button></div>');
  const calls = [];
  const app = { runShortlistAction: (...args) => calls.push(args) };
  const element = document.querySelector('button');
  const event = { preventDefault: () => calls.push(['preventDefault']), stopPropagation: () => calls.push(['stopPropagation']) };

  assert.equal(runHomeAction(app, element, event), true);
  assert.deepEqual(calls, [['preventDefault'], ['stopPropagation'], ['skip-recommendation', '42']]);
  element.dataset.action = 'not-an-action';
  assert.equal(runHomeAction(app, element, event), false);
});

test('the loved toggle asks the Watchlist Lifecycle instead of reading button state', () => {
  setupDom('<button data-action="watch-loved" aria-pressed="true">Loved</button>');
  const calls = [];
  const app = { currentAnimeId: 'open-title', toggleWatchLoved: (id) => calls.push(id) };

  runHomeAction(app, document.querySelector('button'), {});

  assert.deepEqual(calls, ['open-title']);
});

// A fake App that records every method call; nested objects (detailExperience, workflow) record too.
const createRecordingApp = (overrides = {}) => {
  const calls = [];
  const recorder = (prefix) => new Proxy({}, {
    get: (_, name) => {
      if (name in overrides && prefix === '') return overrides[name];
      if (name === 'then') return undefined;
      return (...args) => {
        calls.push([`${prefix}${String(name)}`, ...args]);
        if (name === 'getWatchlistImportWorkflow') return recorder('workflow.');
        if (name === 'getRuntimeCapabilities') return recorder('capabilities.');
        return undefined;
      };
    }
  });
  const app = recorder('');
  return { app, calls };
};

const EXPECTED_APP_CALLS = {
  'quick-save-recommendation': ['runShortlistAction', 'quick-save-recommendation', '7'],
  'undo-recommendation-selection': ['runShortlistAction', 'undo-recommendation-selection', '7'],
  'restore-session-dismissal': ['runShortlistAction', 'restore-session-dismissal', '7'],
  'more-recommendations': ['runShortlistAction', 'more-recommendations', '7'],
  'rec-more-like': ['handleRecommendationFeedback', 'rec-more-like', '7'],
  'rec-not-for-me': ['handleRecommendationFeedback', 'rec-not-for-me', '7'],
  'rec-less-tag': ['handleRecommendationFeedback', 'rec-less-tag', '7'],
  'rec-already-seen': ['handleRecommendationFeedback', 'rec-already-seen', '7'],
  'surprise-me': ['showSurpriseMe'],
  'explain-recommendations': ['showRecommendationsHelp'],
  'continue-progress': ['advanceWatchProgress', '7'],
  'watch-progress-inc': ['adjustWatchProgress', '7', 1],
  'watch-progress-dec': ['adjustWatchProgress', '7', -1],
  'toggle-filter': ['toggleFilter', 'genres', 'Action'],
  'clear-search': ['clearHeaderSearchQuery', { scroll: true }],
  'apply-preset': ['applyFilterPreset', 'hidden-gems'],
  'apply-seasonal': ['applySeasonalFilter', '2026'],
  'scroll-to-filters': ['scrollToFiltersSection'],
  'scroll-to-results': ['scrollToResultsSection'],
  'load-more': ['loadMoreAnime'],
  'open-anime': ['showAnimeDetail', '7'],
  'close-detail': ['closeDetailModal'],
  'edit-taste-profile': ['ensureSettingsRendered'],
  'reset-taste-profile': ['resetTasteProfile'],
  'export-personal-data': ['exportPersonalData'],
  'retry-mal-watchlist-import': ['workflow.retry'],
  'retry-mal-recommendations': ['workflow.retry'],
  'cancel-mal-watchlist-import': ['workflow.cancel'],
  'confirm-mal-watchlist-import': ['openMalWatchlistConfirmation'],
  'apply-mal-watchlist-import': ['workflow.apply']
};

test('each command calls its App command with values read from the action element', () => {
  for (const [action, expected] of Object.entries(EXPECTED_APP_CALLS)) {
    setupDom(`<button data-action="${action}" data-anime-id="7" data-filter-type="genres" data-filter-value="Action"
      data-preset="hidden-gems" data-season-year="2026">Go</button>`);
    const { app, calls } = createRecordingApp({ currentAnimeId: null, quickFilterState: {}, detailExperience: null });
    const event = { preventDefault() {}, stopPropagation() {} };
    globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);

    runHomeAction(app, document.querySelector('button'), event);

    assert.deepEqual(calls.find(call => call[0] === expected[0])?.slice(0, expected.length), expected, action);
  }
});

test('page-level commands update their own controls without an App command', () => {
  setupDom(`
    <div class="quick-tab is-active" data-action="quick-tab" data-tab="genres"></div>
    <div class="quick-tab" data-action="quick-tab" data-tab="themes"></div>
    <div class="quick-filters-track is-active" data-filter-group="genres"></div>
    <div class="quick-filters-track" data-filter-group="themes" hidden></div>
    <div class="detail-tabs">
      <button role="tab" data-action="detail-tab" data-detail-tab="info" class="is-active"></button>
      <button role="tab" data-action="detail-tab" data-detail-tab="reviews"></button>
      <section data-detail-panel="info"></section><section data-detail-panel="reviews" hidden></section>
    </div>
    <button data-action="toggle-quick-more" data-filter-type="genres"></button>
    <button data-action="home-shortcut"></button>
    <button data-action="restore-personal-data"></button><input id="personal-data-restore" type="file">
  `);
  const { app, calls } = createRecordingApp({ currentAnimeId: 'open', quickFilterState: { genres: { expanded: false } } });
  const event = { preventDefault() {}, stopPropagation() {} };
  const run = (selector) => runHomeAction(app, document.querySelector(selector), event);

  run('[data-tab="themes"]');
  assert.equal(document.querySelector('[data-filter-group="themes"]').hidden, false);
  assert.equal(document.querySelector('[data-tab="themes"]').getAttribute('aria-selected'), 'true');

  run('[data-detail-tab="reviews"]');
  assert.equal(document.querySelector('[data-detail-panel="reviews"]').hidden, false);
  assert.equal(document.querySelector('[data-detail-panel="info"]').hidden, true);

  run('[data-action="toggle-quick-more"]');
  assert.equal(app.quickFilterState.genres.expanded, true);
  assert.equal(calls.some(call => call[0] === 'renderQuickFilters'), true);

  let restoreClicked = false;
  document.getElementById('personal-data-restore').addEventListener('click', () => { restoreClicked = true; });
  run('[data-action="restore-personal-data"]');
  assert.equal(restoreClicked, true);

  run('[data-action="home-shortcut"]');
  assert.deepEqual(calls.filter(call => ['closeDetailModal', 'clearAllFilters'].includes(call[0])).map(call => call[0]), []);
});
