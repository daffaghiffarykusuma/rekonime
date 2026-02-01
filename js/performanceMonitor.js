import { AnalyticsService } from './services/analytics-service.js';

/**
 * Performance monitoring for Core Web Vitals and custom timings.
 */
const PerformanceMonitor = {
  initialized: false,
  observers: [],
  customTimers: new Map(),
  inpValue: null,
  clsValue: 0,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.observeCoreWebVitals();
    this.bindCustomEvents();
  },

  observeCoreWebVitals() {
    if (typeof PerformanceObserver !== 'function') return;

    this.observeEntry('largest-contentful-paint', (entry) => {
      this.reportMetric('LCP', entry.startTime);
    });

    this.observeEntry('layout-shift', (entry) => {
      if (!entry.hadRecentInput) {
        this.clsValue += entry.value || 0;
        this.reportMetric('CLS', this.clsValue);
      }
    });

    this.observeEntry('event', (entry) => {
      if (!Number.isFinite(entry.duration)) return;
      if (entry.interactionId) {
        this.inpValue = Math.max(this.inpValue || 0, entry.duration);
        this.reportMetric('INP', this.inpValue);
      }
    });

    this.observeEntry('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.reportMetric('FCP', entry.startTime);
      }
    });

    this.observeEntry('navigation', (entry) => {
      const ttfb = entry.responseStart;
      if (Number.isFinite(ttfb)) {
        this.reportMetric('TTFB', ttfb);
      }
    });
  },

  observeEntry(entryType, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (!entries || !entries.length) return;
        entries.forEach(entry => callback(entry));
      });
      observer.observe({ type: entryType, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      // Ignore observer failures in unsupported browsers
    }
  },

  bindCustomEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('rekonime:data-load-start', (event) => {
      const source = event?.detail?.source || 'unknown';
      this.customTimers.set(`data-${source}`, this.now());
    });
    window.addEventListener('rekonime:data-load-end', (event) => {
      const source = event?.detail?.source || 'unknown';
      const key = `data-${source}`;
      const start = this.customTimers.get(key);
      if (!Number.isFinite(start)) return;
      const duration = this.now() - start;
      this.customTimers.delete(key);
      this.reportMetric('data_load', duration, { source });
    });
    window.addEventListener('rekonime:modal-opened', (event) => {
      const duration = event?.detail?.durationMs;
      if (Number.isFinite(duration)) {
        this.reportMetric('modal_open', duration, {
          animeId: event.detail?.animeId,
          cached: event.detail?.cached
        });
      }
    });
  },

  reportMetric(name, value, detail = {}) {
    if (!Number.isFinite(value)) return false;
    if (AnalyticsService?.track) {
      AnalyticsService.track('performance_metric', {
        metric_name: name,
        metric_value: Math.round(value),
        value: Math.round(value),
        ...detail
      });
    }
    return true;
  },

  now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  },

  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
};

export { PerformanceMonitor };
export default PerformanceMonitor;
