import { CircuitBreaker } from './circuitBreaker.js';

/**
 * Health Monitor - tracks connectivity and data freshness.
 */
const HealthMonitor = {
  config: {
    checkIntervalMs: 30000,
    staleThresholdMs: 60 * 60 * 1000
  },
  initialized: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastCheckAt: null,
  dataFreshness: new Map(),
  listeners: [],
  checkIntervalId: null,
  serviceLabels: {
    catalog: 'Catalog',
    reviews: 'Reviews'
  },
  services: {
    catalog: {
      healthy: true,
      stale: false,
      lastUpdated: null,
      lastCheck: null
    },
    reviews: {
      healthy: true,
      state: CircuitBreaker.states.CLOSED,
      failures: 0,
      lastFailureTime: null,
      lastCheck: null
    }
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupConnectivityListeners();
    this.startPeriodicChecks();
    this.performHealthChecks();
  },

  setupConnectivityListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners('connectivity', { online: true });
      this.performHealthChecks();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners('connectivity', { online: false });
      this.performHealthChecks();
    });
  },

  startPeriodicChecks() {
    if (this.checkIntervalId) return;
    this.checkIntervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkIntervalMs);
  },

  stopPeriodicChecks() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  },

  markDataFresh(dataType, timestamp) {
    const time = Number.isFinite(timestamp) ? timestamp : Date.now();
    this.dataFreshness.set(dataType, time);
  },

  isDataStale(dataType) {
    const timestamp = this.dataFreshness.get(dataType);
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp > this.config.staleThresholdMs;
  },

  updateCatalogService() {
    const timestamp = this.dataFreshness.get('catalog');
    const hasData = Number.isFinite(timestamp);
    const stale = hasData ? this.isDataStale('catalog') : true;
    this.services.catalog = {
      healthy: hasData,
      stale,
      lastUpdated: hasData ? timestamp : null,
      lastCheck: Date.now()
    };
  },

  updateReviewService() {
    const status = CircuitBreaker.getStatus('jikan-api');
    this.services.reviews = {
      healthy: status.healthy,
      state: status.state,
      failures: status.failures,
      lastFailureTime: status.lastFailureTime,
      lastCheck: Date.now()
    };
  },

  async performHealthChecks() {
    this.lastCheckAt = Date.now();
    this.updateCatalogService();
    this.updateReviewService();
    const status = this.getStatus();
    this.notifyListeners('health-check', status);
    return status;
  },

  getStatus() {
    const services = Object.entries(this.services).map(([name, service]) => ({
      name,
      label: this.serviceLabels[name] || name,
      ...service
    }));
    const allHealthy = services.every(service => service.healthy);
    return {
      online: this.isOnline,
      healthy: this.isOnline && allHealthy,
      degraded: this.isOnline && !allHealthy,
      services,
      lastCheck: this.lastCheckAt
    };
  },

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  },

  notifyListeners(event, data) {
    this.listeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[HealthMonitor] Listener error:', error);
      }
    });
  }
};

export { HealthMonitor };
export default HealthMonitor;
