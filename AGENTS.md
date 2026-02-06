# Rekonime Agent Guide

## Start Here
- Read this file end-to-end before starting any task.
- Always check the `skills/` folder at the start of a task.
- Always apply the Atom-of-Thought protocol below at the start of a task.
- For UI or design work (layouts, styling, components, or visual changes), also apply `skills/FRONTEND-DESIGN.md` and `skills/FRONTEND-RESPONSIVE-UI.md`.
- Optimize for Lighthouse web audit standards under Slow 4G throttling and a Brave browser user profile.
- Treat Performance, Accessibility, Best Practices, and SEO as non-negotiable quality gates.

## Atom-of-Thought Protocol (Internal Only)
- Decompose requirements into atomic, MECE units.
- Validate dependencies, edge cases, and assumptions; create sub-atoms when unclear.
- Implement in dependency order with clean, production-ready code and standard comments.
- Synthesize into a cohesive solution with natural documentation.
- Never expose atom labels, phases, confidence scores, or internal reasoning in output.

## Lighthouse Performance Targets (Slow 4G + Brave)
- Optimize for First Contentful Paint, Largest Contentful Paint, Speed Index, Total Blocking Time, and Cumulative Layout Shift.
- Prioritize fast initial render, stable layout, and minimal main-thread blocking.
- Avoid layout shifts by reserving space for images, fonts, and dynamic content.

## Lighthouse Quality Gates
- Accessibility: semantic HTML, labels, contrast, focus states, and keyboard navigation.
- Best Practices: safe and modern APIs, CSP-aware changes, and error-free console output.
- SEO: correct meta, structured headings, descriptive titles, and crawlable content.

## Lighthouse Review Checklist
- Performance: FCP, LCP, Speed Index, TBT, CLS stay within target ranges on Slow 4G.
- Accessibility: labels, alt text, focus order, contrast, ARIA, and keyboard flows verified.
- Best Practices: HTTPS, no console errors, modern APIs, CSP-safe assets.
- SEO: title/meta description, headings, canonical, and crawlable links verified.

## Current Lighthouse Baseline (Slow 4G)
- Source: `plans/rekonime.vercel.app-20260206T070441.json` (Lighthouse 13.0.1, URL `https://rekonime.vercel.app/home/`).
- Scores: Performance 0.86, Accessibility 1.00, Best Practices 1.00, SEO 1.00.
- Metrics: FCP 1.28s, LCP 1.89s, Speed Index 1.55s, TBT 513ms, CLS 0.034.
- Update this baseline when a new report is generated.

## User Journey (Condensed)
- Entry points: `/` or `index.html` (primary), `/home` or `home/index.html`, `/watchlist` or `watchlist.html`, plus deep links via query params.
- First load: `App.init()` shows loading state, loads watchlist, fetches `data/anime.preview.json`, then swaps to `data/anime.full.json`.
- Discover: scroll, search, filters, Surprise Me, seasonal chips, trending, and presets.
- Evaluate: detail modal shows synopsis, trailer, reviews, and similar anime; URL updates with `?anime=...`.
- Decide: update watch status or return to browsing; recommendations personalize based on watchlist.
- Persistence: theme, onboarding, shortcuts acknowledgement, watchlist, and cached synopsis/reviews stored via `CacheManager`.
- Resilience: embedded `ANIME_DATA` fallback for `file://` or fetch failures; image fallbacks use `data-fallback-src`.
- PWA: service worker registers, offline indicator appears, and update prompts are shown when new versions exist.

## Codebase Map (Key Files)
- `index.html`, `home/index.html`, `watchlist.html`: entry points; include CSS and JS.
- `css/styles.css`, `css/themes.css`: global styles, theme system, accessibility, responsive rules.
- `js/main.js`: module entrypoint; bootstraps app services and `App.init()`.
- `js/app.js`: central controller for state, rendering, filters, search, modals, SEO, watchlist.
- `js/stats.js`: metrics and score profiles.
- `js/recommendations.js`: sorting, badges, similarity scoring.
- `js/reviews.js`: Jikan reviews + synopsis utilities.
- `js/discovery.js`: surprise, seasonal, trending, because-you-watched.
- `js/filterPresets.js`, `js/keyboardShortcuts.js`, `js/metricGlossary.js`, `js/onboarding.js`, `js/themeManager.js`.
- `js/services/*`: API client, cache, rate limiter, schema validation, analytics, error handling, logging.
- `data/*.json`: catalog sources (`anime.json`, `anime.full.json`, `anime.preview.json`).
- `js/data.js`: embedded fallback dataset.
- `sw.js`, `version.json`, `health.html`: PWA + health surface.
- `tools/*`: build pipeline, validation, deployment utilities.
- `test/*.test.js`: node:test coverage for stats, recs, build pipeline.

## Runtime Flows (Key)
- Initial load and swap: preview data first, then full catalog refresh.
- Filters and sorting: `App.activeFilters` + `Recommendations.getSortOptions()`.
- Search: `anime.searchText` matched by `App.handleHeaderSearch()`.
- Detail modal: `App.showAnimeDetail()` renders, syncs URL, and manages back/forward.
- Reviews and synopsis: Jikan API via `ReviewsService`; cached via `CacheManager` with TTL.
- Watchlist: stored under `rekonime.watchlist` (legacy `rekonime.bookmarks` migrated), rendered in `watchlist.html`.

## Data Schema (Essentials)
- Catalog payload: `{ generatedAt, scoreProfile, anime[] }`.
- Anime object: core identity + metadata, `genres[]`, `themes[]`, `synopsis`, `trailer`, `communityScore`, `searchText`, `episodes[]`, `stats`, `colorIndex`.
- Stats object: see `js/stats.js` for full fields; includes quality, retention, momentum, consistency, safety, and trend metrics (most scaled with a strictness curve).

## DOM & UI Contracts
- Key IDs: `#anime-grid`, `#recommendations-grid`, `#filter-modal`, `#filter-sections`, `#active-filters`, `#header-search`, `#detail-modal`, `#detail-content`, `#community-reviews-section`, `#similar-anime-section`, `#watchlist-section`, `#watchlist-grid`.
- `data-action`: `open-anime`, `toggle-filter`, `watch-status`, `watch-progress`, `load-more`.
- Image fallbacks: `data-fallback-src` on `img`.
- Breakpoints: primary `max-width: 960px` and `max-width: 640px`; legacy `768px` and `480px` rules exist.

## External Services & CSP
- Allowed remote sources: Google Fonts, Jikan API, YouTube / YouTube-nocookie.
- If you add new remote assets or APIs, update the CSP in `index.html` and `watchlist.html`.

## Data Pipeline (Short)
1. `tools/scraper/*` -> `tools/scraper/output/*.json`
2. `tools/merge-scores.js` -> `data/anime.json`
3. Metadata enrichers -> `data/anime.json`
4. `tools/build-catalogs.js` -> `data/anime.full.json` + `data/anime.preview.json` (+ optional report/state)
5. `tools/regenerate-data.ps1` -> `js/data.js`
6. `tools/validate-data.js` for schema checks
7. `tools/sync-home-index.ps1` syncs `home/index.html`

## Notes
- `js/charts.js` is optional and not wired by default; wire scripts and canvas IDs if used.

## Maintenance (Keep This Adaptive)
- Update this file when new modules, flows, schemas, or tools are added or removed.
- Keep the Codebase Map, Runtime Flows, DOM contracts, and pipeline steps accurate.
- Prefer concise bullets and current file paths over long prose.
