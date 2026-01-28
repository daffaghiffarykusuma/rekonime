/**
 * Theme Manager for Rekonime
 * Handles light/dark/auto theme switching with OS preference detection
 */

const ThemeManager = {
    STORAGE_KEY: 'rekonime.theme',
    themes: ['dark', 'light', 'auto'],
    currentTheme: 'dark',
    osPreferenceQuery: null,

    /**
     * Initialize the theme manager
     */
    init() {
        // Detect OS preference
        this.osPreferenceQuery = window.matchMedia('(prefers-color-scheme: light)');

        // Load saved theme or use OS preference
        const savedTheme = this.loadTheme();
        const initialTheme = savedTheme || 'auto';

        this.applyTheme(initialTheme);

        // Listen for OS preference changes
        this.osPreferenceQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applySystemTheme();
            }
        });
    },

    /**
     * Load theme from localStorage
     */
    loadTheme() {
        if (typeof window === 'undefined') return null;

        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved && this.themes.includes(saved)) {
                return saved;
            }
        } catch (error) {
            // Ignore storage errors (private mode, etc.)
        }
        return null;
    },

    /**
     * Save theme to localStorage
     */
    saveTheme(theme) {
        if (typeof window === 'undefined') return;

        try {
            localStorage.setItem(this.STORAGE_KEY, theme);
        } catch (error) {
            // Ignore storage errors
        }
    },

    /**
     * Detect OS color scheme preference
     */
    detectOSPreference() {
        return this.osPreferenceQuery?.matches ? 'light' : 'dark';
    },

    /**
     * Apply the selected theme
     */
    applyTheme(theme) {
        if (!this.themes.includes(theme)) {
            theme = 'auto';
        }

        this.currentTheme = theme;

        if (theme === 'auto') {
            this.applySystemTheme();
        } else {
            this.setThemeAttribute(theme);
        }

        this.saveTheme(theme);
        this.updateUI();
    },

    /**
     * Apply system theme based on OS preference
     */
    applySystemTheme() {
        const systemTheme = this.detectOSPreference();
        this.setThemeAttribute(systemTheme);
    },

    /**
     * Set the data-theme attribute on document
     */
    setThemeAttribute(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        // Also update theme-color meta for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            const themeColors = {
                dark: '#1A1418',
                light: '#FDF8F5'
            };
            metaThemeColor.setAttribute('content', themeColors[theme] || themeColors.dark);
        }
    },

    /**
     * Get the currently active theme (resolved from auto if needed)
     */
    getActiveTheme() {
        if (this.currentTheme === 'auto') {
            return this.detectOSPreference();
        }
        return this.currentTheme;
    },

    /**
     * Toggle between light and dark
     */
    toggleTheme() {
        const active = this.getActiveTheme();
        const next = active === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
    },

    /**
     * Update UI elements to reflect current theme
     */
    updateUI() {
        // Update any theme toggle buttons
        document.querySelectorAll('[data-theme-option]').forEach(btn => {
            const isActive = btn.dataset.themeOption === this.currentTheme;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    },

    /**
     * Render theme selector for settings panel
     */
    renderThemeSelector() {
        const options = [
            { value: 'dark', label: 'Dark', icon: '🌙' },
            { value: 'light', label: 'Light', icon: '☀️' },
            { value: 'auto', label: 'Auto', icon: '🔄' }
        ];

        return `
      <div class="settings-section settings-section--theme">
        <div class="filter-section-title">Theme</div>
        <div class="theme-selector">
          ${options.map(opt => {
            const isActive = this.currentTheme === opt.value;
            return `
              <button 
                class="theme-option ${isActive ? 'is-active' : ''}"
                data-action="set-theme"
                data-theme-option="${opt.value}"
                type="button"
                aria-pressed="${isActive ? 'true' : 'false'}"
              >
                <span class="theme-option-icon" aria-hidden="true">${opt.icon}</span>
                <span class="theme-option-label">${opt.label}</span>
              </button>
            `;
        }).join('')}
        </div>
        <p class="settings-description">Choose your preferred color scheme. Auto matches your system settings.</p>
      </div>
    `;
    },

    /**
     * Handle theme selection from UI
     */
    handleThemeSelection(theme) {
        this.applyTheme(theme);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});
