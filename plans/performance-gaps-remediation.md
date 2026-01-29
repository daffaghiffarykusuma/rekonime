# Performance & Scalability Gaps Remediation Plan

## Executive Summary

This document outlines the plan to address performance and scalability gaps identified in the Gap Identification Report. The remediation focuses on four main areas: rendering bottlenecks, data loading strategy improvements, memory leak fixes, and missing performance optimizations.

---

## 1. Rendering Bottlenecks

### 1.1 Grid Re-rendering on Sort (Critical)

**Current State (Gap)**
- `renderAnimeGrid()` re-renders entire grid on sort change
- O(n) DOM operations for n items - causes jank with large datasets
- Lines 3187-3233 in js/app.js

**Current Implementation:**
```javascript
renderAnimeGrid({ append = false } = {}) {
  const container = document.getElementById('anime-grid');
  // ... validation ...
  
  const sorted = this.getSortedGridData();
  
  if (sorted.length === 0) {
    container.innerHTML = `...`;
    return;
  }
  
  // Always re-renders ALL cards even when just sorting
  container.innerHTML = this.renderAnimeCards(visibleAnime);
}
```

**Remediation Strategy: Document Fragment Diffing**

Use a lightweight diffing approach with document fragments to minimize DOM operations:

```javascript
// Add to App configuration
gridDomCache: new Map(), // Cache DOM elements by anime ID

/**
 * Smart render that reuses DOM elements when possible
 */
renderAnimeGrid({ append = false } = {}) {
  const container = document.getElementById('anime-grid');
  if (!container) return;
  container.classList.remove('is-loading');

  const sorted = this.getSortedGridData();

  if (sorted.length === 0) {
    container.innerHTML = `...`;
    this.gridDomCache.clear();
    return;
  }

  const shouldAppend = append && this.gridRenderedCount > 0;
  const startIndex = shouldAppend ? this.gridRenderedCount : 0;
  const endIndex = Math.min(sorted.length, this.gridCurrentPage * this.gridPageSize);
  const visibleAnime = sorted.slice(startIndex, endIndex);
  const hasMore = endIndex < sorted.length;

  if (!shouldAppend) {
    // Smart diff: reuse existing cards, only add/remove as needed
    this.diffRenderAnimeGrid(container, visibleAnime);
  } else if (visibleAnime.length > 0) {
    const loadMoreEl = container.querySelector('.load-more-container');
    if (loadMoreEl) loadMoreEl.remove();
    container.insertAdjacentHTML('beforeend', this.renderAnimeCards(visibleAnime));
  }

  this.gridRenderedCount = endIndex;

  if (hasMore) {
    container.insertAdjacentHTML('beforeend', `...load more...`);
  }
}

/**
 * Diff-based rendering for grid - minimizes DOM operations
 */
diffRenderAnimeGrid(container, newAnimeList) {
  const newIds = new Set(newAnimeList.map(a => a.id));
  const existingCards = Array.from(container.querySelectorAll('.anime-card'));
  const existingIds = new Map(existingCards.map(card => [card.dataset.animeId, card]));
  
  // Remove cards that are no longer in the list
  existingCards.forEach(card => {
    if (!newIds.has(card.dataset.animeId)) {
      card.remove();
    }
  });
  
  // Build fragment for new/updated cards
  const fragment = document.createDocumentFragment();
  let needsInsert = false;
  
  newAnimeList.forEach((anime, index) => {
    const existingCard = existingIds.get(anime.id);
    
    if (existingCard) {
      // Card exists - check if it needs reordering
      const currentIndex = Array.from(container.children).indexOf(existingCard);
      if (currentIndex !== index) {
        // Move to correct position
        const referenceNode = container.children[index] || null;
        container.insertBefore(existingCard, referenceNode);
      }
    } else {
      // New card - create and add to fragment
      const html = this.renderAnimeCards([anime]);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      fragment.appendChild(wrapper.firstElementChild);
      needsInsert = true;
    }
  });
  
  if (needsInsert) {
    container.appendChild(fragment);
  }
}
```

**Files to modify:**
- js/app.js: Lines 3187-3233

---

### 1.2 String Concatenation HTML Generation (High)

**Current State (Gap)**
- `renderAnimeCards()` uses string concatenation for HTML generation
- XSS risk (mitigated by escapeHtml) but still suboptimal
- Memory churn from repeated string operations
- Lines 2794-2871 in js/app.js

