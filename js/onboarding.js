import { CacheManager } from './services/cache-manager.ts';
import { AnalyticsService } from './services/analytics-service.js';

const Onboarding = {
  storageKey: 'rekonime.onboarding',
  isActive: false,

  getCache() {
    return CacheManager;
  },

  getAnalytics() {
    return AnalyticsService;
  },

  hasCompleted() {
    const status = this.getCache().getRaw(this.storageKey, { validate: true });
    return status === 'completed' || status === 'skipped';
  },

  markCompleted() {
    this.getCache().setRaw(this.storageKey, 'completed', { validate: true });
  },

  markSkipped() {
    this.getCache().setRaw(this.storageKey, 'skipped', { validate: true });
  },

  startTour() {
    if (this.isActive) return false;

    const modal = document.getElementById('onboarding-modal');
    if (!modal) return false;

    this.isActive = true;
    modal.classList.remove('onboarding-shell');
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelectorAll('[data-action="onboarding-intent"]').forEach((button) => {
      button.disabled = false;
      button.setAttribute('aria-pressed', 'false');
    });
    this.attachModalListeners(modal);
    this.trackEvent('onboarding_started');
    return true;
  },

  attachModalListeners(modal) {
    if (modal.dataset.onboardingRuntimeBound === 'true') return;
    modal.dataset.onboardingRuntimeBound = 'true';

    modal.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl || !modal.contains(actionEl)) return;

      const action = actionEl.dataset.action;
      if (action === 'onboarding-backdrop' || action === 'onboarding-skip') {
        this.skipTour();
        return;
      }

      if (action === 'onboarding-intent') {
        this.selectIntent(actionEl, modal);
      }
    });

    document.addEventListener('keydown', this.handleKeydown);
  },

  selectIntent(selectedButton, modal) {
    const intentKey = selectedButton.dataset.intentKey;
    modal.querySelectorAll('[data-action="onboarding-intent"]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button === selectedButton));
      button.disabled = true;
    });

    if (intentKey && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rekonime:onboarding-intent', {
        detail: { intentKey }
      }));
    }

    setTimeout(() => {
      if (this.isActive) this.completeTour();
    }, 120);
  },

  handleKeydown(event) {
    if (Onboarding.isActive && event.key === 'Escape') {
      Onboarding.skipTour();
    }
  },

  skipTour() {
    this.trackEvent('onboarding_skipped');
    this.markSkipped();
    this.closeModal();
  },

  completeTour() {
    this.trackEvent('onboarding_completed');
    this.markCompleted();
    this.closeModal();
  },

  closeModal() {
    document.documentElement.removeAttribute('data-onboarding-pending');
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }
    this.isActive = false;
  },

  reopenTour() {
    return this.startTour();
  },

  trackEvent(eventName, data = {}) {
    this.getAnalytics()?.track(eventName, data);
  }
};

export { Onboarding };
export default Onboarding;
