# Category C: Discovery & Navigation - Implementation Plan

## Overview
This plan addresses 7 discovery gaps identified in the Gap Analysis. The goal is to transform Rekonime from a passive catalog into a proactive discovery platform that adapts to user behavior and surfaces content intelligently.

---

## Gap C1: "Surprise Me" Random Discovery

### Problem
No random discovery mechanism exists. Users must actively filter/browse to find content.

### Solution
Implement a "Surprise Me" feature that suggests random anime with smart filtering to ensure quality.

### Technical Specifications

#### UI Components
```html
<!-- Add to header-actions in index.html -->
<button class="btn btn-sm btn-primary surprise-btn" id="surprise-toggle" type="button" aria-label="Surprise me with a random anime">
  <span class="surprise-icon" aria-hidden="true">🎲</span>
  <span class="surprise-label">Surprise Me</span>
</button>
```

#### CSS Classes (add to styles.css)
```css
.surprise-btn {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  color: var(--text-inverse);
  border: none;
  font-weight: 600;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.surprise-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 183, 197, 0.4);
}

.surprise-icon {
  display: inline-block;
  animation: dice-roll 0.5s ease-out;
}

@keyframes dice-roll {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(90deg); }
  50% { transform: rotate(180deg); }
  75% { transform: rotate(270deg); }
  100% { transform: rotate(360deg); }
}
```

#### JavaScript Implementation (js/discovery.js - NEW FILE)
```javascript
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
    if (useBookmarks && App.bookmarkIds.length > 0) {
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
    const bookmarkedAnime = App.getBookmarkedAnime();
    if (bookmarkedAnime.length === 0) return candidates;

    // Extract preferred genres/themes from bookmarks
    const preferredGenres = new Set();
    const preferredThemes = new Set();
    
    bookmarkedAnime.forEach(anime => {
      anime.genres?.forEach(g => preferredGenres.add(g));
      anime.themes?.forEach(t => preferredThemes.add(t));
    });

    // Score each candidate by preference match
    return candidates.map(anime => {
      let weight = 1;
      
      const genreMatches = anime.genres?.filter(g => preferredGenres.has(g)).length ?? 0;
      const themeMatches = anime.themes?.filter(t => preferredThemes.has(t)).length ?? 0;
      
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
    
    return weightedCandidates[weightedCandidates.length - 1]?.anime || 
           weightedCandidates[weightedCandidates.length - 1];
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
    const history = this.getSurpriseHistory();
    history.unshift({ animeId, timestamp: Date.now() });
    
    // Keep only last 20
    const trimmed = history.slice(0, 20);
    localStorage.setItem('rekonime.surpriseHistory', JSON.stringify(trimmed));
  },

  getSurpriseHistory() {
    try {
      return JSON.parse(localStorage.getItem('rekonime.surpriseHistory') || '[]');
    } catch {
      return [];
    }
  }
};

window.Discovery = Discovery;
```

#### Integration in app.js
Add event handler in `setupActionDelegates`:
```javascript
if (action === 'surprise-me') {
  const surprise = Discovery.getSurpriseMe(App.animeData, {
    excludeIds: App.bookmarkIds,
    useBookmarks: true
  });
  
  if (surprise) {
    Discovery.trackSurpriseMe(surprise.id);
    this.showAnimeDetail(surprise.id);
  }
  return;
}
```

---

## Gap C2: Watchlist Integration with Progress Tracking

### Problem
Only binary bookmarks exist (on/off). Users cannot track watching progress.

### Solution
Extend the bookmark system to include watch status and episode progress.

### Technical Specifications

#### Data Schema Extension
```javascript
// Current: bookmarks stored as string[] of IDs
// New: watchlist stored as object[] with progress

const WatchlistSchema = {
  animeId: string,           // Anime identifier
  status: 'planning' | 'watching' | 'completed' | 'dropped' | 'on-hold',
  progress: number,          // Episodes watched
  totalEpisodes: number,     // Total episodes (cached)
  rating: number | null,     // User rating 1-10 (optional)
  startedAt: string | null,  // ISO date
  completedAt: string | null,// ISO date
  notes: string,             // User notes
  updatedAt: string          // ISO date for sync
};
```

