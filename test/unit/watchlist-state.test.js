import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WATCH_STATUS_VALUES,
  normalizeWatchStatus,
  normalizeWatchProgress
} from '../../js/watchlist-state.js';

test('watchlist status normalization uses allowed values only', () => {
  assert.equal(WATCH_STATUS_VALUES.includes('planned'), true);
  assert.equal(normalizeWatchStatus('WATCHING'), 'watching');
  assert.equal(normalizeWatchStatus('unknown'), 'planned');
});

test('watchlist progress normalization floors and clamps to non-negative', () => {
  assert.equal(normalizeWatchProgress(3.8), 3);
  assert.equal(normalizeWatchProgress('-7'), 0);
  assert.equal(normalizeWatchProgress('not-a-number'), 0);
});

