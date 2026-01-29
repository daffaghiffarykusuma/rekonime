# Internationalization (i18n) Gaps Remediation Plan

## Executive Summary

This document outlines remediation strategies for identified Internationalization (i18n) gaps in the Rekonime application. The codebase currently has all UI text hardcoded in English, uses inconsistent date/number formatting, and lacks a proper localization framework. This plan provides a phased approach to implementing comprehensive i18n support.

---

## 12.1 Hardcoded Strings

### Current State Analysis

| Category | File | Lines | Gap Description |
|----------|------|-------|-----------------|
| **Error Messages** | `js/app.js` | 1014, 4063 | Hardcoded English error messages |
| **Error Messages** | `js/reviews.js` | 613-614 | API error messages in English |
| **Onboarding Content** | `js/onboarding.js` | 104-260 | All tour content hardcoded |
| **Metric Definitions** | `js/metricGlossary.js` | 11-125 | All metric titles/descriptions hardcoded |
| **Keyboard Shortcuts** | `js/keyboardShortcuts.js` | 11-65 | Shortcut descriptions hardcoded |
| **Filter Presets** | `js/filterPresets.js` | 12-76 | Preset labels/descriptions hardcoded |
| **Recommendations** | `js/recommendations.js` | 136-582 | Badge labels, reasons, contexts hardcoded |
| **Theme Labels** | `js/themeManager.js` | 150-154 | Theme option labels hardcoded |
| **Chart Labels** | `js/charts.js` | 38-151 | Chart axis labels and descriptions hardcoded |
| **UI Labels** | `index.html` | 55-321 | Placeholder text, labels, SEO content |
| **Stats Labels** | `js/stats.js` | 246-849 | Consistency labels, churn risk labels |

### Gap 12.1.1: No Localization Framework

**Severity:** High  
**Impact:** Cannot support non-English users; all text is hardcoded English

#### Current Implementation

```javascript
// js/app.js:1014 - Hardcoded error message
this.showError('We couldn\'t load the catalog. Try refreshing - if it persists, the data might be updating.');

// js/reviews.js:613-614 - Hardcoded API error
const errorMessage = isRateLimit
  ? 'Rate limited by MyAnimeList. Please wait a moment and try again.'
  : 'Failed to load reviews from MyAnimeList.';
```

#### Remediation Strategy

**Phase 1: Create i18n Infrastructure (Immediate)**

Create a lightweight i18n module with translation key lookup:

```javascript
// js/i18n.js - Internationalization module
const I18n = {
  // Default locale
  currentLocale: 'en',
  
  // Translation storage
  translations: {},
  
  // Initialize with locale detection
  init() {
    // Detect browser locale or use stored preference
    const stored = localStorage.getItem('rekonime.locale');
    const browserLocale = navigator.language?.split('-')[0];
    this.currentLocale = stored || browserLocale || 'en';
    
    // Load translations
    return this.loadTranslations(this.currentLocale);
  },
  
  // Load translation file
  async loadTranslations(locale) {
    try {
      const response = await fetch(`locales/${locale}.json`);
      if (response.ok) {
        this.translations[locale] = await response.json();
        return true;
      }
    } catch (e) {
      console.warn(`Failed to load translations for ${locale}`);
    }
    // Fallback to English
    if (locale !== 'en') {
      return this.loadTranslations('en');
    }
    return false;
  },
  
  // Translate a key
  t(key, params = {}) {
    const translations = this.translations[this.currentLocale] || {};
    let text = this.getNestedValue(translations, key) || key;
    
    // Replace parameters
    Object.keys(params).forEach(param => {
      text = text.replace(`{{${param}}}`, params[param]);
    });
    
    return text;
  },
  
  // Get nested object value
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  },
  
  // Change locale
  setLocale(locale) {
    this.currentLocale = locale;
    localStorage.setItem('rekonime.locale', locale);
    return this.loadTranslations(locale);
  },
  
  // Get available locales
  getAvailableLocales() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' }
    ];
  }
};

// Expose globally
window.I18n = I18n;
window.t = (key, params) => I18n.t(key, params);
```

