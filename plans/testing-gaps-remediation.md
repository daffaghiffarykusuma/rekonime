# Testing Gaps Remediation Plan

## Executive Summary

**Current State:** ~90% of application code lacks automated test coverage. Only 2 of 11 JS modules have tests.

**Goal:** Achieve comprehensive test coverage with unit, integration, and E2E tests for critical user flows.

---

## 1. Current Test Coverage Analysis

### 1.1 Existing Tests (Covered)

| File | Lines | Tests | Coverage |
|------|-------|-------|----------|
| `test/stats.test.js` | 94 | 11 | Core stats calculation functions |
| `test/recommendations.test.js` | 240 | ~15 | Recommendation engine, badges, sorting |

**Total:** ~334 lines of tested code

### 1.2 Untested Modules (Gaps)

| Module | Lines | Criticality | Complexity |
|--------|-------|-------------|------------|
| `js/app.js` | 4,381 | CRITICAL | High - Main controller, state management |
| `js/reviews.js` | 795 | HIGH | Medium - Jikan API integration |
| `js/discovery.js` | 407 | HIGH | Medium - Surprise Me, seasonal, trending |
| `js/filterPresets.js` | 223 | MEDIUM | Low - Preset definitions |
| `js/keyboardShortcuts.js` | 460 | MEDIUM | Medium - Event handling |
| `js/metricGlossary.js` | 339 | LOW | Low - Static definitions |
| `js/onboarding.js` | 439 | MEDIUM | Medium - Tour logic |
| `js/themeManager.js` | 192 | LOW | Low - Theme switching |
| `js/serviceWorker.js` | 184 | MEDIUM | Medium - PWA features |
| `js/charts.js` | 1,149 | MEDIUM | High - Chart.js integration |

**Total Untested:** ~8,569 lines (~96% of code)

---

## 2. Testing Strategy

### 2.1 Test Pyramid

```
       /\
      /  \     E2E Tests (Playwright)
     / 5% \    ~20 tests - Critical flows only
    /______\
   /        \   Integration Tests
  /  15%     \  ~100 tests - Module interactions
 /____________\
/              \ Unit Tests
/     80%       \ ~400 tests - Individual functions
/________________\
```

### 2.2 Test Categories

| Category | Tool | Purpose | Target Coverage |
|----------|------|---------|-----------------|
| **Unit Tests** | Node.js built-in + jsdom | Test individual functions in isolation | 80% of business logic |
| **Integration Tests** | Node.js + mock fetch | Test module interactions, API contracts | Data pipeline, service integrations |
| **E2E Tests** | Playwright | Test critical user flows end-to-end | 10 key user journeys |
| **Visual Regression** | Playwright + screenshots | Catch unintended UI changes | Modal states, grid layouts |

---

## 3. Environment Setup

### 3.1 Current Issues

- Tests use Node.js but app runs in browser
- No DOM/environment mocking
- Missing browser API stubs (localStorage, fetch, matchMedia, etc.)
- No test coverage reporting

### 3.2 Required Setup

```javascript
// test/setup.js - Test environment bootstrap
// Mock browser globals for Node.js environment
global.window = {
  location: { protocol: 'https:', href: 'http://localhost/' },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  requestIdleCallback: (cb) => setTimeout(cb, 0),
  addEventListener: () => {},
  innerWidth: 1024
};

global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  createElement: () => ({}),
  documentElement: { setAttribute: () => {}, removeAttribute: () => {} },
  head: { appendChild: () => {} },
  body: { style: {}, appendChild: () => {}, removeChild: () => {} }
};

global.localStorage = {
  storage: {},
  getItem: (k) => global.localStorage.storage[k] || null,
  setItem: (k, v) => global.localStorage.storage[k] = v,
  removeItem: (k) => delete global.localStorage.storage[k]
};

global.fetch = () => Promise.resolve({ ok: true, json: () => ({}) });
global.navigator = { onLine: true, serviceWorker: {} };
global.CSS = { escape: (s) => s.replace(/["\\]/g, '\\$&') };
```

### 3.3 Package.json Updates

```json
{
  "scripts": {
    "test": "node --test test",
    "test:unit": "node --test test/unit",
    "test:integration": "node --test test/integration",
    "test:e2e": "playwright test",
    "test:coverage": "c8 --reporter=html --reporter=text node --test test",
    "test:watch": "node --test --watch test"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "c8": "^8.0.0",
    "jsdom": "^23.0.0"
  }
}
```

---

## 4. Module-by-Module Test Plan

### 4.1 js/reviews.js (Priority: HIGH)

**Test File:** `test/unit/reviews.test.js`

