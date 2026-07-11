// @ts-nocheck
import { AnalyticsService } from './services/analytics-service.js';

/**
 * Filter Presets - Quick starting points for discovering anime
 * Pre-configured filter combinations for common use cases
 */

const FilterPresets = {
    getAnalytics() {
        return AnalyticsService;
    },
    /**
     * Preset definitions with labels, descriptions, and configurations
     */
    presets: {
        'binge-worthy': {
            label: 'Binge Ready',
            description: 'Smooth pacing and fewer rough patches',
            icon: 'B',
            sort: 'flowState',
            minRetention: 75,
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.flowState >= 70 && stats.stressSpikes <= 2;
            }
        },

        'critical-darlings': {
            label: 'Critics and Fans Love',
            description: 'Top community ratings on MyAnimeList',
            icon: 'C',
            sort: 'satisfaction',
            minMalScore: 8.0,
            filterFn: (anime) => {
                return anime.communityScore >= 8.0;
            }
        },

        'hidden-gems': {
            label: 'Overlooked Standouts',
            description: 'Strong finish confidence with less mainstream buzz',
            icon: 'O',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.retentionScore >= 80 && anime.communityScore <= 7.5;
            }
        },

        'easy-watches': {
            label: 'Easy to Settle Into',
            description: 'Comfortable picks with a gentle learning curve',
            icon: 'E',
            sort: 'comfort',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                const isComfortable = stats.comfortScore >= 70;
                const isSliceOfLife = anime.genres?.includes('Slice of Life');
                const isComedy = anime.genres?.includes('Comedy');
                return isComfortable || isSliceOfLife || isComedy;
            }
        },

        'strong-starters': {
            label: 'Hooks You Fast',
            description: 'Strong opening episodes that pull you in quickly',
            icon: 'H',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.threeEpisodeHook >= 80;
            }
        },

        'great-endings': {
            label: 'Great Payoffs',
            description: 'Endings that feel worth the time investment',
            icon: 'G',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.worthFinishing >= 75;
            }
        }
    },

    /**
     * Get all preset keys
     */
    getKeys() {
        return Object.keys(this.presets);
    },

    /**
     * Get a preset by key
     */
    get(key) {
        return this.presets[key] || null;
    },

    /**
     * Get all presets for rendering
     */
    getAll() {
        return Object.entries(this.presets).map(([key, preset]) => ({
            key,
            ...preset
        }));
    },

    /**
     * Apply a preset to filter data
     */
    applyPreset(key, animeData) {
        const preset = this.get(key);
        if (!preset) return animeData;

        return animeData.filter(preset.filterFn);
    },

    /**
     * Get sort option for a preset
     */
    getSortForPreset(key) {
        const preset = this.get(key);
        if (!preset) return 'retention';

        const sortMap = {
            'flowState': 'retention',
            'comfort': 'retention',
            'satisfaction': 'satisfaction',
            'retention': 'retention'
        };

        return sortMap[preset.sort] || 'retention';
    },

    /**
     * Get preset badge/chip HTML
     */
    renderPresetChip(key, isActive = false) {
        const preset = this.get(key);
        if (!preset) return '';

        return `
      <button class="preset-chip ${isActive ? 'is-active' : ''}"
              data-action="apply-preset"
              data-preset="${key}"
              title="${preset.description}">
        <span class="preset-icon">${preset.icon}</span>
        <span class="preset-label">${preset.label}</span>
      </button>
    `;
    },

    /**
     * Render all preset chips
     */
    renderPresetChips(activeKey = null) {
        const presets = this.getAll();
        if (presets.length === 0) return '';

        return `
      <div class="filter-presets">
        <span class="presets-label">Curated shortcuts:</span>
        <div class="preset-chips">
          ${presets.map(p => this.renderPresetChip(p.key, p.key === activeKey)).join('')}
        </div>
      </div>
    `;
    },

    /**
     * Render preset section for filter modal
     */
    renderPresetSection() {
        const presets = this.getAll();

        return `
      <div class="filter-section filter-section--presets">
        <div class="filter-section-title">Curated shortcuts</div>
        <p class="filter-section-hint">Start with proven discovery paths instead of a blank slate.</p>
        <div class="preset-grid">
          ${presets.map(p => `
            <button class="preset-card" data-action="apply-preset" data-preset="${p.key}">
              <span class="preset-card-label">${p.label}</span>
              <span class="preset-card-desc">${p.description}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    },

    /**
     * Check if anime matches a preset
     */
    matchesPreset(key, anime) {
        const preset = this.get(key);
        if (!preset) return false;
        return preset.filterFn(anime);
    },

    /**
     * Get matching presets for an anime
     */
    getMatchingPresets(anime) {
        return this.getKeys().filter(key => this.matchesPreset(key, anime));
    },

    /**
     * Track preset usage
     */
    trackUsage(key) {
        const analytics = this.getAnalytics();
        if (analytics) {
            analytics.track('filter_preset_used', { preset: key });
        }
    }
};

export { FilterPresets };
export default FilterPresets;
