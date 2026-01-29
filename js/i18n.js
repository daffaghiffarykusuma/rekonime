/**
 * Internationalization (i18n) Module
 * Handles translations, date/number formatting, and locale management
 */

const I18n = {
    // Default locale
    currentLocale: 'en',

    // Translation storage
    translations: {},

    // Loading state
    isLoading: false,

    /**
     * Initialize with locale detection
     */
    init() {
        // Detect browser locale or use stored preference
        const stored = localStorage.getItem('rekonime.locale');
        const browserLocale = navigator.language?.split('-')[0];
        this.currentLocale = stored || browserLocale || 'en';

        // Load translations
        return this.loadTranslations(this.currentLocale);
    },

    /**
     * Load translation file
     * @param {string} locale - Locale code
     * @returns {Promise<boolean>}
     */
    async loadTranslations(locale) {
        this.isLoading = true;
        try {
            const response = await fetch(`locales/${locale}.json`);
            if (response.ok) {
                this.translations[locale] = await response.json();
                this.isLoading = false;
                return true;
            }
        } catch (e) {
            console.warn(`Failed to load translations for ${locale}`);
        }

        // Fallback to English
        if (locale !== 'en') {
            this.isLoading = false;
            return this.loadTranslations('en');
        }

        this.isLoading = false;
        return false;
    },

    /**
     * Translate a key
     * @param {string} key - Translation key (dot notation supported)
     * @param {Object} params - Parameters to replace in translation
     * @returns {string}
     */
    t(key, params = {}) {
        const translations = this.translations[this.currentLocale] || {};
        let text = this.getNestedValue(translations, key) || key;

        // Replace parameters
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
        });

        return text;
    },

    /**
     * Get nested object value using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Dot-notation path
     * @returns {any}
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    },

    /**
     * Change locale
     * @param {string} locale - New locale code
     * @returns {Promise<boolean>}
     */
    async setLocale(locale) {
        const success = await this.loadTranslations(locale);
        if (success) {
            this.currentLocale = locale;
            localStorage.setItem('rekonime.locale', locale);
            this.translateDom();
            return true;
        }
        return false;
    },

    /**
     * Get available locales
     * @returns {Array<Object>}
     */
    getAvailableLocales() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' },
            { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' }
        ];
    },

    /**
     * Translate DOM elements with data-i18n attributes
     */
    translateDom() {
        // Translate elements with data-i18n attributes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            el.textContent = this.t(key);
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            el.placeholder = this.t(key);
        });

        // Translate aria-labels
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.dataset.i18nAriaLabel;
            el.setAttribute('aria-label', this.t(key));
        });
    },

    /**
     * Date and time formatting utilities
     */
    dateTime: {
        /**
         * Format date according to current locale
         * @param {Date|string} date - Date to format
         * @param {Object} options - Intl.DateTimeFormat options
         * @returns {string}
         */
        formatDate(date, options = {}) {
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) return '';

            const opts = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                ...options
            };

            return d.toLocaleDateString(I18n.currentLocale, opts);
        },

        /**
         * Format relative time (e.g., "2 days ago")
         * @param {Date|string} date - Date to format
         * @returns {string}
         */
        formatRelative(date) {
            const d = new Date(date);
            if (Number.isNaN(d.getTime())) return '';

            const now = new Date();
            const diffMs = now - d;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return I18n.t('dates.today');
            if (diffDays === 1) return I18n.t('dates.yesterday');
            if (diffDays < 7) return I18n.t('dates.daysAgo', { count: diffDays });
            if (diffDays < 30) return I18n.t('dates.weeksAgo', { count: Math.floor(diffDays / 7) });

            return this.formatDate(date);
        },

        /**
         * Get localized season name
         * @param {string} season - Season name (winter, spring, summer, fall)
         * @returns {string}
         */
        getSeasonName(season) {
            const seasonKey = season.toLowerCase();
            return I18n.t(`seasons.${seasonKey}`);
        },

        /**
         * Format date range
         * @param {Date|string} start - Start date
         * @param {Date|string} end - End date
         * @returns {string}
         */
        formatRange(start, end) {
            const startDate = new Date(start);
            const endDate = new Date(end);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                return '';
            }

            const opts = { year: 'numeric', month: 'short' };
            return `${startDate.toLocaleDateString(I18n.currentLocale, opts)} - ${endDate.toLocaleDateString(I18n.currentLocale, opts)}`;
        }
    },

    /**
     * Number formatting utilities
     */
    number: {
        /**
         * Format decimal number
         * @param {number} value - Number to format
         * @param {number} decimals - Number of decimal places
         * @returns {string}
         */
        format(value, decimals = 1) {
            if (!Number.isFinite(value)) return I18n.t('common.unknown');

            return value.toLocaleString(I18n.currentLocale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        /**
         * Format percentage
         * @param {number} value - Number to format (0-100 or 0-1)
         * @param {boolean} isFraction - Whether value is 0-1 (default: false for 0-100)
         * @returns {string}
         */
        formatPercent(value, isFraction = false) {
            if (!Number.isFinite(value)) return I18n.t('common.unknown');

            const normalizedValue = isFraction ? value : value / 100;

            return normalizedValue.toLocaleString(I18n.currentLocale, {
                style: 'percent',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        },

        /**
         * Format integer
         * @param {number} value - Number to format
         * @returns {string}
         */
        formatInt(value) {
            if (!Number.isFinite(value)) return I18n.t('common.unknown');

            return value.toLocaleString(I18n.currentLocale, {
                maximumFractionDigits: 0
            });
        },

        /**
         * Format compact number (e.g., 1.2K)
         * @param {number} value - Number to format
         * @returns {string}
         */
        formatCompact(value) {
            if (!Number.isFinite(value)) return I18n.t('common.unknown');

            return value.toLocaleString(I18n.currentLocale, {
                notation: 'compact',
                maximumFractionDigits: 1
            });
        }
    },

    /**
     * List formatting utilities
     */
    list: {
        /**
         * Format array as localized list (e.g., "A, B, and C")
         * @param {Array<string>} items - Items to format
         * @param {string} type - List type: 'conjunction', 'disjunction', 'unit'
         * @returns {string}
         */
        format(items, type = 'conjunction') {
            if (!items || items.length === 0) return '';
            if (items.length === 1) return items[0];

            const formatter = new Intl.ListFormat(I18n.currentLocale, {
                style: 'long',
                type: type
            });

            return formatter.format(items);
        }
    }
};

// Expose globally
window.I18n = I18n;
window.t = (key, params) => I18n.t(key, params);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
    I18n.init();
}
