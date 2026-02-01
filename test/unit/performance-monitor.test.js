import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceMonitor } from '../../js/performanceMonitor.js';
import { AnalyticsService } from '../../js/services/analytics-service.js';

const resetMonitor = () => {
  PerformanceMonitor.initialized = false;
  PerformanceMonitor.customTimers = new Map();
  PerformanceMonitor.observers = [];
};

test('PerformanceMonitor reports custom timing metrics', () => {
  resetMonitor();
  const calls = [];
  const originalTrack = AnalyticsService.track;
  AnalyticsService.track = (...args) => {
    calls.push(args);
    return true;
  };

  PerformanceMonitor.init();
  window.dispatchEvent(new CustomEvent('rekonime:data-load-start', { detail: { source: 'preview' } }));
  window.dispatchEvent(new CustomEvent('rekonime:data-load-end', { detail: { source: 'preview' } }));
  window.dispatchEvent(new CustomEvent('rekonime:modal-opened', { detail: { durationMs: 123, animeId: 'x1' } }));

  const metricNames = calls.map(call => call[1]?.metric_name).filter(Boolean);
  assert.ok(metricNames.includes('data_load'));
  assert.ok(metricNames.includes('modal_open'));

  AnalyticsService.track = originalTrack;
});
