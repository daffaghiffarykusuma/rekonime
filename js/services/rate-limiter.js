import { DependencyContainer } from '../core/dependency-container.js';

/**
 * Token bucket rate limiter with per-service queues.
 */
const RateLimiter = {
  config: {
    jikan: {
      tokensPerSecond: 2,
      maxTokens: 3,
      minRequestIntervalMs: 500
    },
    catalog: {
      tokensPerSecond: 5,
      maxTokens: 10,
      minRequestIntervalMs: 200
    }
  },
  buckets: new Map(),
  queues: new Map(),
  processing: new Map(),

  getConfig(serviceName) {
    return this.config[serviceName] || this.config.catalog;
  },

  getBucket(serviceName) {
    if (!this.buckets.has(serviceName)) {
      const config = this.getConfig(serviceName);
      this.buckets.set(serviceName, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
        lastRequestAt: 0,
        config
      });
    }
    return this.buckets.get(serviceName);
  },

  refillTokens(bucket) {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.config.tokensPerSecond;
    bucket.tokens = Math.min(bucket.config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  },

  canConsume(serviceName) {
    const bucket = this.getBucket(serviceName);
    this.refillTokens(bucket);

    const now = Date.now();
    const minInterval = bucket.config.minRequestIntervalMs || 0;
    const sinceLast = now - (bucket.lastRequestAt || 0);
    if (minInterval && sinceLast < minInterval) {
      return false;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.lastRequestAt = now;
      return true;
    }
    return false;
  },

  getWaitTime(serviceName) {
    const bucket = this.getBucket(serviceName);
    this.refillTokens(bucket);

    const now = Date.now();
    const minInterval = bucket.config.minRequestIntervalMs || 0;
    const sinceLast = now - (bucket.lastRequestAt || 0);
    const intervalWait = minInterval > sinceLast ? minInterval - sinceLast : 0;

    if (bucket.tokens >= 1) {
      return intervalWait;
    }

    const tokensNeeded = 1 - bucket.tokens;
    const msPerToken = 1000 / bucket.config.tokensPerSecond;
    const tokenWait = Math.ceil(tokensNeeded * msPerToken);
    return Math.max(intervalWait, tokenWait);
  },

  enqueue(serviceName, fn, resolve, reject) {
    if (!this.queues.has(serviceName)) {
      this.queues.set(serviceName, []);
    }
    this.queues.get(serviceName).push({ fn, resolve, reject });
    this.processQueue(serviceName);
  },

  async processQueue(serviceName) {
    if (this.processing.get(serviceName)) return;
    this.processing.set(serviceName, true);

    const queue = this.queues.get(serviceName) || [];

    while (queue.length > 0) {
      if (this.canConsume(serviceName)) {
        const task = queue.shift();
        if (!task) continue;
        try {
          const result = await task.fn();
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        }
      } else {
        const waitTime = this.getWaitTime(serviceName);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.processing.set(serviceName, false);
  },

  execute(serviceName, fn) {
    return new Promise((resolve, reject) => {
      this.enqueue(serviceName, fn, resolve, reject);
    });
  },

  getStatus(serviceName) {
    const bucket = this.getBucket(serviceName);
    this.refillTokens(bucket);
    return {
      service: serviceName,
      availableTokens: bucket.tokens,
      maxTokens: bucket.config.maxTokens,
      queueLength: this.queues.get(serviceName)?.length || 0,
      lastRequestAt: bucket.lastRequestAt || null
    };
  }
};

DependencyContainer.register('rateLimiter', RateLimiter);

export { RateLimiter };
export default RateLimiter;
