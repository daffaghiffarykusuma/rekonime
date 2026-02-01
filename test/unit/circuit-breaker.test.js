import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../../js/circuitBreaker.js';

test('CircuitBreaker opens after failures', () => {
  const service = 'test-service';
  CircuitBreaker.reset(service);

  for (let i = 0; i < CircuitBreaker.config.failureThreshold; i += 1) {
    CircuitBreaker.recordFailure(service);
  }

  const status = CircuitBreaker.getStatus(service);
  assert.equal(status.state, CircuitBreaker.states.OPEN);
  assert.equal(status.healthy, false);
});

test('CircuitBreaker transitions to half-open after timeout', () => {
  const service = 'timeout-service';
  CircuitBreaker.reset(service);

  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;

  CircuitBreaker.recordFailure(service);
  CircuitBreaker.recordFailure(service);
  CircuitBreaker.recordFailure(service);
  CircuitBreaker.recordFailure(service);
  CircuitBreaker.recordFailure(service);

  const blocked = CircuitBreaker.canExecute(service);
  assert.equal(blocked.allowed, false);

  now = CircuitBreaker.config.resetTimeoutMs + 1;
  const allowed = CircuitBreaker.canExecute(service);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.state, CircuitBreaker.states.HALF_OPEN);

  Date.now = originalNow;
});

test('CircuitBreaker resets after half-open successes', () => {
  const service = 'half-open-service';
  CircuitBreaker.reset(service);

  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;

  for (let i = 0; i < CircuitBreaker.config.failureThreshold; i += 1) {
    CircuitBreaker.recordFailure(service);
  }

  now = CircuitBreaker.config.resetTimeoutMs + 1;
  CircuitBreaker.canExecute(service);

  for (let i = 0; i < CircuitBreaker.config.halfOpenMaxCalls; i += 1) {
    CircuitBreaker.recordSuccess(service);
  }

  const status = CircuitBreaker.getStatus(service);
  assert.equal(status.state, CircuitBreaker.states.CLOSED);

  Date.now = originalNow;
});
