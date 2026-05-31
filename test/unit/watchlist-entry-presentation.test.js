import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderWatchlistControlsHtml,
  createWatchlistControlsElement,
  updateWatchlistControlsElement
} from '../../js/watchlist-entry-presentation.ts';
import { setupDom } from '../helpers/dom.js';

test('Watchlist Entry presentation renders detail controls from one model', () => {
  const html = renderWatchlistControlsHtml(
    { id: 'show-1', status: 'watching', progress: 3 },
    {
      anime: { id: 'show-1', title: 'Show 1', episodeCount: 12 },
      episodeCount: 12
    }
  );

  assert.match(html, /id="watchlist-select"/);
  assert.match(html, /value="watching" selected/);
  assert.match(html, /value="3"/);
  assert.match(html, /of 12/);
});

test('Watchlist Entry presentation creates and updates watchlist page controls', () => {
  setupDom('<div id="root"></div>');
  const root = document.getElementById('root');
  const controls = createWatchlistControlsElement(
    { id: 'show-1', title: 'Show 1', stats: { episodeCount: 10 } },
    { id: 'show-1', status: 'planned', progress: 0 }
  );
  root.appendChild(controls);

  const updated = updateWatchlistControlsElement(root, {
    id: 'show-1',
    status: 'watching',
    progress: 4
  }, { episodeCount: 10 });

  assert.equal(updated, true);
  assert.equal(root.querySelector('.watchlist-controls-select').value, 'watching');
  assert.equal(root.querySelector('.watchlist-controls-input').value, '4');
  assert.equal(root.querySelector('.watchlist-controls-total').textContent, 'of 10');
});