**Phase 2: Extract English Translations (Short-term)**

Create the base English translation file:

```json
// locales/en.json
{
  "meta": {
    "siteName": "Rekonime",
    "tagline": "Find Anime You'll Actually Finish",
    "description": "Discover anime worth your time. Rekonime uses Retention and Satisfaction scores to find shows that stay engaging from start to finish."
  },
  "errors": {
    "catalogLoadFailed": "We couldn't load the catalog. Try refreshing - if it persists, the data might be updating.",
    "animeNotFound": "Anime Not Found",
    "animeNotFoundDesc": "We couldn't find the anime you're looking for.",
    "reviews": {
      "rateLimited": "Rate limited by MyAnimeList. Please wait a moment and try again.",
      "loadFailed": "Failed to load reviews from MyAnimeList.",
      "retryFailed": "Retry failed"
    }
  },
  "search": {
    "placeholder": "Search anime...",
    "noResults": "No matches yet.",
    "noResultsHint": "Try English title or a shorter query.",
    "tipEnglish": "Try English title",
    "tipShorter": "Shorter query"
  },
  "filters": {
    "title": "Find your next watch",
    "subtitle": "Mix and match to narrow down what you're in the mood for.",
    "clearAll": "Clear All",
    "apply": "Apply Filters",
    "active": "Active filters",
    "activeCount": "Active filters ({{count}})",
    "genres": "Genre",
    "themes": "Theme",
    "demographic": "Demographic",
    "season": "Season",
    "year": "Year",
    "studio": "Studios",
    "source": "Source",
    "showMore": "Show {{count}} more",
    "showLess": "Show less"
  },
  "sort": {
    "label": "Sort",
    "retention": "Sort by: Retention Score",
    "satisfaction": "Sort by: Satisfaction Score (MAL)"
  },
  "bookmarks": {
    "add": "Add bookmark",
    "remove": "Remove bookmark",
    "view": "View bookmarks",
    "empty": "No bookmarks yet"
  },
  "settings": {
    "title": "Settings",
    "subtitle": "Adjust playback and data usage.",
    "playback": {
      "title": "Playback",
      "trailerAutoplay": "Trailer autoplay",
      "trailerAutoplayDesc": "Auto-starts trailers as you scroll. Default on desktop, off on mobile. When off, you can still press play.",
      "dataSaver": "Data saver",
      "dataSaverDesc": "Disables embedded trailers to save bandwidth. You will miss inline video previews and need to open YouTube."
    },
    "accessibility": {
      "title": "Accessibility",
      "reducedMotion": "Reduced motion",
      "reducedMotionDesc": "Disables animations, particle effects, and transitions for a calmer experience.",
      "highContrast": "High contrast",
      "highContrastDesc": "Increases contrast for better visibility. Uses stronger borders and removes shadows.",
      "largeText": "Large text",
      "largeTextDesc": "Increases base font size for better readability."
    },
    "keyboardShortcuts": "Keyboard shortcuts",
    "keyboardShortcutsDesc": "Press {{key}} anytime to see all keyboard shortcuts"
  },
  "recommendations": {
    "title": "Recommended for you",
    "context": "Top picks with high Retention Scores (you'll finish them) and solid MAL Satisfaction (they're actually good).",
    "howWePick": "How we pick these",
    "modes": {
      "balanced": { "label": "Balanced", "description": "Best of both worlds", "context": "Retention-first picks blended with MAL satisfaction for more dependable recommendations." },
      "binge": { "label": "Binge Mode", "description": "High retention, hard to stop watching", "context": "Shows that are hard to stop watching - high flow state and strong hooks." },
      "quality": { "label": "Critical Acclaim", "description": "Highest community ratings", "context": "Top-rated by the community - focus on critical acclaim and satisfaction." },
      "discovery": { "label": "Hidden Gems", "description": "High retention, lower popularity", "context": "Hidden gems with high retention but lower mainstream popularity." },
      "comfort": { "label": "Comfort Shows", "description": "Easy to watch, low stress", "context": "Easy, stress-free shows perfect for relaxing and unwinding." }
    },
    "badges": {
      "keepsYouHooked": "Keeps You Hooked",
      "fanFavorite": "Fan Favorite",
      "greatFirstImpression": "Great First Impression",
      "underratedPick": "Underrated Pick"
    },
    "reasons": {
      "lovedByCommunity": "Loved by the community",
      "newEntry": "New entry, check back soon",
      "hardToPutDown": "Hard to put down",
      "viewersStickAround": "Viewers stick around",
      "hooksYouEarly": "Hooks you early",
      "worthTheFinale": "Worth the finale",
      "smoothPacing": "Smooth pacing",
      "communityFavorite": "Community favorite",
      "reliablePick": "Reliable pick"
    }
  },
  "trending": {
    "title": "Trending Now",
    "live": "Live",
    "subtitle": "What's getting attention this week"
  },
  "catalog": {
    "title": "Browse the catalog",
    "subtitle": "Explore all titles, sorted by what matters to you.",
    "loadMore": "Load More ({{count}} remaining)",
    "noResults": {
      "title": "No matches yet",
      "description": "Try removing a filter or two—there might be a hidden gem waiting."
    }
  },
  "detail": {
    "retentionScore": "Retention Score",
    "retentionScoreTooltip": "How consistently people keep watching across episodes. Factors in strong starts, low drop-off, and steady pacing.",
    "satisfactionScore": "Satisfaction (MAL)",
    "satisfactionScoreTooltip": "Community rating from MyAnimeList.",
    "episodes": "Episodes",
    "whyItSticks": "Why it sticks",
    "startStayFinish": "Start, stay, finish",
    "strongStart": "Strong start",
    "strongStartTooltip": "How compelling the first 3 episodes are. High scores mean the show hooks viewers early.",
    "keepsYouWatching": "Keeps you watching",
    "keepsYouWatchingTooltip": "Low drop-off probability. Measures how likely viewers are to continue without losing interest.",
    "finishPayoff": "Finish payoff",
    "finishPayoffTooltip": "How well the show sticks the landing. Combines finale strength, momentum, and narrative build-up.",
    "synopsis": "Synopsis",
    "trailer": "Trailer",
    "watchOnYoutube": "Watch on YouTube",
    "dataSaverNotice": "Data Saver is on, so the embedded trailer is hidden.",
    "similarAnime": "Similar Anime",
    "similarAnimeNote": "Shared genre + theme, aligned retention and satisfaction",
    "noSimilarFound": "No similar anime found yet.",
    "similarNeedsTags": "Similar anime needs both genre and theme tags for this title.",
    "communityReviews": "Community Reviews",
    "reviewsFrom": "Reviews from",
    "noReviews": "No community reviews yet—be the first on MyAnimeList!",
    "positive": "Positive",
    "neutral": "Neutral",
    "negative": "Negative"
  },
  "metrics": {
    "categories": {
      "watchExperience": { "title": "Watch Experience", "description": "For casual viewers" },
      "completionOutlook": { "title": "Completion Outlook", "description": "For completionists" },
      "qualityAnalysis": { "title": "Quality Analysis", "description": "For enthusiasts" },
      "riskFactors": { "title": "Risk Factors", "description": "Honest assessment" }
    },
    "retentionScore": {
      "title": "Retention Score (0-100)",
      "shortDesc": "How consistently viewers watch through the entire series",
      "fullDesc": "Measures how likely you are to finish the entire series without dropping off. Based on episode-by-episode analysis of viewer behavior.",
      "scale": {
        "exceptional": { "label": "Exceptional", "desc": "Rare drop-offs, highly engaging" },
        "great": { "label": "Great", "desc": "Most viewers finish" },
        "good": { "label": "Good", "desc": "Minor weak points" },
        "mixed": { "label": "Mixed", "desc": "Notable quality swings" },
        "poor": { "label": "Poor", "desc": "High drop-off risk" }
      }
    },
    "satisfactionScore": {
      "title": "Satisfaction Score (MAL)",
      "shortDesc": "Community rating from MyAnimeList",
      "fullDesc": "Overall quality rating from the MyAnimeList community. Represents how much viewers enjoyed the anime overall.",
      "scale": {
        "masterpiece": { "label": "Masterpiece", "desc": "Universally acclaimed" },
        "excellent": { "label": "Excellent", "desc": "Highly recommended" },
        "good": { "label": "Good", "desc": "Worth watching" },
        "decent": { "label": "Decent", "desc": "Has merit" },
        "mixed": { "label": "Mixed", "desc": "Divisive or flawed" }
      }
    }
  },
  "onboarding": {
    "welcome": {
      "title": "Welcome to Rekonime",
      "description": "Find anime you'll actually finish. We analyze watch-through patterns to recommend shows that stay engaging from start to finish.",
      "retention": "Retention Scores predict completion",
      "satisfaction": "Satisfaction from MAL community",
      "filtering": "Smart filtering by mood & genre",
      "takeTour": "Take a quick tour",
      "startExploring": "Start exploring"
    },
    "retention": {
      "title": "Understanding Retention Score",
      "description": "Our signature metric: a 0-100 scale measuring how consistently viewers watch through an entire series without dropping off.",
      "highRetention": "High retention",
      "highRetentionDesc": "Most viewers finish the whole series",
      "lowRetention": "Low retention",
      "lowRetentionDesc": "Many viewers drop off early",
      "next": "Next: Satisfaction Score"
    },
    "satisfaction": {
      "title": "Understanding Satisfaction",
      "description": "Community ratings from MyAnimeList (MAL), the world's largest anime database. This represents overall quality and enjoyment.",
      "twoScoresTitle": "Why two scores matter:",
      "retentionLabel": "Retention",
      "retentionDesc": "Consistency — will you finish?",
      "satisfactionLabel": "Satisfaction",
      "satisfactionDesc": "Quality — is it actually good?",
      "next": "Next: Finding Anime"
    },
    "discovery": {
      "title": "Finding Your Next Watch",
      "description": "Discover anime that matches your mood with powerful filtering and smart recommendations.",
      "smartSearch": "Smart Search",
      "smartSearchDesc": "Find by English, Japanese, or romaji titles",
      "filters": "Genre & Theme Filters",
      "filtersDesc": "Mix and match to find your vibe",
      "bookmarks": "Bookmarks",
      "bookmarksDesc": "Save interesting titles for later",
      "start": "Start exploring",
      "restart": "Restart tour"
    }
  },
  "keyboardShortcuts": {
    "title": "Keyboard Shortcuts",
    "global": "Global Shortcuts",
    "detailModal": "When Viewing Anime Details",
    "tip": "Tip: These shortcuts work anywhere on the site, except when typing in search or filter fields.",
    "shortcuts": {
      "showHelp": "Show keyboard shortcuts",
      "focusSearch": "Focus search box",
      "closeModal": "Close modal or dropdown",
      "goToBookmarks": "Go to bookmarks page",
      "openFilters": "Open filter panel",
      "toggleSettings": "Open settings",
      "surpriseMe": "Surprise me (random anime)",
      "goHome": "Go to home / clear filters",
      "previousAnime": "Previous anime",
      "nextAnime": "Next anime"
    }
  },
  "offline": {
    "indicator": "You're offline. Some features may be limited.",
    "features": {
      "browse": "Browse",
      "search": "Search",
      "details": "Details",
      "reviews": "Reviews"
    }
  },
  "update": {
    "available": "Update available! Refresh to get the latest version.",
    "updateNow": "Update Now"
  },
  "discoveryGarden": {
    "title": "Discover Your Next Journey",
    "subtitle": "Like cherry blossoms, great anime moments are fleeting but unforgettable. Let us help you find your next favorite story.",
    "twoNumbers": {
      "title": "Two Numbers Matter",
      "description": "Retention = consistency. Satisfaction = quality.",
      "cta": "Learn more"
    },
    "filterByMood": {
      "title": "Filter by Mood",
      "description": "Use Genre and Theme chips to find your vibe.",
      "cta": "Try filters"
    }
  },
  "rankings": {
    "topRetention": "Top Retention",
    "highestSatisfaction": "Highest Satisfaction (MAL)"
  },
  "filterPresets": {
    "bingeWorthy": { "label": "Binge-Worthy", "description": "High flow state, low stress spikes" },
    "criticalDarlings": { "label": "Critical Darlings", "description": "Top satisfaction scores from MAL" },
    "hiddenGems": { "label": "Hidden Gems", "description": "High retention, lower MAL scores" },
    "easyWatches": { "label": "Easy Watches", "description": "Low barrier to entry, comfortable" },
    "strongStarters": { "label": "Strong Starters", "description": "Hook you in the first 3 episodes" },
    "greatEndings": { "label": "Great Endings", "description": "Stick the landing" }
  },
  "stats": {
    "consistency": {
      "veryConsistent": "Very Consistent",
      "consistent": "Consistent",
      "variable": "Variable"
    },
    "churnRisk": {
      "low": "Low Risk",
      "moderate": "Moderate Risk",
      "high": "High Risk",
      "critical": "Critical Drop-off Risk"
    },
    "slumpFactor": "Slump (2+ consecutive weak episodes)",
    "poorRecent": "Poor recent episodes (last 2 below baseline)",
    "belowPeak": "Overall quality below peak baseline"
  },
  "themes": {
    "dark": "Dark",
    "light": "Light",
    "auto": "Auto"
  },
  "seasons": {
    "winter": "Winter",
    "spring": "Spring",
    "summer": "Summer",
    "fall": "Fall"
  },
  "common": {
    "close": "Close",
    "clear": "Clear",
    "apply": "Apply",
    "loading": "Loading...",
    "unknown": "Unknown",
    "none": "None",
    "help": "Help",
    "surpriseMe": "Surprise Me",
    "filters": "Filters"
  }
}
```

