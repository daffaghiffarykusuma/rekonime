import test from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../../js/services/logger.ts';

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

test('Logger persistence is opt-in via localStorage preference', () => {
  localStorage.removeItem('rekonime.logPersistence');
  resetLogger();
  Logger.init({ level: 'info' });
  assert.equal(Logger.persistLogs, false);

  localStorage.setItem('rekonime.logPersistence', 'enabled');
  resetLogger();
  Logger.init({ level: 'info' });
  assert.equal(Logger.persistLogs, true);
  localStorage.removeItem('rekonime.logPersistence');
});
