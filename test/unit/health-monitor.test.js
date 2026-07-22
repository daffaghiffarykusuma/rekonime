import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthMonitor } from '../../js/healthMonitor.js';

test('HealthMonitor marks data fresh and detects staleness', () => {
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;

  HealthMonitor.dataFreshness.clear();
  HealthMonitor.markDataFresh('catalog', now);
  assert.equal(HealthMonitor.isDataStale('catalog'), false);

  now = HealthMonitor.config.staleThresholdMs + 1;
  assert.equal(HealthMonitor.isDataStale('catalog'), true);

  Date.now = originalNow;
});

test('HealthMonitor performHealthChecks returns status', async () => {
  HealthMonitor.dataFreshness.clear();

  const status = await HealthMonitor.performHealthChecks();
  assert.equal(typeof status.online, 'boolean');
  assert.ok(Array.isArray(status.services));

  const catalog = status.services.find(service => service.name === 'catalog');
  assert.ok(catalog);
});

test('HealthMonitor subscribe notifies listeners', async () => {
  let events = 0;
  const unsubscribe = HealthMonitor.subscribe((event) => {
    if (event === 'health-check') events += 1;
  });

  await HealthMonitor.performHealthChecks();
  unsubscribe();
  await HealthMonitor.performHealthChecks();

  assert.equal(events, 1);
});

test('HealthMonitor records service latency', () => {
  HealthMonitor.recordServiceLatency('reviews', 123, { success: false, errorMessage: 'oops' });
  const status = HealthMonitor.getStatus();
  const reviews = status.services.find(service => service.name === 'reviews');
  assert.ok(reviews);
  assert.equal(reviews.latencyMs, 123);
  assert.equal(reviews.lastError, 'oops');
});
