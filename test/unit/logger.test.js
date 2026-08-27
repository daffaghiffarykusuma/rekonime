import test from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../../js/services/logger.ts';

test('Logger filters by level and writes fatal messages as errors', () => {
  const original = {
    enabled: Logger.enabled,
    currentLevel: Logger.currentLevel,
    info: console.info,
    error: console.error
  };
  const calls = [];

  try {
    Logger.setEnabled(true);
    Logger.setLevel('warn');
    console.info = (...args) => calls.push(['info', ...args]);
    console.error = (...args) => calls.push(['error', ...args]);

    Logger.info('skip');
    Logger.fatal('boom', { id: 1 });

    assert.deepEqual(calls, [['error', '[Rekonime] boom', { id: 1 }]]);
  } finally {
    Logger.enabled = original.enabled;
    Logger.currentLevel = original.currentLevel;
    console.info = original.info;
    console.error = original.error;
  }
});