#### New File: js/watchlist.js
```javascript
const Watchlist = {
  storageKey: 'rekonime.watchlist',
  
  // Status labels and icons
  statuses: {
    planning: { label: 'Plan to Watch', icon: '📋', color: 'var(--status-planning)' },
    watching: { label: 'Watching', icon: '▶️', color: 'var(--status-watching)' },
    completed: { label: 'Completed', icon: '✅', color: 'var(--status-completed)' },
    dropped: { label: 'Dropped', icon: '❌', color: 'var(--status-dropped)' },
    'on-hold': { label: 'On Hold', icon: '⏸️', color: 'var(--status-onhold)' }
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    } catch {
      return [];
    }
  },

  get(animeId) {
    return this.getAll().find(item => item.animeId === animeId) || null;
  },

  add(animeId, status = 'planning', progress = 0) {
    const anime = App.animeData.find(a => a.id === animeId);
    if (!anime) return false;

    const watchlist = this.getAll();
    const existingIndex = watchlist.findIndex(item => item.animeId === animeId);
    
    const entry = {
      animeId,
      status,
      progress,
      totalEpisodes: anime.episodes?.length || anime.stats?.episodeCount || 0,
      rating: null,
      startedAt: status === 'watching' ? new Date().toISOString() : null,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      notes: '',
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      watchlist[existingIndex] = { ...watchlist[existingIndex], ...entry };
    } else {
      watchlist.push(entry);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(watchlist));
    this.notifyUpdate(animeId);
    return true;
  },

  update(animeId, updates) {
    const watchlist = this.getAll();
    const index = watchlist.findIndex(item => item.animeId === animeId);
    if (index < 0) return false;

    watchlist[index] = {
      ...watchlist[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Auto-update completedAt
    if (updates.status === 'completed' && !watchlist[index].completedAt) {
      watchlist[index].completedAt = new Date().toISOString();
    }

    localStorage.setItem(this.storageKey, JSON.stringify(watchlist));
    this.notifyUpdate(animeId);
    return true;
  },

  updateProgress(animeId, progress) {
    const entry = this.get(animeId);
    if (!entry) return false;

    const total = entry.totalEpisodes;
    let status = entry.status;
    
    // Auto-update status based on progress
    if (progress >= total && total > 0) {
      status = 'completed';
    } else if (progress > 0 && status === 'planning') {
      status = 'watching';
    }

    return this.update(animeId, { progress, status });
  },

  remove(animeId) {
    const watchlist = this.getAll().filter(item => item.animeId !== animeId);
    localStorage.setItem(this.storageKey, JSON.stringify(watchlist));
    this.notifyUpdate(animeId);
    return true;
  },

  getStats() {
    const watchlist = this.getAll();
    return {
      total: watchlist.length,
      byStatus: {
        planning: watchlist.filter(w => w.status === 'planning').length,
        watching: watchlist.filter(w => w.status === 'watching').length,
        completed: watchlist.filter(w => w.status === 'completed').length,
        dropped: watchlist.filter(w => w.status === 'dropped').length,
        'on-hold': watchlist.filter(w => w.status === 'on-hold').length
      },
      totalEpisodesWatched: watchlist.reduce((sum, w) => sum + (w.progress || 0), 0)
    };
  },

  notifyUpdate(animeId) {
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('watchlist:updated', { 
      detail: { animeId } 
    }));
  }
};

window.Watchlist = Watchlist;
```

#### UI Components for Detail Modal
```html
<!-- Add to detail modal content -->
<div class="watchlist-section" id="watchlist-section">
  <div class="watchlist-status-bar">
    <div class="status-selector">
      <button class="status-btn" data-status="planning">📋 Plan to Watch</button>
      <button class="status-btn" data-status="watching">▶️ Watching</button>
      <button class="status-btn" data-status="completed">✅ Completed</button>
      <button class="status-btn" data-status="dropped">❌ Dropped</button>
      <button class="status-btn" data-status="on-hold">⏸️ On Hold</button>
    </div>
    
    <div class="progress-tracker" id="progress-tracker">
      <span class="progress-label">Progress:</span>
      <div class="progress-input-group">
        <input type="number" class="progress-input" id="progress-input" min="0" value="0">
        <span class="progress-total">/ 24</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
    </div>
  </div>
</div>
```