```javascript
// Test cases needed:

describe('ReviewsService', () => {
  describe('sanitizeReviewText', () => {
    test('removes HTML tags', () => {});
    test('decodes HTML entities', () => {});
    test('handles spoiler markup', () => {});
    test('removes BBCode image embeds', () => {});
    test('handles markdown links', () => {});
  });

  describe('categorizeReviews', () => {
    test('splits reviews by sentiment', () => {});
    test('limits to max per category', () => {});
    test('deduplicates by ID', () => {});
    test('filters by minimum length', () => {});
    test('excludes spoilers when configured', () => {});
  });

  describe('fetchReviews', () => {
    test('returns cached data if available', () => {});
    test('fetches from Jikan API', () => {});
    test('handles rate limiting (429)', () => {});
    test('retries with exponential backoff', () => {});
    test('handles network errors gracefully', () => {});
    test('caches descriptions to localStorage', () => {});
  });

  describe('buildReviewSummary', () => {
    test('extracts first sentence', () => {});
    test('truncates long text', () => {});
    test('handles empty input', () => {});
  });
});
```

### 4.2 js/discovery.js (Priority: HIGH)

**Test File:** `test/unit/discovery.test.js`

```javascript
describe('Discovery', () => {
  describe('getSurpriseMe', () => {
    test('returns anime meeting quality thresholds', () => {});
    test('excludes specified IDs', () => {});
    test('weights by bookmark preferences', () => {});
    test('returns null if no candidates', () => {});
    test('uses weighted random selection', () => {});
  });

  describe('getSeasonalFilters', () => {
    test('returns current season if exists in catalog', () => {});
    test('returns previous season if exists', () => {});
    test('returns next season if exists', () => {});
    test('highlights current season', () => {});
  });

  describe('getTrending', () => {
    test('calculates trending score correctly', () => {});
    test('boosts recent anime', () => {});
    test('boosts high retention + satisfaction', () => {});
    test('returns top N results', () => {});
  });

  describe('getCurrentSeason', () => {
    test('returns correct season for month', () => {});
    test('returns correct year', () => {});
  });

  describe('getPopularThisWeek', () => {
    test('uses week number for consistent results', () => {});
    test('shuffles differently each week', () => {});
  });
});
```

### 4.3 js/filterPresets.js (Priority: MEDIUM)

**Test File:** `test/unit/filterPresets.test.js`

```javascript
describe('FilterPresets', () => {
  describe('applyPreset', () => {
    test('binge-worthy filters by flow state and stress', () => {});
    test('critical-darlings filters by MAL score', () => {});
    test('hidden-gems finds high retention, low MAL', () => {});
    test('easy-watches includes slice of life and comedy', () => {});
    test('strong-starters filters by hook score', () => {});
    test('great-endings filters by worth finishing', () => {});
  });

  describe('getSortForPreset', () => {
    test('returns correct sort key for each preset', () => {});
  });

  describe('matchesPreset', () => {
    test('correctly identifies matching anime', () => {});
  });
});
```

### 4.4 js/keyboardShortcuts.js (Priority: MEDIUM)

**Test File:** `test/unit/keyboardShortcuts.test.js`

```javascript
describe('KeyboardShortcuts', () => {
  describe('handleKeydown', () => {
    test('ignores when typing in inputs', () => {});
    test('? shows help modal', () => {});
    test('/ focuses search', () => {});
    test('Escape closes modals', () => {});
    test('b navigates to bookmarks', () => {});
    test('f opens filters', () => {});
    test('s toggles settings', () => {});
    test('r triggers surprise me', () => {});
    test('h clears filters', () => {});
  });

  describe('modal shortcuts', () => {
    test('ArrowLeft navigates to previous anime', () => {});
    test('ArrowRight navigates to next anime', () => {});
  });

  describe('focusTrap', () => {
    test('traps focus within modal', () => {});
    test('cycles focus correctly', () => {});
  });
});
```

### 4.5 js/themeManager.js (Priority: LOW)

**Test File:** `test/unit/themeManager.test.js`

```javascript
describe('ThemeManager', () => {
  describe('applyTheme', () => {
    test('sets data-theme attribute', () => {});
    test('saves to localStorage', () => {});
    test('applies system theme when auto', () => {});
  });

  describe('detectOSPreference', () => {
    test('returns light when prefers-color-scheme: light', () => {});
    test('returns dark by default', () => {});
  });

  describe('toggleTheme', () => {
    test('switches between light and dark', () => {});
  });
});
```

### 4.6 js/metricGlossary.js (Priority: LOW)

**Test File:** `test/unit/metricGlossary.test.js`

```javascript
describe('MetricGlossary', () => {
  describe('get', () => {
    test('returns definition for valid keys', () => {});
    test('returns null for invalid keys', () => {});
  });

  describe('formatValue', () => {
    test('formats percentages correctly', () => {});
    test('formats satisfaction scores', () => {});
    test('handles momentum with signs', () => {});
  });

  describe('interpretValue', () => {
    test('returns correct scale interpretation', () => {});
    test('handles edge cases', () => {});
  });

  describe('parseRange', () => {
    test('parses numeric ranges', () => {});
    test('handles "Below X" format', () => {});
  });
});
```