**Current Implementation:**
```javascript
renderAnimeCards(animeList) {
  return animeList.map((anime) => {
    // ... build variables ...
    return `
      <div class="anime-card" data-action="open-anime" data-anime-id="${safeId}">
        <div class="card-media">
          <img src="${safeCover}" ...>
        </div>
        // ... more string concatenation
      </div>
    `;
  }).join('');
}
```

**Remediation Strategy: Template Element Pooling**

Use HTML template elements and cloneNode for better performance:

```javascript
// Add template cache to App
animeCardTemplate: null,

/**
 * Initialize the card template once
 */
initCardTemplate() {
  if (this.animeCardTemplate) return;
  
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="anime-card" data-action="open-anime">
      <div class="card-media">
        <img class="card-cover" loading="lazy" data-fallback-src="https://via.placeholder.com/120x170?text=No+Image">
        <button class="bookmark-card-toggle" type="button" data-action="toggle-bookmark">&#9733;</button>
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <h3 class="card-title"></h3>
        </div>
        <div class="card-year"></div>
        <div class="card-badges"></div>
        <div class="card-stats"></div>
        <div class="retention-meter">
          <span class="retention-fill"></span>
        </div>
        <div class="card-reason"></div>
      </div>
    </div>
  `;
  this.animeCardTemplate = template;
},

/**
 * Render anime cards using DOM cloning for better performance
 */
renderAnimeCardsDom(animeList, { showBookmarkToggle = false } = {}) {
  this.initCardTemplate();
  
  const fragment = document.createDocumentFragment();
  
  animeList.forEach(anime => {
    const card = this.animeCardTemplate.content.cloneNode(true);
    const root = card.querySelector('.anime-card');
    
    // Set data attributes
    root.dataset.animeId = anime.id;
    
    // Populate media section
    const img = card.querySelector('.card-cover');
    img.src = anime.cover || '';
    img.alt = anime.title;
    
    // Handle bookmark toggle
    const bookmarkBtn = card.querySelector('.bookmark-card-toggle');
    if (showBookmarkToggle) {
      bookmarkBtn.dataset.animeId = anime.id;
      bookmarkBtn.classList.toggle('is-bookmarked', this.isBookmarked(anime.id));
      bookmarkBtn.setAttribute('aria-label', this.isBookmarked(anime.id) ? 'Remove bookmark' : 'Add bookmark');
    } else {
      bookmarkBtn.remove();
    }
    
    // Populate text content
    card.querySelector('.card-title').textContent = anime.title;
    card.querySelector('.card-year').textContent = `${anime.year || 'Unknown'} • ${anime.studio || 'Unknown'}`;
    
    // Render badges and stats
    const badges = Recommendations.getBadges(anime);
    const badgesContainer = card.querySelector('.card-badges');
    if (badges.length > 0) {
      badgesContainer.innerHTML = badges.map(b => 
        `<span class="card-badge ${b.class}">${this.escapeHtml(b.label)}</span>`
      ).join('');
    } else {
      badgesContainer.remove();
    }
    
    // Render stats
    const cardStats = Recommendations.getCardStats(anime);
    const statsContainer = card.querySelector('.card-stats');
    statsContainer.innerHTML = cardStats.map(stat => `
      <div class="stat ${stat.tooltip ? 'has-tooltip' : ''}" ${stat.tooltip ? 'tabindex="0"' : ''}>
        <span class="stat-value ${stat.class || ''}">${this.escapeHtml(stat.value)}${this.escapeHtml(stat.suffix || '')}</span>
        <span class="stat-label">${this.escapeHtml(stat.label)}</span>
        ${stat.tooltip ? `
          <div class="tooltip tooltip--bottom" role="tooltip">
            <div class="tooltip-title">${this.escapeHtml(stat.tooltip.title)}</div>
            <div class="tooltip-text">${this.escapeHtml(stat.tooltip.text)}</div>
          </div>
        ` : ''}
      </div>
    `).join('');
    
    // Retention meter
    const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
    const retentionLevel = hasEpisodes ? Math.round(anime.stats.retentionScore) : 0;
    const meter = card.querySelector('.retention-meter');
    const fill = card.querySelector('.retention-fill');
    fill.style.width = `${retentionLevel}%`;
    if (!hasEpisodes) meter.classList.add('is-muted');
    
    // Reason
    const reason = Recommendations.getRecommendationReason(anime);
    card.querySelector('.card-reason').textContent = reason;
    
    fragment.appendChild(card);
  });
  
  return fragment;
}
```

**Files to modify:**
- js/app.js: Add template-based rendering option

---

### 1.3 Modal Skeleton Optimization (Medium)

**Current State (Gap)**
- Modal skeleton always rendered even when data is cached
- Unnecessary paint work on repeat views

**Remediation Strategy: Cache-Based Skeleton Skip**

```javascript
showAnimeDetail(animeId, { updateUrl = true } = {}) {
  this.stopTrailerPlayback();
  this.teardownTrailerObserver();

  const modal = document.getElementById('detail-modal');
  const content = document.getElementById('detail-content');
  const modalContent = modal ? modal.querySelector('.modal-content') : null;

  if (!modal || !content) return;

  // Check if we have this anime's data already cached
  const anime = this.animeData.find(a => a.id === animeId);
  const isCached = anime && this.isDetailCached(animeId);
  
  // Only show skeleton for first-time loads or non-cached data
  if (!isCached) {
    content.innerHTML = this.renderDetailSkeleton();
  } else {
    // Show cached content immediately
    content.innerHTML = this.getCachedDetail(animeId);
  }
  
  this.setModalVisibility('detail-modal', true, { initialFocusSelector: '#close-detail' });

  if (!anime) {
    // ... error handling ...
    return;
  }

  // If not cached, render full content
  if (!isCached) {
    this.renderFullDetail(anime, content);
    this.cacheDetail(animeId, content.innerHTML);
  }
  
  // ... rest of the method ...
}

