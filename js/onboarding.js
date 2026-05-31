import { CacheManager } from './services/cache-manager.ts';
import { AnalyticsService } from './services/analytics-service.js';
import { setHTML } from './security/trusted-types.js';

/**
 * Onboarding system for first-time users
 * Provides a guided tour through key concepts
 */

const Onboarding = {
  storageKey: 'rekonime.onboarding',
  stepStorageKey: 'rekonime.tourStep',
  steps: ['welcome', 'retention', 'satisfaction', 'discovery'],
  currentStep: 0,
  isActive: false,

  getCache() {
    return CacheManager;
  },

  getAnalytics() {
    return AnalyticsService;
  },

  /**
   * Check if user has completed or skipped onboarding
   */
  hasCompleted() {
    const cache = this.getCache();
    const status = cache.getRaw(this.storageKey, { validate: true });
    return status === 'completed' || status === 'skipped';
  },

  /**
   * Mark onboarding as completed
   */
  markCompleted() {
    const cache = this.getCache();
    cache.setRaw(this.storageKey, 'completed', { validate: true });
    cache.removeItem(this.stepStorageKey);
  },

  /**
   * Mark onboarding as skipped
   */
  markSkipped() {
    const cache = this.getCache();
    cache.setRaw(this.storageKey, 'skipped', { validate: true });
    cache.setRaw(this.stepStorageKey, String(this.currentStep), { validate: true });
  },

  /**
   * Get the saved step if user previously skipped
   */
  getSavedStep() {
    const cache = this.getCache();
    const saved = cache.getRaw(this.stepStorageKey, { validate: true });
    return saved ? parseInt(saved, 10) : 0;
  },

  /**
   * Start the onboarding tour
   */
  startTour() {
    if (this.isActive) return;

    this.currentStep = this.getSavedStep();
    this.isActive = true;
    this.renderModal();
    this.showStep(this.currentStep);
    this.trackEvent('onboarding_started');
  },

  /**
   * Show a specific step
   */
  showStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      this.completeTour();
      return;
    }

    this.currentStep = stepIndex;
    const stepName = this.steps[stepIndex];
    const content = this.getStepContent(stepName);

    const contentEl = document.getElementById('onboarding-content');
    const indicators = document.querySelectorAll('.onboarding-indicator');

    if (contentEl) {
      setHTML(contentEl, content);
      this.attachStepListeners();
    }

    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('is-active', index === stepIndex);
    });
  },

  /**
   * Get content for each step
   */
  getStepContent(stepName) {
    const contents = {
      welcome: `
        <div class="onboarding-step">
          <div class="onboarding-icon" aria-hidden="true">R</div>
          <h2 class="onboarding-title">Welcome to Rekonime</h2>
          <p class="onboarding-description">
            Rekonime helps you skip the filler and find anime that stays rewarding from the first episode to the finale.
          </p>
          <div class="onboarding-value-props">
            <div class="value-prop">
              <span class="value-prop-icon" aria-hidden="true">1</span>
              <span class="value-prop-text">Finish Rate highlights which shows keep viewers invested</span>
            </div>
            <div class="value-prop">
              <span class="value-prop-icon" aria-hidden="true">2</span>
              <span class="value-prop-text">Community scores reveal what viewers loved most</span>
            </div>
            <div class="value-prop">
              <span class="value-prop-icon" aria-hidden="true">3</span>
              <span class="value-prop-text">Mood-first filters help you find the right pick faster</span>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Show me around
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Skip to recommendations
            </button>
          </div>
        </div>
      `,
      retention: `
        <div class="onboarding-step">
          <div class="onboarding-icon" aria-hidden="true">R</div>
          <h2 class="onboarding-title">What Finish Rate Tells You</h2>
          <p class="onboarding-description">
            Finish Rate is Rekonime's clearest signal for staying power: a 0 to 100 score that estimates how reliably a series keeps viewers watching.
          </p>
          <div class="onboarding-retention-demo">
            <div class="retention-demo-high">
              <div class="retention-demo-bar">
                <progress class="retention-demo-progress" value="92" max="100" aria-label="High Finish Rate example"></progress>
              </div>
              <div class="retention-demo-info">
                <span class="retention-demo-score">92%</span>
                <span class="retention-demo-label">High Finish Rate</span>
              </div>
              <p class="retention-demo-desc">A strong sign the series keeps delivering</p>
            </div>
            <div class="retention-demo-low">
              <div class="retention-demo-bar">
                <progress class="retention-demo-progress is-low" value="45" max="100" aria-label="Low Finish Rate example"></progress>
              </div>
              <div class="retention-demo-info">
                <span class="retention-demo-score">45%</span>
                <span class="retention-demo-label">Low Finish Rate</span>
              </div>
              <p class="retention-demo-desc">Expect more drop-off before the ending</p>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Next: community score
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Skip tour
            </button>
          </div>
        </div>
      `,
      satisfaction: `
        <div class="onboarding-step">
          <div class="onboarding-icon" aria-hidden="true">S</div>
          <h2 class="onboarding-title">What Community Scores Add</h2>
          <p class="onboarding-description">
            Community scores from MyAnimeList add the audience verdict: how strongly people rated the anime after they watched it.
          </p>
          <div class="onboarding-satisfaction-demo">
            <div class="satisfaction-example">
              <span class="satisfaction-score">8.7</span>
              <span class="satisfaction-divider">/</span>
              <span class="satisfaction-max">10</span>
              <span class="satisfaction-source">on MyAnimeList</span>
            </div>
          </div>
          <div class="onboarding-two-scores">
            <h3>Why both signals matter</h3>
            <div class="two-scores-grid">
              <div class="score-box">
                <span class="score-box-icon" aria-hidden="true">R</span>
                <span class="score-box-title">Finish Rate</span>
                <span class="score-box-desc">Staying power: will it keep you watching?</span>
              </div>
              <div class="score-box">
                <span class="score-box-icon" aria-hidden="true">S</span>
                <span class="score-box-title">Satisfaction</span>
                <span class="score-box-desc">Audience payoff: did viewers think it delivered?</span>
              </div>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Next: finding your next watch
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Skip tour
            </button>
          </div>
        </div>
      `,
      discovery: `
        <div class="onboarding-step">
          <div class="onboarding-icon" aria-hidden="true">Go</div>
          <h2 class="onboarding-title">Find the Right Watch Faster</h2>
          <p class="onboarding-description">
            Use search, filters, and tailored recommendations to move from browsing to a confident pick faster.
          </p>
          <div class="onboarding-features">
            <div class="feature-item">
              <span class="feature-icon" aria-hidden="true">A</span>
              <div class="feature-info">
                <span class="feature-title">Smarter search</span>
                <span class="feature-desc">Search by English, Japanese, or romaji titles</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon" aria-hidden="true">B</span>
              <div class="feature-info">
                <span class="feature-title">Genre and theme filters</span>
                <span class="feature-desc">Zero in on the exact vibe you want tonight</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon" aria-hidden="true">C</span>
              <div class="feature-info">
                <span class="feature-title">Progress tracking</span>
                <span class="feature-desc">Save what to watch next and keep tabs on what you finish</span>
              </div>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-complete">
              Start discovering
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-restart">
              Restart the tour
            </button>
          </div>
        </div>
      `
    };

    return contents[stepName] || contents.welcome;
  },

  /**
   * Render the onboarding modal structure
   */
  renderModal() {
    let modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.classList.add('visible');
      return;
    }

    modal = document.createElement('div');
    modal.id = 'onboarding-modal';
    modal.className = 'onboarding-overlay';
    modal.setAttribute('aria-hidden', 'false');

    setHTML(modal, `
      <div class="onboarding-backdrop" data-action="onboarding-backdrop"></div>
      <div class="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button class="onboarding-close" data-action="onboarding-skip" aria-label="Close tour">
          <span aria-hidden="true">&times;</span>
        </button>
        <div class="onboarding-content" id="onboarding-content">
          <!-- Step content rendered here -->
        </div>
        <div class="onboarding-progress">
          ${this.steps.map((_, index) => `
            <button class="onboarding-indicator ${index === 0 ? 'is-active' : ''}"
                    data-action="onboarding-goto"
                    data-step="${index}"
                    aria-label="Go to step ${index + 1}">
            </button>
          `).join('')}
        </div>
      </div>
    `);

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add('visible');
    });

    this.attachModalListeners();
  },

  /**
   * Attach event listeners for step content
   */
  attachStepListeners() {
    const content = document.getElementById('onboarding-content');
    if (!content) return;

    content.querySelectorAll('[data-action="onboarding-next"]').forEach(btn => {
      btn.addEventListener('click', () => this.nextStep());
    });

    content.querySelectorAll('[data-action="onboarding-skip"]').forEach(btn => {
      btn.addEventListener('click', () => this.skipTour());
    });

    content.querySelectorAll('[data-action="onboarding-complete"]').forEach(btn => {
      btn.addEventListener('click', () => this.completeTour());
    });

    content.querySelectorAll('[data-action="onboarding-restart"]').forEach(btn => {
      btn.addEventListener('click', () => this.restartTour());
    });
  },

  /**
   * Attach event listeners for modal
   */
  attachModalListeners() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-action="onboarding-backdrop"]').forEach(el => {
      el.addEventListener('click', () => this.skipTour());
    });

    modal.querySelectorAll('[data-action="onboarding-skip"]').forEach(el => {
      el.addEventListener('click', () => this.skipTour());
    });

    modal.querySelectorAll('[data-action="onboarding-goto"]').forEach(el => {
      el.addEventListener('click', (e) => {
        const step = parseInt(e.currentTarget.dataset.step, 10);
        this.showStep(step);
      });
    });

    document.addEventListener('keydown', this.handleKeydown.bind(this));
  },

  /**
   * Handle keyboard navigation
   */
  handleKeydown(event) {
    if (!this.isActive) return;

    if (event.key === 'Escape') {
      this.skipTour();
    } else if (event.key === 'ArrowRight') {
      this.nextStep();
    } else if (event.key === 'ArrowLeft' && this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  },

  /**
   * Go to next step
   */
  nextStep() {
    this.showStep(this.currentStep + 1);
  },

  /**
   * Skip the tour
   */
  skipTour() {
    this.trackEvent('onboarding_skipped', { step: this.currentStep });
    this.markSkipped();
    this.closeModal();
  },

  /**
   * Complete the tour
   */
  completeTour() {
    this.trackEvent('onboarding_completed');
    this.markCompleted();
    this.closeModal();
  },

  /**
   * Restart the tour
   */
  restartTour() {
    this.currentStep = 0;
    this.showStep(0);
  },

  /**
   * Close the modal
   */
  closeModal() {
    const modal = document.getElementById('onboarding-modal');
    if (modal) {
      modal.classList.remove('visible');
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
    this.isActive = false;
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
  },

  /**
   * Reopen the tour (from help button)
   */
  reopenTour() {
    this.currentStep = 0;
    this.startTour();
  },

  /**
   * Track events for analytics
   */
  trackEvent(eventName, data = {}) {
    const analytics = this.getAnalytics();
    if (analytics) {
      analytics.track(eventName, data);
    }
  }
};

export { Onboarding };
export default Onboarding;
