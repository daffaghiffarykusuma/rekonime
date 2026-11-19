import test from 'node:test';
import assert from 'node:assert/strict';
import { showToast } from '../../src/shared/ui/toast.ts';
import { resetDomBody, setupDom } from '../helpers/dom.js';

test('toast replaces stale feedback with the same key', () => {
  setupDom();
  resetDomBody('');

  showToast('Saved to Want to watch', { key: 'watchlist' });
  showToast('Saved to Watching now', { key: 'watchlist' });

  assert.equal(document.querySelectorAll('.toast').length, 1);
  assert.match(document.querySelector('.toast').textContent, /Saved to Watching now/);
});

test('toast renders several actions in order and skips empty ones', () => {
  setupDom();
  resetDomBody('');
  const clicks = [];
  showToast('Saved to Stopped', {
    actions: [
      { label: 'Undo', onClick: (id) => clicks.push(id) },
      null,
      { label: 'View watchlist', href: '/watchlist.html' }
    ]
  });
  const actions = [...document.querySelectorAll('.toast-action')];
  assert.deepEqual(actions.map(action => [action.tagName, action.textContent]), [['BUTTON', 'Undo'], ['A', 'View watchlist']]);
  actions[0].click();
  assert.equal(clicks.length, 1);
});