// Add cache management
detailCache: new Map(),
detailCacheMaxSize: 10,

isDetailCached(animeId) {
  return this.detailCache.has(animeId);
},

getCachedDetail(animeId) {
  const entry = this.detailCache.get(animeId);
  if (entry) {
    // Move to end (LRU)
    this.detailCache.delete(animeId);
    this.detailCache.set(animeId, entry);
  }
  return entry || '';
},

cacheDetail(animeId, html) {
  // Evict oldest if at capacity
  if (this.detailCache.size >= this.detailCacheMaxSize) {
    const firstKey = this.detailCache.keys().next().value;
    this.detailCache.delete(firstKey);
  }
  this.detailCache.set(animeId, html);
}
```

**Files to modify:**
- js/app.js: Lines 3546-3577

---

## 2. Data Loading Strategy

### 2.1 Parallel Data Fetching (Critical)

**Current State (Gap)**
```javascript
// js/app.js lines 1039-1057
async loadInitialData() {
  if (window.location.protocol === 'file:') {
    const loaded = await this.loadEmbeddedData();
    // ...
  }
  const previewPayload = await this.fetchCatalog(this.dataSources.preview);
  // No parallel fetching; sequential waterfall
}
```

Preview and full catalog loads are sequential. No HTTP/2 push or preload hints.

**Remediation Strategy: Parallel Fetching with Preload**

```javascript
/**
 * Load initial data with parallel fetching for optimal performance
 */
async loadInitialData() {
  // Preload hints for critical resources
  this.addPreloadHints();
  
  if (window.location.protocol === 'file:') {
    const loaded = await this.loadEmbeddedData();
    if (!loaded) return false;
    this.applyCatalogPayload({ anime: this.animeData }, { isFull: true, preserveFilters: false });
    return true;
  }

  // Fetch preview first (critical for first paint)
  const previewPayload = await this.fetchCatalog(this.dataSources.preview);
  if (previewPayload) {
    this.applyCatalogPayload(previewPayload, { isFull: false, preserveFilters: false });
    
    // Start loading full catalog in parallel (non-blocking)
    this.preloadFullCatalog();
    
    return true;
  }

  // Fallback to full catalog
  return this.loadFullCatalog();
}

/**
 * Add preload hints for critical resources
 */
