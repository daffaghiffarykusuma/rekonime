import { CacheManager } from '../../shared/services/cache-manager.ts';

/**
 * Discovery module - Surprise Me and Seasonal Discovery features
 * Addresses Category C gaps: C1, C3, C6
 */

const Discovery = {
    // Quality thresholds for surprise me
    qualityThresholds: {
        minRetention: 50,
        minEvidenceWeight: 0.5,
        minSatisfaction: 7.0,
        minEpisodes: 3
    },

    getCache() {
        return CacheManager;
    },

    /**
     * Get random anime with quality filtering
     * @param {Array} weightedCandidates - Taste Profile prepared candidates
     * @param {Object} options - Filter options
     * @returns {Object|null} Random anime meeting criteria
     */
    getSurpriseMe(weightedCandidates, options = {}) {
        const {
            requireRetention = true,
            requireSatisfaction = false
        } = options;

        const candidates = weightedCandidates.filter(candidate => {
            const anime = candidate?.anime;
            if (!anime) return false;

            // The runtime catalog index omits episode lists, so rated-episode evidence in stats decides
            // whether the episode-rating gate applies; loaded episodes are the fallback for older stats.
            const ratedEpisodes = anime.stats?.ratingEvidence?.ratedEpisodes;
            const episodeCount = Number.isFinite(ratedEpisodes)
                ? ratedEpisodes
                : (Array.isArray(anime.episodes) ? anime.episodes.length : 0);
            const hasEpisodes = episodeCount >= this.qualityThresholds.minEpisodes;

            // Quality filters
            if (requireRetention && hasEpisodes) {
                const retention = anime.stats?.retentionScore ?? 0;
                if (retention < this.qualityThresholds.minRetention) return false;
                // Among titles rated enough for this gate, thin evidence pulls strength to the median,
                // which says nothing about quality. Titles below minEpisodes skip the gate entirely.
                const weight = anime.stats?.ratingEvidence?.weight;
                if (Number.isFinite(weight) && weight < this.qualityThresholds.minEvidenceWeight) return false;
            }

            if (requireSatisfaction) {
                const satisfaction = anime.communityScore ?? 0;
                if (satisfaction < this.qualityThresholds.minSatisfaction) return false;
            }

            return true;
        });

        if (candidates.length === 0) return null;

        return this.weightedRandomSelect(candidates);
    },

    /**
     * Weighted random selection
     */
    weightedRandomSelect(weightedCandidates) {
        const totalWeight = weightedCandidates.reduce((sum, c) => sum + (c.weight ?? 1), 0);
        let random = Math.random() * totalWeight;

        for (const candidate of weightedCandidates) {
            random -= (candidate.weight ?? 1);
            if (random <= 0) {
                return candidate.anime || candidate;
            }
        }

        const last = weightedCandidates[weightedCandidates.length - 1];
        return last?.anime || last;
    },

    recordSurprise(animeId) {
        // Store surprise history for this session
        try {
            const history = this.getSurpriseHistory();
            history.unshift({ animeId, timestamp: Date.now() });

            // Keep only last 20
            const trimmed = history.slice(0, 20);
            const cache = this.getCache();
            cache.setJSON('rekonime.surpriseHistory', trimmed, { validate: true });
        } catch (e) {
            // Ignore storage errors
        }
    },

    getSurpriseHistory() {
        const cache = this.getCache();
        return cache.getJSON('rekonime.surpriseHistory', { fallback: [], validate: true });
    },

    // ==========================================
    // Seasonal Discovery
    // ==========================================

    /**
     * Get current anime season based on date
     */
    getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const year = now.getFullYear();

        // Anime seasons: Winter (Jan-Mar), Spring (Apr-Jun), Summer (Jul-Sep), Fall (Oct-Dec)
        let season;
        if (month <= 2) season = 'Winter';
        else if (month <= 5) season = 'Spring';
        else if (month <= 8) season = 'Summer';
        else season = 'Fall';

        return { season, year, seasonYear: `${season} ${year}` };
    },

    /**
     * Get next season
     */
    getNextSeason() {
        const current = this.getCurrentSeason();
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
        const currentIndex = seasons.indexOf(current.season);

        let nextIndex = (currentIndex + 1) % 4;
        let nextYear = current.year;
        if (nextIndex === 0) nextYear++;

        return {
            season: seasons[nextIndex],
            year: nextYear,
            seasonYear: `${seasons[nextIndex]} ${nextYear}`
        };
    },

    /**
     * Get previous season
     */
    getPreviousSeason() {
        const current = this.getCurrentSeason();
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
        const currentIndex = seasons.indexOf(current.season);

        let prevIndex = (currentIndex - 1 + 4) % 4;
        let prevYear = current.year;
        if (prevIndex === 3) prevYear--;

        return {
            season: seasons[prevIndex],
            year: prevYear,
            seasonYear: `${seasons[prevIndex]} ${prevYear}`
        };
    },

    /**
     * Check if a season exists in the catalog
     */
    hasSeason(animeList, seasonYear) {
        return animeList.some(anime =>
            anime.season && anime.year && `${anime.season} ${anime.year}` === seasonYear
        );
    },

    /**
     * Get anime for a specific season
     */
    getSeasonAnime(animeList, seasonYear) {
        return animeList.filter(anime =>
            anime.season && anime.year && `${anime.season} ${anime.year}` === seasonYear
        );
    },

    /**
     * Render seasonal quick filters data
     */
    getSeasonalFilters(animeList) {
        const current = this.getCurrentSeason();
        const next = this.getNextSeason();
        const previous = this.getPreviousSeason();

        const filters = [];

        if (this.hasSeason(animeList, current.seasonYear)) {
            filters.push({
                key: 'current',
                label: 'This season',
                value: current.seasonYear,
                highlight: true
            });
        }

        if (this.hasSeason(animeList, previous.seasonYear)) {
            filters.push({
                key: 'previous',
                label: 'Last season',
                value: previous.seasonYear,
                highlight: false
            });
        }

        if (this.hasSeason(animeList, next.seasonYear)) {
            filters.push({
                key: 'next',
                label: 'Next season',
                value: next.seasonYear,
                highlight: false
            });
        }

        return filters;
    }
};

export { Discovery };
