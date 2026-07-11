import test from 'node:test';
import assert from 'node:assert/strict';
import { showToast } from '../../js/toast.ts';
import { resetDomBody, setupDom } from '../helpers/dom.js';

test('toast replaces stale feedback with the same key', () => {
  setupDom();
  resetDomBody('');

  showToast('Saved to Want to watch', { key: 'watchlist' });
  showToast('Saved to Watching now', { key: 'watchlist' });

  assert.equal(document.querySelectorAll('.toast').length, 1);
  assert.match(document.querySelector('.toast').textContent, /Saved to Watching now/);
});