addPreloadHints() {
  if (typeof document === 'undefined') return;
  
  const hints = [
    { rel: 'preload', href: this.dataSources.preview, as: 'fetch', crossorigin: 'anonymous' },
    { rel: 'dns-prefetch', href: 'https://api.jikan.moe' },
    { rel: 'preconnect', href: 'https://cdn.myanimelist.net' }
  ];
  
  hints.forEach(hint => {
    if (document.querySelector(`link[href="${hint.href}"]`)) return;
    const link = document.createElement('link');
    Object.entries(hint).forEach(([key, value]) => {
      link.setAttribute(key, value);
    });
    document.head.appendChild(link);
  });
}

/**
 * Preload full catalog in background without blocking
 */
preloadFullCatalog() {
  if (this.fullCatalogPreloadPromise) return;
  
  this.fullCatalogPreloadPromise = (async () => {
    // Use requestIdleCallback if available for non-critical loading
    if ('requestIdleCallback' in window) {
      await new Promise(resolve => window.requestIdleCallback(resolve, { timeout: 2000 }));
    }
    
    await this.loadFullCatalog();
  })();
}

/**
 * Enhanced loadFullCatalog with better caching
 */
async loadFullCatalog() {
  if (this.isFullDataLoaded) return true;
  if (this.fullCatalogPromise) return this.fullCatalogPromise;

  this.loadingFullCatalog = true;
  
  this.fullCatalogPromise = (async () => {
    // Try to fetch both full and legacy in parallel for resilience
    const [fullPayload, legacyPayload] = await Promise.all([
      this.fetchCatalog(this.dataSources.full),
      this.fetchCatalog(this.dataSources.legacy)
    ]);

    const payload = fullPayload || legacyPayload;
    
    if (!payload) {
      const loaded = await this.loadEmbeddedData();
      if (!loaded) return false;
      this.applyCatalogPayload({ anime: this.animeData }, { isFull: true, preserveFilters: true });
      return true;
    }

    this.applyCatalogPayload(payload, { isFull: true, preserveFilters: true });
    return true;
  })();

  const result = await this.fullCatalogPromise;
  this.isFullDataLoaded = Boolean(result);
  this.loadingFullCatalog = false;
  this.fullCatalogPromise = null;
  return result;
}
```

**Files to modify:**
- js/app.js: Lines 1039-1101

---

### 2.2 HTTP/2 Server Push / Resource Hints

**Update index.html to include resource hints:**

```html
<head>
  <!-- Existing preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Add new resource hints -->
  <link rel="preconnect" href="https://cdn.myanimelist.net" crossorigin>
  <link rel="dns-prefetch" href="https://api.jikan.moe">
  
  <!-- Prefetch critical data (injected by build process or added dynamically) -->
  <link rel="preload" href="data/anime.preview.json" as="fetch" crossorigin="anonymous">
  
  <!-- Prefetch likely navigation paths -->
  <link rel="prefetch" href="bookmarks.html">
  <link rel="prefetch" href="data/anime.full.json">
</head>
```

**Files to modify:**
- index.html
- bookmarks.html
- home/index.html

---

## 3. Memory Leaks

### 3.1 Trailer Observer Cleanup (High)

**Current State (Gap)**
Trailer observers not always disconnected, especially on rapid modal open/close.

**Remediation Strategy: Defensive Cleanup**

```javascript
/**
 * Setup trailer autoplay with guaranteed cleanup
 */
setupTrailerAutoplay(modalContent) {
  // Always cleanup first to prevent duplicates
  this.teardownTrailerObserver();
  this.teardownTrailerScrollListener();
  
  const trailerEmbed = document.querySelector('.detail-trailer .trailer-embed');
  if (!trailerEmbed) return;

  const iframe = trailerEmbed.querySelector('iframe');
  if (!iframe || !iframe.dataset.embedSrc) return;

  // ... rest of setup with guaranteed cleanup on dispose
  
  // Store cleanup function for guaranteed execution
  this.trailerCleanup = () => {
    this.teardownTrailerObserver();
    this.teardownTrailerScrollListener();
    this.stopTrailerPlayback();
  };
}

/**
 * Enhanced closeDetailModal with guaranteed cleanup
 */
