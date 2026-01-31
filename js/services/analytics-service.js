import { DependencyContainer } from '../core/dependency-container.js';

/**
 * Analytics abstraction layer.
 */
const AnalyticsService = {
  enabled: true,

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  },

  track(eventName, params = {}) {
    if (!this.enabled || !eventName) return false;
    if (typeof gtag === 'function') {
      gtag('event', eventName, params);
      return true;
    }
    return false;
  }
};

DependencyContainer.register('analytics', AnalyticsService);

export { AnalyticsService };
export default AnalyticsService;
