/**
 * Filter Presets - Quick starting points for discovering anime
 * Pre-configured filter combinations for common use cases
 */

const FilterPresets = {
    /**
     * Preset definitions with labels, descriptions, and configurations
     */
    presets: {
        'binge-worthy': {
            label: '🍿 Binge-Worthy',
            description: 'High flow state, low stress spikes',
            icon: '🍿',
            sort: 'flowState',
            minRetention: 75,
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.flowState >= 70 && stats.stressSpikes <= 2;
            }
        },

        'critical-darlings': {
            label: '⭐ Critical Darlings',
            description: 'Top satisfaction scores from MAL',
            icon: '⭐',
            sort: 'satisfaction',
            minMalScore: 8.0,
            filterFn: (anime) => {
                return anime.communityScore >= 8.0;
            }
        },

        'hidden-gems': {
            label: '💎 Hidden Gems',
            description: 'High retention, lower MAL scores',
            icon: '💎',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.retentionScore >= 80 && anime.communityScore <= 7.5;
            }
        },

        'easy-watches': {
            label: '😌 Easy Watches',
            description: 'Low barrier to entry, comfortable',
            icon: '😌',
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
            label: '🚀 Strong Starters',
            description: 'Hook you in the first 3 episodes',
            icon: '🚀',
            sort: 'retention',
            filterFn: (anime) => {
                const stats = anime.stats;
                if (!stats) return false;
                return stats.threeEpisodeHook >= 80;
            }
        },

        'great-endings': {
            label: '🏁 Great Endings',
            description: 'Stick the landing',
            icon: '🏁',
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
        <span class="preset-label">${preset.label.replace(/^\S+\s/, '')}</span>
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
        <span class="presets-label">Quick picks:</span>
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
        <div class="filter-section-title">Quick Picks</div>
        <p class="filter-section-hint">Jump-start your search with curated selections</p>
        <div class="preset-grid">
          ${presets.map(p => `
            <button class="preset-card" data-action="apply-preset" data-preset="${p.key}">
              <span class="preset-card-icon">${p.icon}</span>
              <span class="preset-card-label">${p.label.replace(/^\S+\s/, '')}</span>
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
        if (typeof gtag !== 'undefined') {
            gtag('event', 'filter_preset_used', { preset: key });
        }
    }
};

// Expose to global scope
window.FilterPresets = FilterPresets;