closeDetailModal({ updateUrl = true } = {}) {
  this.setModalVisibility('detail-modal', false);
  
  // Execute cleanup if exists
  if (this.trailerCleanup) {
    this.trailerCleanup();
    this.trailerCleanup = null;
  }
  
  this.currentAnimeId = null;
  this.updateBookmarkToggle(null);

  if (updateUrl) {
    this.updateUrlForAnime(null);
  }
  this.updateMetaForFilters();
}
```

**Files to modify:**
- js/app.js: Lines 3944-4046

---

### 3.2 Event Listener Cleanup (High)

**Current State (Gap)**
Event listeners on document never removed. Lines 1765-1793 show multiple permanent listeners.

**Remediation Strategy: Centralized Event Management**

```javascript
// Add to App state
registeredListeners: [],

/**
 * Register an event listener with automatic tracking for cleanup
 */
addTrackedListener(target, event, handler, options = {}) {
  target.addEventListener(event, handler, options);
  this.registeredListeners.push({ target, event, handler, options });
},

/**
 * Remove all tracked event listeners (call on app destroy/page unload)
 */
removeAllListeners() {
  this.registeredListeners.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  this.registeredListeners = [];
},

/**
 * Setup event listeners with tracking
 */
setupEventListeners() {
  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    const handler = (e) => {
      this.currentSort = e.target.value;
      this.resetGridPagination();
      this.renderAnimeGrid();
    };
    this.addTrackedListener(sortSelect, 'change', handler);
  }
  
  // Document-level listeners with tracking
  const keydownHandler = (event) => {
    if (this.handleGlobalEscape(event)) {
      event.preventDefault();
    }
  };
  this.addTrackedListener(document, 'keydown', keydownHandler);
  
  const popstateHandler = () => {
    const filtersChanged = this.setActiveFiltersFromUrl({ updateUi: true });
    if (filtersChanged) {
      this.applyFilters({ syncUrl: false, updateMeta: false });
    }
    this.syncModalWithUrl({ updateUrl: false });
    this.updateMetaForFilters();
  };
  this.addTrackedListener(window, 'popstate', popstateHandler);
  
  // ... other listeners ...
}
```

**Files to modify:**
- js/app.js: Lines 1624-1793

---

### 3.3 ReviewsService Cache Size Limit (Medium)

**Current State (Gap)**
Cache in ReviewsService has no size limit. Lines 145-146 in js/reviews.js.

```javascript
// Cache to avoid repeated API calls
cache: new Map(),
descriptionCachePrefix: 'rekonime:description:',
descriptionCacheTtlMs: 1000 * 60 * 60 * 24 * 30,
```

**Remediation Strategy: LRU Cache with Size Limit**

```javascript
const ReviewsService = {
  // ... existing config ...
  
  // Cache configuration with limits
  cache: new Map(),
  cacheMaxSize: 50, // Maximum number of cached review sets
  cacheMaxAgeMs: 1000 * 60 * 30, // 30 minutes for reviews
  
  descriptionCachePrefix: 'rekonime:description:',
  descriptionCacheTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 days for descriptions
  
  /**
   * Set cache entry with LRU eviction
   */
  setCacheEntry(key, value) {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  },
  
  /**
   * Get cache entry with TTL validation
   */
  getCacheEntry(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheMaxAgeMs) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  },
  
  async fetchReviews(malId, title, isManualRetry = false) {
    const cacheKey = malId || title;
    
    if (isManualRetry) {
      this.resetRetryCount(cacheKey);
    }
    
    // Use new cache method with TTL
    const cached = this.getCacheEntry(cacheKey);
    if (cached && !isManualRetry) {
      return cached;
    }
    
    // ... fetch logic ...
    
    // Store with LRU management
    this.setCacheEntry(cacheKey, result);
    return result;
  }
};
```

**Files to modify:**
- js/reviews.js: Lines 145-146, 265-346

---

## 4. Missing Performance Optimizations

### 4.1 Virtual Scrolling for Large Grids (Medium)

**Current State (Gap)**
All grid items rendered to DOM regardless of viewport. With 500+ anime, this causes performance issues.

**Remediation Strategy: Intersection Observer-Based Virtual Scrolling**

```javascript
// Add to App state
gridObserver: null,
virtualScrollingEnabled: true,
visibleCardIds: new Set(),

/**
 * Setup virtual scrolling with Intersection Observer
 */
