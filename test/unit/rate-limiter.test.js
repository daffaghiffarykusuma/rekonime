import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../../js/services/rate-limiter.js';

const resetLimiter = () => {
  RateLimiter.buckets.clear();
  RateLimiter.queues.clear();
  RateLimiter.processing.clear();
};

test('RateLimiter canConsume respects token refill', () => {
  resetLimiter();
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;
  RateLimiter.config.test = {
    tokensPerSecond: 1,
    maxTokens: 1,
    minRequestIntervalMs: 0
  };

  assert.equal(RateLimiter.canConsume('test'), true);
  assert.equal(RateLimiter.canConsume('test'), false);

  now = 1000;
  assert.equal(RateLimiter.canConsume('test'), true);

  Date.now = originalNow;
});

test('RateLimiter execute queues tasks in order', async () => {
  resetLimiter();
  RateLimiter.config.fast = {
    tokensPerSecond: 1000,
    maxTokens: 1,
    minRequestIntervalMs: 0
  };

  const results = [];
  const task = (value) => () => {
    results.push(value);
    return value;
  };

  const p1 = RateLimiter.execute('fast', task('a'));
  const p2 = RateLimiter.execute('fast', task('b'));
  const p3 = RateLimiter.execute('fast', task('c'));

  const values = await Promise.all([p1, p2, p3]);
  assert.deepEqual(values, ['a', 'b', 'c']);
  assert.deepEqual(results, ['a', 'b', 'c']);
});