**Phase 3: Replace Hardcoded Strings (Medium-term)**

Systematically replace hardcoded strings with translation keys:

```javascript
// Before (js/app.js:1014)
this.showError('We couldn\'t load the catalog. Try refreshing - if it persists, the data might be updating.');

// After
this.showError(I18n.t('errors.catalogLoadFailed'));

// Before (js/reviews.js:613-614)
const errorMessage = isRateLimit
  ? 'Rate limited by MyAnimeList. Please wait a moment and try again.'
  : 'Failed to load reviews from MyAnimeList.';

// After
const errorMessage = isRateLimit
  ? I18n.t('errors.reviews.rateLimited')
  : I18n.t('errors.reviews.loadFailed');
```

**Phase 4: HTML Template Updates (Medium-term)**

Update HTML to use data attributes for translation keys:

```html
<!-- Before -->
<input type="text" id="header-search" placeholder="Search anime..." aria-label="Search anime">

<!-- After -->
<input type="text" id="header-search" 
       data-i18n-placeholder="search.placeholder" 
       data-i18n-aria-label="search.placeholder"
       aria-label="Search anime">
```

Create a DOM translation processor:

```javascript
// Add to i18n.js
I18n.translateDom = function() {
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
};
```

---

### Gap 12.1.2: No Language Selector