---

## Gap C3: Seasonal Discovery - "This Season" Quick Filter

### Problem
Season filter exists but is not highlighted. No "This Season" quick filter.

### Solution
Add automatic detection of current anime season and prominent "This Season" quick filter.

### Technical Specifications

#### JavaScript Implementation (add to app.js or discovery.js)
```javascript
const SeasonalDiscovery = {
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
      `${anime.season} ${anime.year}` === seasonYear
    );
  },

  /**
   * Get anime for a specific season
   */
  getSeasonAnime(animeList, seasonYear) {
    return animeList.filter(anime => 
      `${anime.season} ${anime.year}` === seasonYear
    );
  },

  /**
   * Render seasonal quick filters
   */
  renderSeasonalFilters(animeList) {
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
  }
};

window.SeasonalDiscovery = SeasonalDiscovery;
```

#### UI Integration
Add seasonal filters section to index.html after the quick-filters:
```html
<div class="seasonal-filters" id="seasonal-filters">
  <div class="seasonal-filters-label">Seasonal:</div>
  <div class="seasonal-chips" id="seasonal-chips">
    <!-- Populated by JS -->
  </div>
</div>
```

#### CSS for Seasonal Filters
```css
.seasonal-filters {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-top: var(--space-sm);
}

.seasonal-filters-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.seasonal-chips {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.seasonal-chip {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.seasonal-chip:hover {
  border-color: var(--accent-primary);
  background: var(--bg-hover);
}

.seasonal-chip.is-highlight {
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  color: var(--text-inverse);
  border-color: transparent;
  font-weight: 600;
}

.seasonal-chip.active {
  box-shadow: 0 0 0 2px var(--accent-primary);
}
```

---

## Gap C4: Recommendation Diversity - Multiple Algorithms

### Problem
Single scoring formula for all recommendations (retention * 0.75 + satisfaction * 0.25).

### Solution
Implement multiple recommendation modes that users can switch between.

### Technical Specifications