### 4.7 js/serviceWorker.js (Priority: MEDIUM)

**Test File:** `test/unit/serviceWorker.test.js`

```javascript
describe('ServiceWorkerManager', () => {
  describe('register', () => {
    test('registers service worker', () => {});
    test('handles unsupported browsers', () => {});
    test('handles registration errors', () => {});
  });

  describe('handleUpdates', () => {
    test('detects new worker installation', () => {});
    test('shows update prompt when waiting', () => {});
  });

  describe('connectivity', () => {
    test('shows offline indicator when offline', () => {});
    test('hides offline indicator when online', () => {});
  });
});
```

---

## 5. Integration Tests

### 5.1 Data Pipeline Integration

**Test File:** `test/integration/data-pipeline.test.js`

```javascript
describe('Data Pipeline', () => {
  test('full catalog loads and normalizes correctly', () => {});
  test('preview data loads before full data', () => {});
  test('embedded data fallback works', () => {});
  test('stats calculation runs on normalized data', () => {});
  test('filter options extracted correctly', () => {});
});
```

### 5.2 App Module Integration

**Test File:** `test/integration/app-integration.test.js`

```javascript
describe('App Integration', () => {
  test('initializes and loads data', () => {});
  test('applies filters and updates UI', () => {});
  test('sorting changes grid order', () => {});
  test('bookmarks persist to localStorage', () => {});
  test('settings apply accessibility attributes', () => {});
  test('search returns matching results', () => {});
  test('URL params sync with filter state', () => {});
});
```

### 5.3 Reviews Integration

**Test File:** `test/integration/reviews-integration.test.js`

```javascript
describe('Reviews Integration', () => {
  test('fetchReviews integrates with Jikan API', async () => {});
  test('synopsis caching works end-to-end', async () => {});
  test('retry logic handles transient failures', async () => {});
});
```

---

## 6. E2E Tests (Playwright)

### 6.1 Critical User Flows

**Test File:** `test/e2e/critical-flows.spec.js`

```javascript
test.describe('Critical User Flows', () => {
  test('User can browse and filter anime', async ({ page }) => {
    // 1. Visit homepage
    // 2. Wait for grid to load
    // 3. Apply genre filter
    // 4. Verify filtered results
    // 5. Clear filters
  });

  test('User can view anime details', async ({ page }) => {
    // 1. Click on anime card
    // 2. Verify modal opens
    // 3. Check synopsis loaded
    // 4. Verify reviews section
    // 5. Close modal
  });

  test('User can bookmark anime', async ({ page }) => {
    // 1. Open anime detail
    // 2. Click bookmark button
    // 3. Verify bookmark saved
    // 4. Navigate to bookmarks page
    // 5. Verify anime appears in bookmarks
  });

  test('User can use surprise me', async ({ page }) => {
    // 1. Click surprise me button
    // 2. Verify modal opens with random anime
    // 3. Verify anime has data
  });

  test('User can search for anime', async ({ page }) => {
    // 1. Focus search
    // 2. Type query
    // 3. Verify dropdown appears
    // 4. Select result
    // 5. Verify detail opens
  });

  test('Keyboard shortcuts work', async ({ page }) => {
    // 1. Press ? to open shortcuts
    // 2. Press Escape to close
    // 3. Press / to focus search
    // 4. Press b to go to bookmarks
  });

  test('Settings persist across reloads', async ({ page }) => {
    // 1. Open settings
    // 2. Toggle data saver
    // 3. Reload page
    // 4. Verify setting persisted
  });

  test('Theme switching works', async ({ page }) => {
    // 1. Open settings
    // 2. Switch to light theme
    // 3. Verify data-theme attribute
    // 4. Switch to dark theme
    // 5. Verify data-theme attribute
  });
});
```

### 6.2 Visual Regression Tests

**Test File:** `test/e2e/visual-regression.spec.js`

```javascript
test.describe('Visual Regression', () => {
  test('homepage matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await page.screenshot()).toMatchSnapshot('homepage.png');
  });

  test('detail modal matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.click('.anime-card:first-child');
    await page.waitForSelector('#detail-modal.visible');
    expect(await page.screenshot()).toMatchSnapshot('detail-modal.png');
  });

  test('filter modal matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.click('#filter-toggle');
    await page.waitForSelector('#filter-modal.visible');
    expect(await page.screenshot()).toMatchSnapshot('filter-modal.png');
  });
});
```

---

## 7. Test Coverage Reporting

### 7.1 Setup c8 for Coverage

```bash
npm install --save-dev c8
```

### 7.2 Coverage Targets

