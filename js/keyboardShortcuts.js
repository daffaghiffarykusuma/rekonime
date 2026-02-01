import { CacheManager } from './services/cache-manager.js';

/**
 * Keyboard Shortcuts System for Rekonime
 * Provides discoverable keyboard navigation throughout the app
 */

const KeyboardShortcuts = {
    STORAGE_KEY: 'rekonime.shortcutsAcknowledged',
    isModalOpen: false,
    appRef: null,

    setApp(app) {
        this.appRef = app;
    },

    getApp() {
        return this.appRef;
    },

    getCache() {
        return CacheManager;
    },

    // Define all keyboard shortcuts
    shortcuts: {
        global: {
            '?': {
                action: 'showHelp',
                description: 'Show keyboard shortcuts',
                scope: 'Global'
            },
            '/': {
                action: 'focusSearch',
                description: 'Focus search box',
                scope: 'Global'
            },
            'Escape': {
                action: 'closeModal',
                description: 'Close modal or dropdown',
                scope: 'Global'
            },
            'b': {
                action: 'goToBookmarks',
                description: 'Go to bookmarks page',
                scope: 'Global'
            },
            'f': {
                action: 'openFilters',
                description: 'Open filter panel',
                scope: 'Global'
            },
            's': {
                action: 'toggleSettings',
                description: 'Open settings',
                scope: 'Global'
            },
            'r': {
                action: 'surpriseMe',
                description: 'Surprise me (random anime)',
                scope: 'Global'
            },
            'h': {
                action: 'goHome',
                description: 'Go to home / clear filters',
                scope: 'Global'
            }
        },
        modal: {
            'ArrowLeft': {
                action: 'previousAnime',
                description: 'Previous anime',
                scope: 'Detail Modal'
            },
            'ArrowRight': {
                action: 'nextAnime',
                description: 'Next anime',
                scope: 'Detail Modal'
            }
        }
    },

    /**
     * Initialize the keyboard shortcuts system
     */
    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.showFirstTimeHint();
    },

    /**
     * Show hint for first-time users
     */
    showFirstTimeHint() {
        if (typeof window === 'undefined') return;

        try {
            const cache = this.getCache();
            const acknowledged = cache.getRaw(this.STORAGE_KEY, { validate: true });
            if (acknowledged) return;

            // Show hint after a delay
            setTimeout(() => {
                const hint = document.createElement('div');
                hint.className = 'keyboard-hint';
                hint.setAttribute('role', 'status');
                hint.setAttribute('aria-live', 'polite');
                hint.innerHTML = `
          <span class="keyboard-hint-text">Press <kbd>?</kbd> for keyboard shortcuts</span>
          <button class="keyboard-hint-close" aria-label="Dismiss hint">&times;</button>
        `;

                document.body.appendChild(hint);

                // Animate in
                requestAnimationFrame(() => {
                    hint.classList.add('is-visible');
                });

                // Auto-dismiss after 8 seconds
                const autoDismiss = setTimeout(() => {
                    this.dismissHint(hint);
                }, 8000);

                // Click to dismiss
                hint.querySelector('.keyboard-hint-close').addEventListener('click', () => {
                    clearTimeout(autoDismiss);
                    this.dismissHint(hint);
                });

                // Mark as acknowledged on first interaction
                const markAcknowledged = () => {
                    const cache = this.getCache();
                    cache.setRaw(this.STORAGE_KEY, 'true', { validate: true });
                    document.removeEventListener('keydown', markAcknowledged);
                    document.removeEventListener('click', markAcknowledged);
                };

                document.addEventListener('keydown', markAcknowledged, { once: true });
                document.addEventListener('click', markAcknowledged, { once: true });
            }, 2000);
        } catch (error) {
            // Ignore storage errors
        }
    },

    /**
     * Dismiss the keyboard hint
     */
    dismissHint(hint) {
        hint.classList.remove('is-visible');
        setTimeout(() => {
            hint.remove();
        }, 300);
    },

    /**
     * Handle keyboard events
     */
    handleKeydown(event) {
        // Don't trigger shortcuts when typing in inputs (except Escape)
        const isTyping = event.target.matches('input, textarea, select');
        if (isTyping && event.key !== 'Escape') {
            return;
        }

        // Don't trigger if shortcuts modal is already open
        if (this.isModalOpen && event.key !== 'Escape' && event.key !== '?') {
            return;
        }

        // Check for modal-specific shortcuts when modal is open
        const isModalActive = document.getElementById('detail-modal')?.classList.contains('visible');

        let shortcut = null;

        if (isModalActive && this.shortcuts.modal[event.key]) {
            shortcut = this.shortcuts.modal[event.key];
        } else if (this.shortcuts.global[event.key]) {
            shortcut = this.shortcuts.global[event.key];
        }

        if (shortcut) {
            // Don't prevent default for certain keys that need native behavior
            if (!isTyping || event.key === 'Escape') {
                event.preventDefault();
            }
            this.executeAction(shortcut.action);
        }
    },

    /**
     * Execute a shortcut action
     */
    executeAction(action) {
        switch (action) {
            case 'showHelp':
                this.showShortcutsModal();
                break;
            case 'focusSearch':
                this.focusSearch();
                break;
            case 'closeModal':
                this.closeModal();
                break;
            case 'goToBookmarks':
                this.goToBookmarks();
                break;
            case 'openFilters':
                this.openFilters();
                break;
            case 'toggleSettings':
                this.toggleSettings();
                break;
            case 'surpriseMe':
                this.surpriseMe();
                break;
            case 'goHome':
                this.goHome();
                break;
            case 'previousAnime':
                this.navigateAnime(-1);
                break;
            case 'nextAnime':
                this.navigateAnime(1);
                break;
        }
    },

    /**
     * Show the keyboard shortcuts modal
     */
    showShortcutsModal() {
        if (this.isModalOpen) {
            this.closeShortcutsModal();
            return;
        }

        this.isModalOpen = true;

        // Mark as acknowledged
        try {
            const cache = this.getCache();
            cache.setRaw(this.STORAGE_KEY, 'true', { validate: true });
        } catch (error) {
            // Ignore
        }

        // Remove any existing hint
        document.querySelector('.keyboard-hint')?.remove();

        // Build modal content
        const globalShortcuts = Object.entries(this.shortcuts.global)
            .map(([key, data]) => this.renderShortcutRow(key, data))
            .join('');

        const modalShortcuts = Object.entries(this.shortcuts.modal)
            .map(([key, data]) => this.renderShortcutRow(key, data))
            .join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay shortcuts-modal-overlay';
        modal.id = 'shortcuts-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'shortcuts-modal-title');

        modal.innerHTML = `
      <div class="modal-content shortcuts-modal-content">
        <button class="modal-close" id="close-shortcuts" type="button" aria-label="Close keyboard shortcuts">
          &times;
        </button>
        <div class="shortcuts-modal-body">
          <h2 class="shortcuts-modal-title" id="shortcuts-modal-title">
            <span class="shortcuts-icon" aria-hidden="true">⌨️</span>
            Keyboard Shortcuts
          </h2>
          
          <div class="shortcuts-section">
            <h3 class="shortcuts-section-title">Global Shortcuts</h3>
            <div class="shortcuts-list">
              ${globalShortcuts}
            </div>
          </div>

          <div class="shortcuts-section">
            <h3 class="shortcuts-section-title">When Viewing Anime Details</h3>
            <div class="shortcuts-list">
              ${modalShortcuts}
            </div>
          </div>

          <div class="shortcuts-tip">
            <span class="shortcuts-tip-icon" aria-hidden="true">💡</span>
            <span>Tip: These shortcuts work anywhere on the site, except when typing in search or filter fields.</span>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(modal);
        document.body.classList.add('is-scroll-locked');

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('visible');
            modal.querySelector('.modal-close').focus();
        });

        // Close handlers
        const closeBtn = modal.querySelector('#close-shortcuts');
        closeBtn.addEventListener('click', () => this.closeShortcutsModal());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeShortcutsModal();
            }
        });

        // Focus trap
        this.setupFocusTrap(modal);
    },

    /**
     * Render a single shortcut row
     */
    renderShortcutRow(key, data) {
        const keyDisplay = key === ' ' ? 'Space' : key;
        return `
      <div class="shortcut-row">
        <kbd class="shortcut-key">${keyDisplay}</kbd>
        <span class="shortcut-description">${this.escapeHtml(data.description)}</span>
      </div>
    `;
    },

    /**
     * Close the shortcuts modal
     */
    closeShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (!modal) return;

        modal.classList.remove('visible');
        setTimeout(() => {
            modal.remove();
            this.isModalOpen = false;
            if (!document.querySelector('.modal-overlay.visible')) {
                document.body.classList.remove('is-scroll-locked');
            }
        }, 300);
    },

    /**
     * Set up focus trap for modal
     */
    setupFocusTrap(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        });
    },

    /**
     * Focus the search input
     */
    focusSearch() {
        const searchInput = document.getElementById('header-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    },

    /**
     * Close any open modal
     */
    closeModal() {
        // Close shortcuts modal first if open
        if (this.isModalOpen) {
            this.closeShortcutsModal();
            return;
        }

        // Use App's modal handling if available
        const app = this.getApp();
        if (app && typeof app.handleGlobalEscape === 'function') {
            const event = { key: 'Escape' };
            app.handleGlobalEscape(event);
        }
    },

    /**
     * Navigate to bookmarks page
     */
    goToBookmarks() {
        window.location.href = 'bookmarks.html';
    },

    /**
     * Open filter panel
     */
    openFilters() {
        const app = this.getApp();
        if (app && typeof app.toggleFilterPanel === 'function') {
            app.toggleFilterPanel();
        }
    },

    /**
     * Toggle settings modal
     */
    toggleSettings() {
        const app = this.getApp();
        if (app && typeof app.toggleSettingsModal === 'function') {
            app.toggleSettingsModal();
        }
    },

    /**
     * Trigger surprise me feature
     */
    surpriseMe() {
        const surpriseBtn = document.getElementById('surprise-toggle');
        if (surpriseBtn) {
            surpriseBtn.click();
        }
    },

    /**
     * Go to home and clear filters
     */
    goHome() {
        const app = this.getApp();
        if (app && typeof app.clearAllFilters === 'function') {
            app.clearAllFilters();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Navigate to previous/next anime in detail modal
     */
    navigateAnime(direction) {
        const app = this.getApp();
        if (!app || !app.currentAnimeId || !app.animeData) return;

        const currentIndex = app.animeData.findIndex(a => a.id === app.currentAnimeId);
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < app.animeData.length) {
            const nextAnime = app.animeData[newIndex];
            app.showAnimeDetail(nextAnime.id);
        }
    },

    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

export { KeyboardShortcuts };
export default KeyboardShortcuts;
