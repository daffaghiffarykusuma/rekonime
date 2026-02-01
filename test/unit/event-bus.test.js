import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../js/core/event-bus.js';
import { ErrorHandler } from '../../js/services/error-handler.js';

test('EventBus on/emit/off', () => {
  EventBus.clear();
  let count = 0;
  const off = EventBus.on('ping', () => { count += 1; });
  EventBus.emit('ping');
  assert.equal(count, 1);
  off();
  EventBus.emit('ping');
  assert.equal(count, 1);
});

test('EventBus reports handler errors', () => {
  EventBus.clear();
  const originalReport = ErrorHandler.report;
  let reported = null;
  ErrorHandler.report = (error, context) => {
    reported = { error, context };
    return { error, context };
  };

  EventBus.on('boom', () => { throw new Error('boom'); });
  EventBus.emit('boom');

  assert.ok(reported);
  assert.equal(reported.context.source, 'EventBus');

  ErrorHandler.report = originalReport;
});

test('EventBus clear removes listeners', () => {
  EventBus.clear();
  let count = 0;
  EventBus.on('clear-test', () => { count += 1; });
  EventBus.clear('clear-test');
  EventBus.emit('clear-test');
  assert.equal(count, 0);
});