| Module | Target | Priority |
|--------|--------|----------|
| stats.js | 90% | High |
| recommendations.js | 90% | High |
| reviews.js | 80% | High |
| discovery.js | 80% | High |
| filterPresets.js | 70% | Medium |
| keyboardShortcuts.js | 60% | Medium |
| themeManager.js | 70% | Low |
| metricGlossary.js | 50% | Low |
| serviceWorker.js | 60% | Medium |
| app.js | 50% | Critical |

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up test environment with jsdom
- [ ] Create browser API mocks
- [ ] Set up coverage reporting
- [ ] Write tests for reviews.js

### Phase 2: Core Modules (Week 2)
- [ ] Write tests for discovery.js
- [ ] Write tests for filterPresets.js
- [ ] Write tests for keyboardShortcuts.js

### Phase 3: Supporting Modules (Week 3)
- [ ] Write tests for themeManager.js
- [ ] Write tests for metricGlossary.js
- [ ] Write tests for serviceWorker.js

### Phase 4: Integration Tests (Week 4)
- [ ] Set up integration test environment
- [ ] Write data pipeline integration tests
- [ ] Write app module integration tests

### Phase 5: E2E Tests (Week 5)
- [ ] Set up Playwright
- [ ] Write critical user flow tests
- [ ] Set up visual regression tests

### Phase 6: CI/CD Integration (Week 6)
- [ ] Add test step to CI pipeline
- [ ] Configure coverage thresholds
- [ ] Set up test reporting

---

## 9. Testing Patterns

### 9.1 Mock Pattern for Browser APIs

```javascript
// test/mocks/browser.js
const createMockStorage = () => {
  const storage = {};
  return {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => storage[key] = String(value),
    removeItem: (key) => delete storage[key],
    clear: () => Object.keys(storage).forEach(k => delete storage[k]),
    _storage: storage // for test inspection
  };
};

const createMockFetch = (responses) => {
  return (url) => {
    const response = responses[url];
    if (response) {
      return Promise.resolve({
        ok: response.ok !== false,
        status: response.status || 200,
        json: () => Promise.resolve(response.data || {}),
        text: () => Promise.resolve(response.text || '')
      });
    }
    return Promise.reject(new Error(`Unexpected fetch to ${url}`));
  };
};

module.exports = { createMockStorage, createMockFetch };
```

### 9.2 Test Data Factory

```javascript
// test/factories/anime.js
const createAnime = (overrides = {}) => ({
  id: 'test-anime-1',
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  titleJapanese: 'テストアニメ',
  malId: 12345,
  cover: 'https://example.com/cover.jpg',
  year: 2024,
  season: 'Spring',
  studio: 'Test Studio',
  source: 'Manga',
  genres: ['Action', 'Adventure'],
  themes: ['Fantasy'],
  demographic: 'Shounen',
  communityScore: 8.5,
  synopsis: 'A test anime synopsis.',
  episodes: [
    { episode: 1, score: 4.5 },
    { episode: 2, score: 4.0 },
    { episode: 3, score: 4.5 }
  ],
  stats: createStats(),
  ...overrides
});

const createStats = (overrides = {}) => ({
  retentionScore: 85,
  churnRisk: { score: 15, label: 'Low', factors: [] },
  threeEpisodeHook: 90,
  worthFinishing: 80,
  flowState: 75,
  ...overrides
});

module.exports = { createAnime, createStats };
```

---

## 10. Success Metrics

- **Unit Test Coverage:** 70% minimum, 80% target
- **Integration Test Coverage:** All major module interactions tested
- **E2E Test Coverage:** 10 critical user flows automated
- **Test Run Time:** < 30 seconds for unit tests, < 5 minutes for full suite
- **Flaky Test Rate:** < 5%

---

## Appendix: File Structure

```
test/
├── setup.js                    # Test environment bootstrap
├── mocks/
│   ├── browser.js              # Browser API mocks
│   └── fetch.js                # Fetch mocking utilities
├── factories/
│   ├── anime.js                # Anime test data factory
│   └── stats.js                # Stats test data factory
├── unit/
│   ├── stats.test.js           # (existing)
│   ├── recommendations.test.js # (existing)
│   ├── reviews.test.js         # NEW
│   ├── discovery.test.js       # NEW
│   ├── filterPresets.test.js   # NEW
│   ├── keyboardShortcuts.test.js # NEW
│   ├── metricGlossary.test.js  # NEW
│   ├── themeManager.test.js    # NEW
│   └── serviceWorker.test.js   # NEW
├── integration/
│   ├── data-pipeline.test.js   # NEW
│   ├── app-integration.test.js # NEW
│   └── reviews-integration.test.js # NEW
└── e2e/
    ├── critical-flows.spec.js  # NEW
    └── visual-regression.spec.js # NEW
```
