/**
 * Discovery module - Surprise Me, Seasonal Discovery, and Trending features
 * Addresses Category C gaps: C1, C3, C6
 */

const Discovery = {
    // Quality thresholds for surprise me
    qualityThresholds: {
        minRetention: 70,
        minSatisfaction: 7.0,
        minEpisodes: 3
    },

    /**
     * Get random anime with quality filtering
     * @param {Array} animeList - Full anime catalog
     * @param {Object} options - Filter options
     * @returns {Object|null} Random anime meeting criteria
     */
    getSurpriseMe(animeList, options = {}) {
        const {
            excludeIds = [],
            requireRetention = true,
            requireSatisfaction = false,
            useBookmarks = true
        } = options;

        // Build candidate pool
        let candidates = animeList.filter(anime => {
            // Exclude already seen/bookmarked
            if (excludeIds.includes(anime.id)) return false;

            const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length >= this.qualityThresholds.minEpisodes;

            // Quality filters
            if (requireRetention && hasEpisodes) {
                const retention = anime.stats?.retentionScore ?? 0;
                if (retention < this.qualityThresholds.minRetention) return false;
            }

            if (requireSatisfaction) {
                const satisfaction = anime.communityScore ?? 0;
                if (satisfaction < this.qualityThresholds.minSatisfaction) return false;
            }

            return true;
        });

        // Weight by bookmark preferences if available
        if (useBookmarks && typeof App !== 'undefined' && App.bookmarkIds?.length > 0) {
            candidates = this.weightByBookmarkPreferences(candidates);
        }

        if (candidates.length === 0) return null;

        // Weighted random selection
        return this.weightedRandomSelect(candidates);
    },

    /**
     * Weight candidates based on bookmark genre/theme preferences
     */
    weightByBookmarkPreferences(candidates) {
        if (typeof App === 'undefined' || !App.getBookmarkedAnime) {
            return candidates.map(anime => ({ anime, weight: 1 }));
        }

        const bookmarkedAnime = App.getBookmarkedAnime();
        if (bookmarkedAnime.length === 0) {
            return candidates.map(anime => ({ anime, weight: 1 }));
        }

        // Extract preferred genres/themes from bookmarks
        const preferredGenres = new Set();
        const preferredThemes = new Set();

        bookmarkedAnime.forEach(anime => {
            anime.genres?.forEach(g => preferredGenres.add(g.toLowerCase()));
            anime.themes?.forEach(t => preferredThemes.add(t.toLowerCase()));
        });

        // Score each candidate by preference match
        return candidates.map(anime => {
            let weight = 1;

            const genreMatches = anime.genres?.filter(g => preferredGenres.has(g.toLowerCase())).length ?? 0;
            const themeMatches = anime.themes?.filter(t => preferredThemes.has(t.toLowerCase())).length ?? 0;

            weight += genreMatches * 0.5;
            weight += themeMatches * 0.3;

            return { anime, weight };
        });
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

    /**
     * Track surprise me usage for analytics
     */
    trackSurpriseMe(animeId, source = 'random') {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'surprise_me_used', {
                anime_id: animeId,
                source: source
            });
        }

        // Store in localStorage for session history
        try {
            const history = this.getSurpriseHistory();
            history.unshift({ animeId, timestamp: Date.now() });

            // Keep only last 20
            const trimmed = history.slice(0, 20);
            localStorage.setItem('rekonime.surpriseHistory', JSON.stringify(trimmed));
        } catch (e) {
            // Ignore storage errors
        }
    },

    getSurpriseHistory() {
        try {
            return JSON.parse(localStorage.getItem('rekonime.surpriseHistory') || '[]');
        } catch {
            return [];
        }
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
                label: '🌸 This Season',
                value: current.seasonYear,
                highlight: true
            });
        }

        if (this.hasSeason(animeList, previous.seasonYear)) {
            filters.push({
                key: 'previous',
                label: '🍂 Last Season',
                value: previous.seasonYear,
                highlight: false
            });
        }

        if (this.hasSeason(animeList, next.seasonYear)) {
            filters.push({
                key: 'next',
                label: '🌱 Next Season',
                value: next.seasonYear,
                highlight: false
            });
        }

        return filters;
    },

    // ==========================================
    // Trending Discovery
    // ==========================================

    /**
     * Calculate trending score for anime
     * Based on: MAL score, seasonality, quality metrics
     */
    calculateTrendingScore(anime) {
        let score = 0;
        const stats = anime?.stats;

        // Base: MAL score weighted heavily
        if (Number.isFinite(anime.communityScore)) {
            score += anime.communityScore * 10;
        }

        // Boost for recent anime (within last 2 seasons)
        const isRecent = this.isRecentAnime(anime);
        if (isRecent) {
            score += 15;
        }

        // Boost for high retention with good satisfaction
        if (stats?.retentionScore >= 80 && anime.communityScore >= 7.5) {
            score += 10;
        }

        // Boost for strong finale (people talking about it)
        if (stats?.worthFinishing >= 80) {
            score += 5;
        }

        // Boost for controversial/discussion-worthy
        if (stats?.controversyPotential >= 70) {
            score += 8;
        }

        // Random factor to simulate real-time trends
        score += Math.random() * 10;

        return score;
    },

    /**
     * Check if anime is from recent seasons
     */
    isRecentAnime(anime) {
        if (!anime.year || !anime.season) return false;

        const current = this.getCurrentSeason();
        const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

        const animeYear = parseInt(anime.year);
        const animeSeasonIndex = seasons.indexOf(anime.season);
        const currentSeasonIndex = seasons.indexOf(current.season);

        if (animeSeasonIndex === -1) return false;

        // Within last 2 seasons
        const seasonDiff = (current.year - animeYear) * 4 + (currentSeasonIndex - animeSeasonIndex);
        return seasonDiff >= 0 && seasonDiff <= 2;
    },

    /**
     * Get trending anime
     */
    getTrending(animeList, limit = 6) {
        const scored = animeList.map(anime => ({
            anime,
            trendingScore: this.calculateTrendingScore(anime)
        }));

        return scored
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, limit)
            .map(entry => ({
                ...entry.anime,
                trendingRank: entry.trendingScore,
                isTrending: true
            }));
    },

    /**
     * Get "Popular This Week" (simulated rotation)
     */
    getPopularThisWeek(animeList, limit = 6) {
        // Use current week number for consistent rotation
        const weekNumber = this.getWeekNumber(new Date());

        // Seed random with week number for consistency during the week
        const candidates = animeList.filter(a => a.communityScore >= 7.5);

        // Shuffle based on week
        const shuffled = this.seededShuffle(candidates, weekNumber);

        return shuffled.slice(0, limit).map((anime, index) => ({
            ...anime,
            weeklyRank: index + 1
        }));
    },

    /**
     * Get week number of year
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    /**
     * Seeded shuffle for consistent weekly results
     */
    seededShuffle(array, seed) {
        const shuffled = [...array];
        let currentIndex = shuffled.length;

        // Simple seeded random
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        while (currentIndex !== 0) {
            const randomIndex = Math.floor(random() * currentIndex);
            currentIndex--;
            [shuffled[currentIndex], shuffled[randomIndex]] =
                [shuffled[randomIndex], shuffled[currentIndex]];
        }

        return shuffled;
    }
};

// Expose to global scope
window.Discovery = Discovery;

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Discovery;
}
