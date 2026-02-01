import test from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../../js/services/logger.js';

const resetLogger = () => {
  Logger.initialized = false;
  Logger.globalHandlersInstalled = false;
  Logger.buffer = [];
  Logger.persistLogs = false;
  Logger.setEnabled(true);
};

test('Logger respects log levels', () => {
  resetLogger();
  Logger.init({ level: 'warn', persist: false });
  Logger.info('info message');
  assert.equal(Logger.getBuffer().length, 0);
  Logger.error('error message');
  assert.equal(Logger.getBuffer().length, 1);
});

test('Logger trims buffer to limit', () => {
  resetLogger();
  Logger.init({ level: 'debug', persist: false, bufferLimit: 2 });
  Logger.debug('one');
  Logger.debug('two');
  Logger.debug('three');
  const buffer = Logger.getBuffer();
  assert.equal(buffer.length, 2);
  assert.equal(buffer[0].message, 'two');
  assert.equal(buffer[1].message, 'three');
});
