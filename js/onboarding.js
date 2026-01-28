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

  /**
   * Check if user has completed or skipped onboarding
   */
  hasCompleted() {
    try {
      const status = localStorage.getItem(this.storageKey);
      return status === 'completed' || status === 'skipped';
    } catch (error) {
      return true;
    }
  },

  /**
   * Mark onboarding as completed
   */
  markCompleted() {
    try {
      localStorage.setItem(this.storageKey, 'completed');
      localStorage.removeItem(this.stepStorageKey);
    } catch (error) {
      // Ignore storage errors
    }
  },

  /**
   * Mark onboarding as skipped
   */
  markSkipped() {
    try {
      localStorage.setItem(this.storageKey, 'skipped');
      localStorage.setItem(this.stepStorageKey, String(this.currentStep));
    } catch (error) {
      // Ignore storage errors
    }
  },

  /**
   * Get the saved step if user previously skipped
   */
  getSavedStep() {
    try {
      const saved = localStorage.getItem(this.stepStorageKey);
      return saved ? parseInt(saved, 10) : 0;
    } catch (error) {
      return 0;
    }
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
      contentEl.innerHTML = content;
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
          <div class="onboarding-icon">🌸</div>
          <h2 class="onboarding-title">Welcome to Rekonime</h2>
          <p class="onboarding-description">
            Find anime you'll actually finish. We analyze watch-through patterns to recommend 
            shows that stay engaging from start to finish.
          </p>
          <div class="onboarding-value-props">
            <div class="value-prop">
              <span class="value-prop-icon">📊</span>
              <span class="value-prop-text">Retention Scores predict completion</span>
            </div>
            <div class="value-prop">
              <span class="value-prop-icon">⭐</span>
              <span class="value-prop-text">Satisfaction from MAL community</span>
            </div>
            <div class="value-prop">
              <span class="value-prop-icon">🎯</span>
              <span class="value-prop-text">Smart filtering by mood & genre</span>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Take a quick tour
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Start exploring
            </button>
          </div>
        </div>
      `,
      retention: `
        <div class="onboarding-step">
          <div class="onboarding-icon">📈</div>
          <h2 class="onboarding-title">Understanding Retention Score</h2>
          <p class="onboarding-description">
            Our signature metric: a 0-100 scale measuring how consistently viewers 
            watch through an entire series without dropping off.
          </p>
          <div class="onboarding-retention-demo">
            <div class="retention-demo-high">
              <div class="retention-demo-bar">
                <span class="retention-demo-fill" style="width: 92%"></span>
              </div>
              <div class="retention-demo-info">
                <span class="retention-demo-score">92%</span>
                <span class="retention-demo-label">High retention</span>
              </div>
              <p class="retention-demo-desc">Most viewers finish the whole series</p>
            </div>
            <div class="retention-demo-low">
              <div class="retention-demo-bar">
                <span class="retention-demo-fill is-low" style="width: 45%"></span>
              </div>
              <div class="retention-demo-info">
                <span class="retention-demo-score">45%</span>
                <span class="retention-demo-label">Low retention</span>
              </div>
              <p class="retention-demo-desc">Many viewers drop off early</p>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Next: Satisfaction Score
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Skip tour
            </button>
          </div>
        </div>
      `,
      satisfaction: `
        <div class="onboarding-step">
          <div class="onboarding-icon">⭐</div>
          <h2 class="onboarding-title">Understanding Satisfaction</h2>
          <p class="onboarding-description">
            Community ratings from MyAnimeList (MAL), the world's largest anime database. 
            This represents overall quality and enjoyment.
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
            <h3>Why two scores matter:</h3>
            <div class="two-scores-grid">
              <div class="score-box">
                <span class="score-box-icon">📊</span>
                <span class="score-box-title">Retention</span>
                <span class="score-box-desc">Consistency — will you finish?</span>
              </div>
              <div class="score-box">
                <span class="score-box-icon">⭐</span>
                <span class="score-box-title">Satisfaction</span>
                <span class="score-box-desc">Quality — is it actually good?</span>
              </div>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-next">
              Next: Finding Anime
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-skip">
              Skip tour
            </button>
          </div>
        </div>
      `,
      discovery: `
        <div class="onboarding-step">
          <div class="onboarding-icon">🎯</div>
          <h2 class="onboarding-title">Finding Your Next Watch</h2>
          <p class="onboarding-description">
            Discover anime that matches your mood with powerful filtering and smart recommendations.
          </p>
          <div class="onboarding-features">
            <div class="feature-item">
              <span class="feature-icon">🔍</span>
              <div class="feature-info">
                <span class="feature-title">Smart Search</span>
                <span class="feature-desc">Find by English, Japanese, or romaji titles</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🏷️</span>
              <div class="feature-info">
                <span class="feature-title">Genre & Theme Filters</span>
                <span class="feature-desc">Mix and match to find your vibe</span>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔖</span>
              <div class="feature-info">
                <span class="feature-title">Bookmarks</span>
                <span class="feature-desc">Save interesting titles for later</span>
              </div>
            </div>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary onboarding-primary" data-action="onboarding-complete">
              Start exploring
            </button>
            <button class="btn btn-outline onboarding-secondary" data-action="onboarding-restart">
              Restart tour
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

    modal.innerHTML = `
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
    `;

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
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, data);
    }
  }
};

// Expose to global scope for App integration
window.Onboarding = Onboarding;