#### Extend recommendations.js with modes
```javascript
// Add to Recommendations object
const Recommendations = {
  // ... existing code ...

  /**
   * Available recommendation modes
   */
  modes: {
    balanced: {
      label: 'Balanced',
      description: 'Best of both worlds',
      icon: '⚖️',
      weights: { retention: 0.75, satisfaction: 0.25 }
    },
    binge: {
      label: 'Binge Mode',
      description: 'High retention, hard to stop watching',
      icon: '🔥',
      weights: { retention: 0.9, satisfaction: 0.1 },
      boosters: ['flowState', 'threeEpisodeHook']
    },
    quality: {
      label: 'Critical Acclaim',
      description: 'Highest community ratings',
      icon: '⭐',
      weights: { retention: 0.3, satisfaction: 0.7 }
    },
    discovery: {
      label: 'Hidden Gems',
      description: 'High retention, lower popularity',
      icon: '💎',
      weights: { retention: 0.8, satisfaction: 0.2 },
      filter: (anime) => (anime.communityScore || 0) < 7.8
    },
    comfort: {
      label: 'Comfort Shows',
      description: 'Easy to watch, low stress',
      icon: '😌',
      weights: { retention: 0.6, satisfaction: 0.4 },
      boosters: ['comfortScore'],
      filter: (anime) => (anime.stats?.comfortScore || 0) > 70
    }
  },

  currentMode: 'balanced',

  /**
   * Set recommendation mode
   */
  setMode(modeKey) {
    if (this.modes[modeKey]) {
      this.currentMode = modeKey;
      return true;
    }
    return false;
  },

  /**
   * Get current mode
   */
  getCurrentMode() {
    return this.modes[this.currentMode];
  },

  /**
   * Enhanced recommendation scoring with mode support
   */
  scoreAnimeWithMode(anime, modeKey = this.currentMode) {
    const mode = this.modes[modeKey];
    if (!mode) return this.scoreAnime(anime);

    // Apply mode filter if exists
    if (mode.filter && !mode.filter(anime)) {
      return 0;
    }

    const retentionScore = anime?.stats?.retentionScore ?? 0;
    const malSatisfactionScore = Number.isFinite(anime?.communityScore) ? anime.communityScore : 0;
    const malSatisfactionScaled = malSatisfactionScore * 10;

    // Base score from weights
    let score = (retentionScore * mode.weights.retention) + 
                (malSatisfactionScaled * mode.weights.satisfaction);

    // Apply boosters
    if (mode.boosters) {
      mode.boosters.forEach(booster => {
        const boosterValue = anime?.stats?.[booster];
        if (Number.isFinite(boosterValue)) {
          score += boosterValue * 0.1; // 10% boost
        }
      });
    }

    return score;
  },

  /**
   * Get recommendations with mode
   */
  getRecommendationsWithMode(animeList, modeKey = this.currentMode, limit = 6) {
    const mode = this.modes[modeKey];
    if (!mode) return this.getRecommendations(animeList, limit);

    if (!animeList || animeList.length === 0) return [];

    const scored = animeList.map(anime => ({
      anime,
      recScore: this.scoreAnimeWithMode(anime, modeKey),
      reason: this.getRecommendationReasonForMode(anime, modeKey)
    }));

    return scored
      .filter(s => s.recScore > 0)
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, limit)
      .map(entry => ({ ...entry.anime, reason: entry.reason }));
  },

  /**
   * Get recommendation reason based on mode
   */
  getRecommendationReasonForMode(anime, modeKey = this.currentMode) {
    const mode = this.modes[modeKey];
    const stats = anime?.stats;
    
    switch (modeKey) {
      case 'binge':
        if (stats?.flowState >= 85) return 'Flows perfectly - hard to pause';
        if (stats?.threeEpisodeHook >= 85) return 'Hooks you immediately';
        return 'Built for binge-watching';
        
      case 'quality':
        if (anime.communityScore >= 8.5) return 'Critically acclaimed';
        return 'Highly rated by the community';
        
      case 'discovery':
        if (stats?.retentionScore >= 85) return 'Underappreciated gem';
        return 'Worth more attention';
        
      case 'comfort':
        if (stats?.comfortScore >= 80) return 'Perfect comfort viewing';
        return 'Easy, enjoyable watching';
        
      default:
        return this.getRecommendationReason(anime);
    }
  },

  /**
   * Render mode selector
   */
  renderModeSelector() {
    return `
      <div class="recommendation-modes">
        <span class="modes-label">Discover by:</span>
        <div class="mode-chips">
          ${Object.entries(this.modes).map(([key, mode]) => `
            <button class="mode-chip ${key === this.currentMode ? 'active' : ''}" 
                    data-action="set-rec-mode" 
                    data-mode="${key}"
                    title="${mode.description}">
              <span class="mode-icon">${mode.icon}</span>
              <span class="mode-label">${mode.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }
};
```

#### UI Components for Mode Selector
```css
.recommendation-modes {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--space-md);
}

.modes-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.mode-chips {
  display: flex;
  gap: var(--space-xs);
  overflow-x: auto;
  scrollbar-width: none;
}

.mode-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  border: 1px solid transparent;
  font-size: var(--text-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-chip:hover {
  background: var(--bg-hover);
}

.mode-chip.active {
  background: var(--accent-primary);
  color: var(--text-inverse);
}
```

---

## Gap C5: "Because You Watched" Personalization

### Problem
Similar anime exists but not personalized based on user's bookmarks.

### Solution
Create personalized recommendations based on user's bookmarked anime.

### Technical Specifications

#### Extend recommendations.js
```javascript
// Add to Recommendations object
const Recommendations = {
  // ... existing code ...

  /**
   * Get personalized "Because You Watched" recommendations
   * @param {Array} animeList - Full catalog
   * @param {Array} bookmarkedIds - User's bookmarked anime IDs
   * @param {number} limit - Max recommendations
   * @returns {Object} { recommendations: Array, basedOn: Object }
   */
  getBecauseYouWatched(animeList, bookmarkedIds, limit = 6) {
    if (!bookmarkedIds || bookmarkedIds.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Get bookmarked anime data
    const bookmarkedAnime = bookmarkedIds
      .map(id => animeList.find(a => a.id === id))
      .filter(Boolean);

    if (bookmarkedAnime.length === 0) {
      return { recommendations: [], basedOn: null };
    }

    // Pick a seed anime (most recent bookmark or random)
    const seedAnime = this.selectSeedAnime(bookmarkedAnime);
    
    // Get recommendations based on seed
    const recommendations = this.getSimilarAnime(
      animeList.filter(a => !bookmarkedIds.includes(a.id)),
      seedAnime,
      limit + 5 // Get extra for filtering
    );

    // Filter out already bookmarked and rank by relevance
    const filtered = recommendations
      .filter(r => !bookmarkedIds.includes(r.anime.id))
      .slice(0, limit);

    return {
      recommendations: filtered.map(r => ({
        ...r.anime,
        reason: this.getPersonalizedReason(r, seedAnime),
        matchDetails: {
          sharedGenres: r.sharedGenres,
          sharedThemes: r.sharedThemes,
          retentionAlignment: r.retentionAlignment,
          satisfactionAlignment: r.satisfactionAlignment
        }
      })),
      basedOn: seedAnime
    };
  },

  /**
   * Select the best seed anime from bookmarks
   */
  selectSeedAnime(bookmarkedAnime) {
    // Prefer anime with both genres and themes
    const withTags = bookmarkedAnime.filter(a => 
      a.genres?.length > 0 && a.themes?.length > 0
    );

    if (withTags.length === 0) {
      return bookmarkedAnime[0];
    }

    // Score each by how good it is for recommendations
    const scored = withTags.map(anime => {
      let score = 0;
      
      // Prefer anime with diverse tags
      score += (anime.genres?.length || 0) * 10;
      score += (anime.themes?.length || 0) * 10;
      
      // Prefer higher quality anime
      score += (anime.stats?.retentionScore || 0) * 0.5;
      score += (anime.communityScore || 0) * 5;
      
      return { anime, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].anime;
  },

  /**
   * Generate personalized reason text
   */
  getPersonalizedReason(similarityResult, seedAnime) {
    const { sharedGenres, sharedThemes, similarityScore } = similarityResult;
    
    // High similarity
    if (similarityScore >= 0.7 && sharedGenres.length >= 2) {
      return `Very similar to ${seedAnime.title}`;
    }
    
    // Genre-focused
    if (sharedGenres.length >= 2 && sharedThemes.length === 0) {
      const genres = sharedGenres.slice(0, 2).join(' + ');
      return `Same ${genres} vibes as ${seedAnime.title}`;
    }
    
    // Theme-focused
    if (sharedThemes.length >= 2 && sharedGenres.length === 0) {
      const themes = sharedThemes.slice(0, 2).join(' + ');
      return `${themes} like ${seedAnime.title}`;
    }
    
    // Mixed
    if (sharedGenres.length > 0 && sharedThemes.length > 0) {
      return `Fans of ${seedAnime.title} also enjoy`;
    }
    
    return `Because you watched ${seedAnime.title}`;
  },

  /**
   * Render "Because You Watched" section
   */
  renderBecauseYouWatchedSection(animeList, bookmarkedIds) {
    const { recommendations, basedOn } = this.getBecauseYouWatched(
      animeList, 
      bookmarkedIds, 
      6
    );

    if (recommendations.length === 0) {
      return '';
    }

    return `
      <section class="because-you-watched-section" id="because-you-watched-section">
        <div class="byw-header">
          <h2>Because You Watched</h2>
          <div class="byw-seed">
            <img src="${basedOn.cover}" alt="" class="byw-seed-cover">
            <span class="byw-seed-title">${basedOn.title}</span>
          </div>
        </div>
        <div class="byw-grid">
          ${recommendations.map(anime => this.renderRecommendationCard(anime)).join('')}
        </div>
      </section>
    `;
  }
};
```

#### CSS for "Because You Watched"
```css
.because-you-watched-section {
  padding: var(--space-lg);
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-radius: var(--radius-lg);
  margin: var(--space-lg) 0;
}

.byw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.byw-header h2 {
  font-size: var(--text-xl);
  font-weight: 600;
}

.byw-seed {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.byw-seed-cover {
  width: 32px;
  height: 45px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.byw-seed-title {
  font-weight: 500;
  color: var(--text-secondary);
}

.byw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md);
}
```

---

## Gap C6: Trending/Popular Section

### Problem
No social proof indicators beyond MAL scores. No trending section.

### Solution
Add a "Trending Now" section based on community activity and bookmarks.

### Technical Specifications

#### Since we don't have real-time data, simulate trending:
```javascript
const TrendingDiscovery = {
  /**
   * Calculate trending score for anime
   * Based on: MAL score volatility, bookmark velocity (simulated), seasonality
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
    // In production, this would be actual view/bookmark data
    score += Math.random() * 10;
    
    return score;
  },

  /**
   * Check if anime is from recent seasons
   */
  isRecentAnime(anime) {
    if (!anime.year || !anime.season) return false;
    
    const current = SeasonalDiscovery.getCurrentSeason();
    const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
    
    const animeYear = anime.year;
    const animeSeasonIndex = seasons.indexOf(anime.season);
    const currentSeasonIndex = seasons.indexOf(current.season);
    
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

window.TrendingDiscovery = TrendingDiscovery;
```

#### UI for Trending Section
```html
<section class="trending-section" id="trending-section">
  <div class="trending-header">
    <div class="trending-title-group">
      <h2>🔥 Trending Now</h2>
      <span class="trending-live-indicator">
        <span class="live-dot"></span>
        Live
      </span>
    </div>
    <p class="section-subtitle">What's getting attention this week</p>
  </div>
  <div class="trending-grid" id="trending-grid">
    <!-- Populated by JS -->
  </div>
</section>
```

#### CSS for Trending
```css
.trending-section {
  margin: var(--space-xl) 0;
}

.trending-header {
  margin-bottom: var(--space-md);
}

.trending-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.trending-live-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(255, 107, 107, 0.1);
  color: var(--danger-color, #ff6b6b);
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: var(--danger-color, #ff6b6b);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.trending-card {
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform 0.2s ease;
}

.trending-card:hover {
  transform: translateY(-4px);
}

.trending-rank {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-primary);
  color: var(--text-inverse);
  font-weight: 700;
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  z-index: 2;
}

.trending-rank.top-3 {
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  color: #000;
}
```

---

## Gap C7: Enhanced Search - Tag-Based & Semantic

### Problem
Search is title-only. No tag-based or semantic search.

### Solution
Enhance search to include genres, themes, and descriptions with scoring.

### Technical Specifications

#### Enhance search in app.js
```javascript
// Extend App object with enhanced search
const App = {
  // ... existing code ...

  /**
   * Build comprehensive search index including tags
   */
  buildEnhancedSearchIndex(anime) {
    const baseIndex = this.buildSearchIndex(
      anime.title, 
      anime.titleEnglish, 
      anime.titleJapanese
    );

    // Add genre and theme tokens
    const tagTokens = [];
    
    anime.genres?.forEach(genre => {
      const normalized = this.normalizeSearchQuery(genre);
      if (normalized) {
        tagTokens.push(normalized);
        tagTokens.push(...normalized.split(' '));
      }
    });
    
    anime.themes?.forEach(theme => {
      const normalized = this.normalizeSearchQuery(theme);
      if (normalized) {
        tagTokens.push(normalized);
        tagTokens.push(...normalized.split(' '));
      }
    });

    // Add studio
    if (anime.studio) {
      const studioNormalized = this.normalizeSearchQuery(
        Array.isArray(anime.studio) ? anime.studio.join(' ') : anime.studio
      );
      if (studioNormalized) {
        tagTokens.push(studioNormalized);
      }
    }

    // Add synopsis tokens (first 50 words)
    if (anime.synopsis) {
      const synopsisWords = anime.synopsis
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 50);
      tagTokens.push(...synopsisWords);
    }

    return {
      ...baseIndex,
      tagTokens: [...new Set(tagTokens)],
      genres: anime.genres || [],
      themes: anime.themes || []
    };
  },

  /**
   * Enhanced search with tag matching
   */
  findEnhancedSearchMatches(query, options = {}) {
    const {
      includeTags = true,
      includeSynopsis = false,
      minScore = 10
    } = options;

    const queryInfo = this.prepareSearchQuery(query);
    const results = [];

    // Parse query for tag hints (genre:, theme:, studio:)
    const tagHints = this.parseTagHints(query);
    const cleanQuery = tagHints.cleanQuery;
    const cleanQueryInfo = this.prepareSearchQuery(cleanQuery);

    for (const anime of this.animeData) {
      let totalScore = 0;
      const matchReasons = [];

      // Title matching (highest weight)
      const index = this.getSearchIndex(anime);
      const titleScore = this.scoreSearchMatch(index, cleanQueryInfo);
      if (titleScore > 0) {
        totalScore += titleScore * 2;
        matchReasons.push('title');
      }

      // Tag matching
      if (includeTags) {
        const tagScore = this.scoreTagMatch(anime, cleanQueryInfo);
        if (tagScore > 0) {
          totalScore += tagScore;
          matchReasons.push('tag');
        }
      }

      // Tag hint matching (exact genre/theme filters)
      if (tagHints.genres.length > 0) {
        const hasAllGenres = tagHints.genres.every(g => 
          anime.genres?.some(ag => ag.toLowerCase() === g)
        );
        if (hasAllGenres) {
          totalScore += 50;
          matchReasons.push('genre-filter');
        }
      }

      if (tagHints.themes.length > 0) {
        const hasAllThemes = tagHints.themes.every(t => 
          anime.themes?.some(at => at.toLowerCase() === t)
        );
        if (hasAllThemes) {
          totalScore += 50;
          matchReasons.push('theme-filter');
        }
      }

      // Synopsis matching (if enabled)
      if (includeSynopsis && anime.synopsis) {
        const synopsisScore = this.scoreSynopsisMatch(anime.synopsis, cleanQueryInfo);
        if (synopsisScore > 0) {
          totalScore += synopsisScore * 0.5;
          matchReasons.push('synopsis');
        }
      }

      if (totalScore >= minScore) {
        results.push({ 
          anime, 
          score: totalScore,
          reasons: matchReasons
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.searchMaxResults);
  },

  /**
   * Parse tag hints from query (genre:action theme:mecha)
   */
  parseTagHints(query) {
    const hints = {
      genres: [],
      themes: [],
      studios: [],
      cleanQuery: query
    };

    const hintPattern = /\b(genre|theme|studio):([^\s]+)/gi;
    let match;
    
    while ((match = hintPattern.exec(query)) !== null) {
      const type = match[1].toLowerCase();
      const value = match[2].toLowerCase().replace(/,/g, ' ');
      
      if (type === 'genre') {
        hints.genres.push(value);
      } else if (type === 'theme') {
        hints.themes.push(value);
      } else if (type === 'studio') {
        hints.studios.push(value);
      }
      
      // Remove hint from clean query
      hints.cleanQuery = hints.cleanQuery.replace(match[0], '');
    }

    hints.cleanQuery = hints.cleanQuery.trim();
    return hints;
  },

  /**
   * Score tag match
   */
  scoreTagMatch(anime, queryInfo) {
    const { tokens, normalized, loose } = queryInfo;
    let score = 0;

    const allTags = [
      ...(anime.genres || []),
      ...(anime.themes || [])
    ].map(t => t.toLowerCase());

    // Exact tag match
    if (allTags.includes(normalized) || allTags.includes(loose)) {
      score += 80;
    }

    // Token matches
    tokens.forEach(token => {
      const matchingTags = allTags.filter(tag => tag.includes(token));
      score += matchingTags.length * 15;
    });

    // Partial matches
    allTags.forEach(tag => {
      if (tag.includes(normalized) || normalized.includes(tag)) {
        score += 30;
      }
    });

    return score;
  },

  /**
   * Score synopsis match
   */
  scoreSynopsisMatch(synopsis, queryInfo) {
    const { tokens, normalized } = queryInfo;
    if (!synopsis || tokens.length === 0) return 0;

    const synopsisLower = synopsis.toLowerCase();
    let score = 0;

    // Check for exact phrase
    if (synopsisLower.includes(normalized)) {
      score += 40;
    }

    // Count token occurrences
    tokens.forEach(token => {
      const regex = new RegExp(token, 'g');
      const matches = synopsisLower.match(regex);
      if (matches) {
        score += matches.length * 10;
      }
    });

    return Math.min(score, 100);
  },

  /**
   * Render enhanced search result with match reasons
   */
  renderEnhancedSearchResult(result) {
    const { anime, score, reasons } = result;
    const reasonBadges = {
      'title': { label: 'Title Match', class: 'badge-title' },
      'tag': { label: 'Tag Match', class: 'badge-tag' },
      'genre-filter': { label: 'Genre', class: 'badge-genre' },
      'theme-filter': { label: 'Theme', class: 'badge-theme' },
      'synopsis': { label: 'Synopsis', class: 'badge-synopsis' }
    };

    // ... render with badges showing why it matched
  }
};
```

#### Search Suggestions Enhancement
```javascript
/**
 * Get search suggestions as user types
 */
getSearchSuggestions(query) {
  const suggestions = [];
  
  // Genre suggestions
  const matchingGenres = this.filterOptions.genres
    ?.filter(g => g.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3)
    .map(g => ({ type: 'genre', value: g, label: `Genre: ${g}` }));
  
  // Theme suggestions  
  const matchingThemes = this.filterOptions.themes
    ?.filter(t => t.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 3)
    .map(t => ({ type: 'theme', value: t, label: `Theme: ${t}` }));
  
  // Studio suggestions
  const matchingStudios = this.filterOptions.studio
    ?.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 2)
    .map(s => ({ type: 'studio', value: s, label: `Studio: ${s}` }));

  suggestions.push(...matchingGenres, ...matchingThemes, ...matchingStudios);
  
  return suggestions;
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (High Impact, Low Effort)
1. **C3 - Seasonal Discovery** - Add "This Season" chip using existing data
2. **C1 - Surprise Me** - Simple random selection with quality filter
3. **C4 - Recommendation Modes** - UI switcher with existing scoring variations

### Phase 2: Core Features (High Impact, Medium Effort)
4. **C5 - Because You Watched** - Leverage existing similar anime logic
5. **C7 - Enhanced Search** - Extend existing search with tags
6. **C6 - Trending** - Simulated trending based on available data

### Phase 3: Advanced Features (High Impact, High Effort)
7. **C2 - Watchlist Integration** - New data model and UI components

---

## New Files to Create

1. **`js/discovery.js`** - Surprise me, seasonal discovery, trending
2. **`js/watchlist.js`** - Watchlist management and progress tracking
3. **Update `js/recommendations.js`** - Add modes and personalization
4. **Update `js/app.js`** - Enhanced search integration
5. **Update `index.html`** - New UI sections and components
6. **Update `css/styles.css`** - New component styles

---

## Data Schema Changes

### LocalStorage Keys
- `rekonime.watchlist` - Array of watchlist entries (NEW)
- `rekonime.surpriseHistory` - Surprise me usage history (NEW)
- `rekonime.recMode` - Last used recommendation mode (NEW)

### Backward Compatibility
- Existing `rekonime.bookmarks` will continue to work
- Migration path: bookmarks → watchlist with status 'planning'

---

## Success Metrics

After implementation, measure:
- **Surprise Me usage** - % of sessions using the feature
- **Watchlist adoption** - # of users with progress tracking
- **Mode switching** - Variety of recommendation modes used
- **Search success** - Reduced "no results" searches
- **Time to discovery** - Faster navigation to anime details

---

## Notes for Implementation

1. **Performance**: All new features should work with existing data loading patterns
2. **Accessibility**: Ensure new UI components follow ARIA guidelines
3. **Mobile**: All new features must be responsive
4. **Analytics**: Add gtag events for new discovery features
5. **Testing**: Unit tests for recommendation algorithms
