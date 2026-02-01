import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService } from '../../js/services/analytics-service.js';

test('AnalyticsService track returns false when disabled', () => {
  AnalyticsService.setEnabled(false);
  const result = AnalyticsService.track('event_test', { ok: true });
  assert.equal(result, false);
  AnalyticsService.setEnabled(true);
});

test('AnalyticsService track calls gtag when available', () => {
  const originalGtag = globalThis.gtag;
  const calls = [];
  globalThis.gtag = (...args) => calls.push(args);

  AnalyticsService.setEnabled(true);
  const result = AnalyticsService.track('event_test', { ok: true });
  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'event');

  globalThis.gtag = originalGtag;
});
