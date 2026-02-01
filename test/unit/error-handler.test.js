import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorHandler } from '../../js/services/error-handler.js';

test('ErrorHandler report notifies listeners', () => {
  const events = [];
  const off = ErrorHandler.on((payload) => events.push(payload));
  const error = new Error('boom');

  const payload = ErrorHandler.report(error, { source: 'test' });
  assert.equal(payload.error, error);
  assert.equal(events.length, 1);
  assert.equal(events[0].context.source, 'test');

  off();
});

test('ErrorHandler capture wraps sync errors', () => {
  const error = new Error('sync');
  let reported = false;
  const off = ErrorHandler.on(() => { reported = true; });

  const wrapped = ErrorHandler.capture(() => { throw error; }, { source: 'sync' });
  const result = wrapped();

  assert.equal(result, undefined);
  assert.equal(reported, true);
  off();
});

test('ErrorHandler captureAsync rethrows after reporting', async () => {
  const error = new Error('async');
  let reported = false;
  const off = ErrorHandler.on(() => { reported = true; });

  const wrapped = ErrorHandler.captureAsync(async () => { throw error; }, { source: 'async' });
  await assert.rejects(() => wrapped(), /async/);
  assert.equal(reported, true);

  off();
});
