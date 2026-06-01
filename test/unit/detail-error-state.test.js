import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDetailErrorState } from '../../js/detail-error-state.ts';

test('Detail Error State renders catalog missing title message', () => {
  const html = renderDetailErrorState({ reason: 'catalog' });

  assert.match(html, /That title is not available/);
  assert.match(html, /current catalog/);
  assert.match(html, /data-action="close-detail"/);
});

test('Detail Error State renders deep-link missing title message', () => {
  const html = renderDetailErrorState({ reason: 'deepLink' });

  assert.match(html, /link may be outdated/);
});
