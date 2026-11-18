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