setupVirtualScrolling() {
  if (!this.virtualScrollingEnabled) return;
  if (this.gridObserver) return;
  
  const options = {
    root: null,
    rootMargin: '100px', // Load slightly before viewport
    threshold: 0
  };
  
  this.gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const card = entry.target;
      const animeId = card.dataset.animeId;
      
      if (entry.isIntersecting) {
        this.visibleCardIds.add(animeId);
        card.classList.remove('is-virtual');
        // Load any lazy content
        this.loadCardContent(card);
      } else {
        this.visibleCardIds.delete(animeId);
        // Optional: Unload heavy content for off-screen cards
        // card.classList.add('is-virtual');
      }
    });
  }, options);
  
  // Observe all cards
  this.observeGridCards();
},

/**
 * Observe all current grid cards
 */
observeGridCards() {
  if (!this.gridObserver) return;
  
  const cards = document.querySelectorAll('.anime-card');
  cards.forEach(card => this.gridObserver.observe(card));
},

/**
 * Load content for a card when it becomes visible
 */
loadCardContent(card) {
  // Load lazy images
  const img = card.querySelector('img[loading="lazy"]');
  if (img && img.dataset.src) {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  }
}

/**
 * Cleanup virtual scrolling
 */
teardownVirtualScrolling() {
  if (this.gridObserver) {
    this.gridObserver.disconnect();
    this.gridObserver = null;
  }
  this.visibleCardIds.clear();
}
```

**Files to modify:**
- js/app.js: Add virtual scrolling methods

---

### 4.2 Image Lazy Loading Optimization (Low)

**Current State (Gap)**
Images have `loading="lazy"` but above-fold content should use eager loading.

**Remediation Strategy: Smart Loading Attribute**

```javascript
/**
 * Build image with smart loading attribute
 */
buildImageAttributes(anime, index) {
  const { src, srcset, sizes } = this.buildImageSrcset(anime.cover);
  const safeCover = this.escapeAttr(src || this.sanitizeUrl(anime.cover));
  const srcsetAttr = srcset ? `srcset="${this.escapeAttr(srcset)}"` : '';
  const sizesAttr = sizes ? `sizes="${this.escapeAttr(sizes)}"` : '';
  
  // First 12 images (above fold) load eagerly, rest lazy
  const loading = index < 12 ? 'eager' : 'lazy';
  const decoding = index < 12 ? 'sync' : 'async';
  
  return {
    src: safeCover,
    srcsetAttr,
    sizesAttr,
    loading,
    decoding
  };
}

// Update renderAnimeCards to use smart loading
renderAnimeCards(animeList, { showBookmarkToggle = false, startIndex = 0 } = {}) {
  return animeList.map((anime, localIndex) => {
    const index = startIndex + localIndex;
    const imgAttrs = this.buildImageAttributes(anime, index);
    
    return `
      <div class="anime-card" data-action="open-anime" data-anime-id="${safeId}">
        <div class="card-media">
          <img src="${imgAttrs.src}" 
               ${imgAttrs.srcsetAttr} 
               ${imgAttrs.sizesAttr}
               alt="${safeTitle}" 
               class="card-cover" 
               loading="${imgAttrs.loading}"
               decoding="${imgAttrs.decoding}"
               data-fallback-src="https://via.placeholder.com/120x170?text=No+Image">
          // ...
        </div>
      </div>
    `;
  }).join('');
}
```

**Files to modify:**
- js/app.js: Lines 2794-2871

---

### 4.3 Prefetching for Likely Navigation (Low)

**Current State (Gap)**
No prefetching for likely navigation paths (e.g., bookmarked anime, recommended anime).

**Remediation Strategy: Intelligent Prefetching**

```javascript
// Add to App state
prefetchQueue: new Set(),
prefetchObserver: null,

/**
 * Setup intelligent prefetching based on user behavior
 */
setupIntelligentPrefetching() {
  if ('IntersectionObserver' in window) {
    this.prefetchObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const animeId = card.dataset.animeId;
          this.queuePrefetch(animeId);
        }
      });
    }, {
      rootMargin: '200px' // Prefetch when within 200px of viewport
    });
    
    // Observe recommendation cards and bookmarks
    this.updatePrefetchObserving();
  }
},

/**
 * Update which elements are being observed for prefetch
 */
updatePrefetchObserving() {
  if (!this.prefetchObserver) return;
  
  // Observe recommendation cards
  document.querySelectorAll('.recommendation-card, .trending-card, .similar-card').forEach(card => {
    this.prefetchObserver.observe(card);
  });
},

