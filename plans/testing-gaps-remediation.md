# Testing Gaps Remediation Plan (Updated 2026-02-01)

## Executive Summary

- Current state: 2 unit test files (`test/stats.test.js`, `test/recommendations.test.js`).
- The repo is ESM-first and uses `node:test`. There is no DOM harness, coverage reporting, or E2E suite.
- Goal: add unit tests for core/services + key feature modules, integration tests for app state flows, and a minimal Playwright E2E smoke suite.

---

## 1. Current Coverage Snapshot

### 1.1 Existing Tests (Covered)

- `test/stats.test.js`
- `test/recommendations.test.js`

### 1.2 Untested High-Impact Modules

- `js/app.js`
- `js/reviews.js`
- `js/discovery.js`
- `js/filterPresets.js`
- `js/keyboardShortcuts.js`
- `js/onboarding.js`
- `js/themeManager.js`
- `js/metricGlossary.js`
- `js/serviceWorker.js`
- `js/healthMonitor.js`
- `js/circuitBreaker.js`
- `js/services/*`
- `js/core/*`

### 1.3 Optional / Low Priority

- `js/charts.js` (not wired)
- `js/data.js` (embedded fallback data only)

---

## 2. Testing Strategy (Updated for ESM)

- Unit tests: `node:test` + `jsdom` for DOM helpers, no network access.
- Integration tests: `node:test` + `jsdom` + stubbed fetch, focused on App state + URL sync.
- E2E tests: Playwright (chromium) against Vite dev server; keep to critical smoke flows.
- Coverage: `c8` with `node --test` and per-module targets.

---

## 3. Environment Setup

### 3.1 DOM + Browser API Harness

- `test/setup.js` sets `window`, `document`, `navigator`, `matchMedia`, `IntersectionObserver`, and animation/frame shims.
- Helpers live in `test/helpers/` for reusable DOM setup and fixtures.

### 3.2 Package Scripts (ESM)

```
"test": "node --test --import ./test/setup.js \"test/**/*.test.js\"",
"test:unit": "node --test --import ./test/setup.js \"test/unit/**/*.test.js\"",
"test:integration": "node --test --import ./test/setup.js \"test/integration/**/*.test.js\"",
"test:coverage": "c8 --reporter=html --reporter=text node --test --import ./test/setup.js \"test/**/*.test.js\"",
"test:e2e": "playwright test"
```

### 3.3 Dev Dependencies

- `jsdom`
- `c8`
- `@playwright/test`

---

## 4. Unit Test Plan (by module)

### Core
- `js/core/dependency-container.js`
- `js/core/event-bus.js`
- `js/core/store.js`

### Services
- `js/services/api-client.js`
- `js/services/cache-manager.js`
- `js/services/schema-validator.js`
- `js/services/rate-limiter.js`
- `js/services/analytics-service.js`
- `js/services/error-handler.js`

### Resilience + Health
- `js/circuitBreaker.js`
- `js/healthMonitor.js`

### Feature Modules
- `js/reviews.js`
- `js/discovery.js`
- `js/filterPresets.js`
- `js/keyboardShortcuts.js`
- `js/themeManager.js`
- `js/metricGlossary.js`
- `js/onboarding.js`
- `js/serviceWorker.js`

### Existing
- `js/stats.js` (already tested)
- `js/recommendations.js` (already tested)

---

## 5. Integration Tests

### App URL + Filter State
- `App.getFiltersFromUrl`
- `App.normalizeFilterValues`
- `App.setFiltersOnUrl`
- `App.buildFilterStateUrl`

### App Preset Application
- `App.applyFilterPreset` updates `filteredData`, sort, and DOM hooks

---

## 6. E2E Tests (Playwright)

- Home renders catalog grid and cards
- Open detail modal from grid
- Header search yields results and opens detail
- Surprise Me opens detail modal
- Bookmarks flow (toggle + bookmarks page) if stable on CI
- Theme switching or settings persistence (optional if stable)

---

## 7. Coverage Targets

- Core/services: 80%+
- Feature modules: 60-80% depending on DOM complexity
- App: 40-50% for utilities + integration coverage

---

## 8. Implementation Phases

### Phase 1: Harness
- [ ] Add `test/setup.js` + helpers
- [ ] Update scripts and add `c8`

### Phase 2: Core + Services
- [ ] Unit tests for `core/*` and `services/*`
- [ ] Unit tests for `circuitBreaker` and `healthMonitor`

### Phase 3: Feature Modules
- [ ] Unit tests for reviews, discovery, presets, keyboard shortcuts, theme, glossary, onboarding, service worker

### Phase 4: Integration + E2E
- [ ] App URL/filter integration tests
- [ ] App preset integration tests
- [ ] Playwright smoke suite

---

## 9. Success Metrics

- Unit coverage: 70% minimum, 80% target
- Integration: critical App state flows covered
- E2E: 4-6 smoke flows stable
- Runtime: unit/integration < 30s, E2E < 5m on CI
