// @ts-nocheck

/**
 * Filter Presets - Quick starting points for discovering anime
 * Pre-configured filter combinations for common use cases
 */

import { getExperienceSignals } from './experience-cues.ts';

const FilterPresets = {
    /**
     * Preset definitions with labels, descriptions, and configurations
     */
    presets: {
        'binge-worthy': {
            label: 'Stable episode ratings',
            description: 'Stable episode ratings with few rating dips',
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
            label: 'Community favorites',
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
            description: 'Strong episode rating strength with lower community ratings',
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
            description: 'Slice-of-life and iyashikei suggestions',
            icon: 'E',
            sort: 'comfort',
            filterFn: (anime) => {
                return getExperienceSignals(anime).gentle;
            }
        },

        'strong-starters': {
            label: 'Strong openings',
            description: 'Highly rated opening episodes',
            icon: 'H',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.threeEpisodeHook >= 80;
            }
        },

        'great-endings': {
            label: 'Highly rated later episodes',
            description: 'Highly rated later episodes',
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
    }
};

export { FilterPresets };