/**
 * Queue an anime for prefetching
 */
queuePrefetch(animeId) {
  if (this.prefetchQueue.has(animeId)) return;
  if (this.prefetchQueue.size >= 10) return; // Limit concurrent prefetches
  
  this.prefetchQueue.add(animeId);
  
  // Use requestIdleCallback for non-critical prefetching
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => this.prefetchAnime(animeId), { timeout: 2000 });
  } else {
    setTimeout(() => this.prefetchAnime(animeId), 100);
  }
},

/**
 * Prefetch anime data and image
 */
prefetchAnime(animeId) {
  const anime = this.animeData.find(a => a.id === animeId);
  if (!anime) return;
  
  // Prefetch image
  if (anime.cover) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = anime.cover;
    document.head.appendChild(link);
  }
  
  // Mark as prefetched
  this.prefetchQueue.delete(animeId);
}
```

**Files to modify:**
- js/app.js: Add prefetching methods

---

## 5. Implementation Priority

### Phase 1: Critical Performance (High Impact)
1. **Parallel Data Fetching** - Reduce initial load time
2. **Trailer Observer Cleanup** - Fix memory leaks
3. **Event Listener Cleanup** - Prevent accumulation
4. **Grid Diff Rendering** - Reduce DOM operations on sort

### Phase 2: Important Optimizations (Medium Impact)
5. **Template-Based Card Rendering** - Reduce string churn
6. **ReviewsService Cache Limit** - Prevent unbounded growth
7. **Smart Image Loading** - Improve above-fold performance
8. **Modal Cache Optimization** - Skip skeleton for cached data

### Phase 3: Advanced Optimizations (Lower Impact)
9. **Virtual Scrolling** - Handle very large datasets
10. **Intelligent Prefetching** - Predictive loading
11. **Resource Hints in HTML** - Preconnect/prefetch tags

---

## 6. Testing Checklist

After implementing fixes, verify:

### Performance Metrics
- [ ] Initial load time < 2s on 3G
- [ ] Time to Interactive < 3s
- [ ] Sort operations don't cause frame drops (> 60fps)
- [ ] Modal opens smoothly without jank
- [ ] Memory usage stays stable during navigation

### Functional Tests
- [ ] Grid renders correctly with all sorting options
- [ ] Load More button works with pagination
- [ ] Modal shows correct data for all anime
- [ ] Trailers play correctly
- [ ] Bookmarks persist correctly
- [ ] Filters apply correctly
- [ ] Search returns accurate results

### Memory Tests
- [ ] No memory growth after opening/closing modal 20+ times
- [ ] No detached DOM nodes in heap snapshot
- [ ] Event listener count stable after navigation
- [ ] Cache size doesn't exceed limits

### Cross-Browser
- [ ] Works in Chrome/Edge
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile browsers
- [ ] Graceful degradation without IntersectionObserver

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| js/app.js | Diff rendering, template pooling, parallel loading, event cleanup, virtual scrolling, prefetching |
| js/reviews.js | LRU cache implementation with size limits |
| index.html | Add resource hints (preconnect, dns-prefetch, preload) |
| bookmarks.html | Add resource hints |
| home/index.html | Add resource hints |

---

## 8. Performance Budget

Target metrics after optimization:

| Metric | Current (Est.) | Target |
|--------|---------------|--------|
| First Contentful Paint | ~1.5s | < 1s |
| Time to Interactive | ~3s | < 2s |
| Sort operation | ~500ms | < 100ms |
| Modal open | ~300ms | < 150ms |
| Memory usage (stable) | Growing | < 100MB stable |
| DOM nodes (grid) | All items | Viewport + buffer |

---

## 9. Rollback Plan

If issues arise:

1. **Feature Flags**: Implement each optimization behind a flag:
   ```javascript
   features: {
     diffRendering: true,
     templatePooling: true,
     virtualScrolling: false, // Disable if issues
     parallelLoading: true
   }
   ```

2. **Gradual Rollout**: Enable features incrementally per session:
   ```javascript
   enableFeature(feature) {
     if (this.features[feature] === 'auto') {
       // A/B test or gradual rollout
       return Math.random() < 0.5;
     }
     return this.features[feature];
   }
   ```

3. **Quick Disable**: All features can be disabled by setting feature flags to `false`.
