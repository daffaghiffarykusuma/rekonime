import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService } from '../../js/services/analytics-service.js';
import { CacheManager } from '../../js/services/cache-manager.js';

const resetAnalytics = () => {
  AnalyticsService.setEnabled(true);
  AnalyticsService.queue = [];
  AnalyticsService.initialized = false;
  AnalyticsService.respectDnt = false;
  CacheManager.removeItem(AnalyticsService.storageKey);
};

test('AnalyticsService track returns false when disabled', () => {
  resetAnalytics();
  AnalyticsService.setEnabled(false);
  const result = AnalyticsService.track('event_test', { ok: true });
  assert.equal(result, false);
  AnalyticsService.setEnabled(true);
});

test('AnalyticsService queues events when gtag is missing', () => {
  resetAnalytics();
  AnalyticsService.init({ respectDnt: false });
  const result = AnalyticsService.track('event_queued', { ok: true });
  assert.equal(result, true);
  assert.equal(AnalyticsService.queue.length, 1);
});

test('AnalyticsService track calls gtag when available', () => {
  resetAnalytics();
  const originalGtag = globalThis.gtag;
  const calls = [];
  globalThis.gtag = (...args) => calls.push(args);

  AnalyticsService.init({ respectDnt: false });
  AnalyticsService.setEnabled(true);
  const result = AnalyticsService.track('event_test', { ok: true });
  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'event');

  globalThis.gtag = originalGtag;
});

test('AnalyticsService flushes queued events when gtag becomes available', () => {
  resetAnalytics();
  const calls = [];
  AnalyticsService.init({ respectDnt: false });
  AnalyticsService.track('event_queued', { ok: true });
  assert.equal(AnalyticsService.queue.length, 1);

  const originalGtag = globalThis.gtag;
  globalThis.gtag = (...args) => calls.push(args);

  const flushed = AnalyticsService.flush();
  assert.equal(flushed, true);
  assert.equal(AnalyticsService.queue.length, 0);
  assert.equal(calls.length, 1);

  globalThis.gtag = originalGtag;
});