**Severity:** Medium  
**Impact:** Users cannot switch languages; locale detection may not match user preference

#### Remediation Strategy

**Phase 1: Add Language Selector to Settings**

```javascript
// js/themeManager.js - Add locale selector
renderLocaleSelector() {
  const locales = I18n.getAvailableLocales();
  const currentLocale = I18n.currentLocale;
  
  return `
    <div class="settings-locale">
      <div class="filter-section-title" style="margin-top: 1.5rem;">Language</div>
      <div class="locale-selector">
        ${locales.map(locale => `
          <button class="locale-option ${locale.code === currentLocale ? 'is-active' : ''}"
                  data-action="set-locale"
                  data-locale="${locale.code}"
                  aria-pressed="${locale.code === currentLocale ? 'true' : 'false'}">
            <span class="locale-native">${locale.nativeName}</span>
            <span class="locale-name">${locale.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}
```

**Phase 2: Add CSS for Language Selector**

```css
/* css/styles.css */
.locale-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.locale-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.locale-option:hover {
  background: var(--bg-tertiary);
}

.locale-option.is-active {
  border-color: var(--accent-primary);
  background: var(--accent-primary-alpha);
}

.locale-native {
  font-weight: 600;
  color: var(--text-primary);
}

.locale-name {
  font-size: 0.875rem;
  color: var(--text-secondary);
}
```

---

## 12.2 Date/Number Formatting

### Gap 12.2.1: Non-Localized Date Formatting

**Severity:** Medium  
**Impact:** Dates display in inconsistent formats; no timezone awareness

#### Current Implementation

```javascript
// js/reviews.js:442-444
const dateValue = review.date ? new Date(review.date) : null;
const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
  ? dateValue.toLocaleDateString()
  : '';
```

#### Issues Identified

1. `toLocaleDateString()` uses browser default, not app locale
2. No timezone handling for international users
3. No consistent date format across the app
4. Season names hardcoded in English

#### Remediation Strategy

**Phase 1: Create Date/Time Localization Module**

```javascript
// js/i18n.js - Add date formatting
I18n.dateTime = {
  // Format date according to current locale
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
  
  // Format relative time (e.g., "2 days ago")
  formatRelative(date) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return I18n.t('dates.today');
    if (diffDays === 1) return I18n.t('dates.yesterday');
    if (diffDays < 7) return I18n.t('daysAgo', { count: diffDays });
    if (diffDays < 30) return I18n.t('weeksAgo', { count: Math.floor(diffDays / 7) });
    
    return this.formatDate(date);
  },
  
  // Get localized season name
  getSeasonName(season) {
    const seasonKey = season.toLowerCase();
    return I18n.t(`seasons.${seasonKey}`);
  }
};
```

**Phase 2: Update Date Displays**

```javascript
// Before (js/reviews.js:442-444)
const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
  ? dateValue.toLocaleDateString()
  : '';

// After
const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
  ? I18n.dateTime.formatDate(dateValue)
  : '';

// Update seasonal filters (js/discovery.js)
const seasonName = I18n.dateTime.getSeasonName(season);
```

---

### Gap 12.2.2: Non-Localized Number Formatting

**Severity:** Low  
**Impact:** Numbers use dot decimal regardless of locale

#### Current Implementation

```javascript
// js/app.js:3051 - Score formatting
const malSatisfaction = Number.isFinite(anime.communityScore) 
  ? `${anime.communityScore.toFixed(1)}/10` 
  : 'N/A';

// js/recommendations.js:231 - Score display
value: malSatisfactionScore !== null ? malSatisfactionScore.toFixed(1) : 'N/A',
```

#### Remediation Strategy

**Phase 1: Add Number Formatting Utilities**

```javascript
// js/i18n.js - Add number formatting
I18n.number = {
  // Format decimal number
  format(value, decimals = 1) {
    if (!Number.isFinite(value)) return I18n.t('common.unknown');
    
    return value.toLocaleString(I18n.currentLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },
  
  // Format percentage
  formatPercent(value) {
    if (!Number.isFinite(value)) return I18n.t('common.unknown');
    
    return value.toLocaleString(I18n.currentLocale, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  },
  
  // Format integer
  formatInt(value) {
    if (!Number.isFinite(value)) return I18n.t('common.unknown');
    
    return value.toLocaleString(I18n.currentLocale, {
      maximumFractionDigits: 0
    });
  }
};
```

**Phase 2: Update Number Displays**

```javascript
// Before
const malSatisfaction = Number.isFinite(anime.communityScore) 
  ? `${anime.communityScore.toFixed(1)}/10` 
  : 'N/A';

// After
const malSatisfaction = Number.isFinite(anime.communityScore) 
  ? `${I18n.number.format(anime.communityScore, 1)}/10` 
  : I18n.t('common.unknown');
```

---

### Gap 12.2.3: Season Names Not Localized

**Severity:** Low  
**Impact:** Season names (Winter, Spring, Summer, Fall) always in English

#### Current Implementation

```javascript
// js/discovery.js:159-163
let season;
if (month <= 2) season = 'Winter';
else if (month <= 5) season = 'Spring';
else if (month <= 8) season = 'Summer';
else season = 'Fall';
```

#### Remediation Strategy

Update the season generation to use translation keys:

```javascript
// js/discovery.js - Updated seasonal filters
getSeasonalFilters(animeList) {
  const current = this.getCurrentSeason();
  const seasons = ['winter', 'spring', 'summer', 'fall'];
  
  // Generate filters with localized labels
  return [
    { 
      label: I18n.t('seasonal.thisSeason'), 
      value: `${current.season} ${current.year}`,
      highlight: true 
    },
    // ... etc
  ];
}
```

---

## Implementation Priority Matrix

| Gap | Severity | Effort | Priority | Phase |
|-----|----------|--------|----------|-------|
| 12.1.1 No i18n Framework | High | High | P0 | Immediate |
| 12.1.2 No Language Selector | Medium | Low | P2 | Short-term |
| 12.2.1 Date Formatting | Medium | Medium | P1 | Short-term |
| 12.2.2 Number Formatting | Low | Low | P3 | Medium-term |
| 12.2.3 Season Localization | Low | Low | P3 | Medium-term |

---

## File Changes Required

### New Files
- `js/i18n.js` - Core internationalization module
- `locales/en.json` - English translations
- `locales/ja.json` - Japanese translations
- `locales/id.json` - Indonesian translations

### Modified Files
| File | Changes |
|------|---------|
| `js/app.js` | Replace all hardcoded strings with `I18n.t()` calls |
| `js/reviews.js` | Replace error messages, use localized dates |
| `js/onboarding.js` | Replace all tour content with translation keys |
| `js/metricGlossary.js` | Replace metric definitions with translation keys |
| `js/keyboardShortcuts.js` | Replace shortcut descriptions |
| `js/filterPresets.js` | Replace preset labels/descriptions |
| `js/recommendations.js` | Replace badge labels, reasons, contexts |
| `js/themeManager.js` | Add locale selector, localize theme labels |
| `js/discovery.js` | Localize season names |
| `js/stats.js` | Localize consistency and churn risk labels |
| `js/charts.js` | Localize chart labels |
| `index.html` | Add data-i18n attributes |
| `css/styles.css` | Add locale selector styles |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Hardcoded strings | 200+ | < 5 | Static analysis count |
| Supported locales | 1 | 3+ | Available in language selector |
| Date localization | 0% | 100% | Visual inspection per locale |
| Number localization | 0% | 100% | Decimal separator per locale |
| Translation coverage | N/A | 95%+ | Keys with translations / total keys |

---

## Testing Strategy

### Localization Testing Checklist
- [ ] Switch between all available languages
- [ ] Verify all UI elements update on language change
- [ ] Check date formats for each locale (e.g., ja = 2024年1月15日, en-US = Jan 15, 2024)
- [ ] Check number formats (e.g., de = 8,5, en = 8.5)
- [ ] Test RTL languages if added in future
- [ ] Verify text doesn't overflow containers with longer translations
- [ ] Test with missing translations (fallback to English)

### i18n Code Review Checklist
- [ ] No hardcoded strings in new code
- [ ] All user-facing text uses `I18n.t()`
- [ ] Translation keys follow naming convention (category.subcategory.key)
- [ ] Dates use `I18n.dateTime.format()`
- [ ] Numbers use `I18n.number.format()`

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Architect | Initial remediation plan |

---

*This document is a living specification. Update as implementation progresses.*
