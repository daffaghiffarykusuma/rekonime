import { CacheManager } from './cache-manager.js';

/**
 * Analytics abstraction layer.
 */
const AnalyticsService = {
  enabled: true,
  initialized: false,
  queue: [],
  queueLimit: 150,
  storageKey: 'rekonime.analyticsQueue',
  respectDnt: true,

  init({ queueLimit, respectDnt } = {}) {
    if (this.initialized) return;
    this.initialized = true;
    if (Number.isFinite(queueLimit) && queueLimit > 0) {
      this.queueLimit = queueLimit;
    }
    if (typeof respectDnt === 'boolean') {
      this.respectDnt = respectDnt;
    }
    this.queue = this.loadQueue();
    this.flush();
  },

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  },

  shouldTrack() {
    if (!this.enabled) return false;
    if (!this.respectDnt) return true;
    if (typeof navigator === 'undefined') return true;
    return navigator.doNotTrack !== '1';
  },

  track(eventName, params = {}) {
    if (!eventName || !this.shouldTrack()) return false;
    const payload = {
      ...params,
      timestamp: new Date().toISOString()
    };

    if (this.isGtagAvailable()) {
      this.flush();
      gtag('event', eventName, payload);
      return true;
    }

    this.enqueue({ name: eventName, params: payload, queuedAt: payload.timestamp });
    return true;
  },

  isGtagAvailable() {
    return typeof gtag === 'function';
  },

  enqueue(event) {
    if (!event || !event.name) return false;
    this.queue.push(event);
    if (this.queue.length > this.queueLimit) {
      this.queue.splice(0, this.queue.length - this.queueLimit);
    }
    this.persistQueue();
    return true;
  },

  flush() {
    if (!this.isGtagAvailable() || !this.queue.length || !this.shouldTrack()) {
      return false;
    }
    const queued = [...this.queue];
    this.queue = [];
    this.persistQueue();
    queued.forEach((event) => {
      if (event?.name) {
        gtag('event', event.name, event.params || {});
      }
    });
    return true;
  },

  persistQueue() {
    CacheManager.setJSON(this.storageKey, this.queue, { validate: true });
  },

  loadQueue() {
    const stored = CacheManager.getJSON(this.storageKey, { fallback: [], validate: true });
    return Array.isArray(stored) ? stored : [];
  }
};

export { AnalyticsService };
export default AnalyticsService;
