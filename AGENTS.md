# Rekonime Agent Guide

## Start Here
- Read this file end-to-end before starting any task.
- Always check the `skills/` folder at the start of a task.
- Always apply the Atom-of-Thought system prompt below at the start of a task.
- For UI or design work (layouts, styling, components, or visual changes), also apply `skills/FRONTEND-DESIGN.md` and `skills/FRONTEND-RESPONSIVE-UI.md`.
- Use Bun as the package manager; prefer `bun install` and `bun run <script>` for local dependency and script workflows.
- Optimize for Lighthouse web audit standards under Slow 4G throttling and a Brave browser user profile.
- Treat Performance, Accessibility, Best Practices, and SEO as non-negotiable quality gates.
- For dependency or lockfile changes, run `bun audit` and `bun --silent run check:security` locally before push; if a vulnerable version is installed, update `package.json` and the Bun lockfile together before finishing the task. If no Bun lockfile exists yet, create it with `bun install`.

## Atom-of-Thought System Prompt (Internal Only)
Use this system prompt for agents that need AoT reasoning:

```text
Apply Atom of Thoughts internally. Treat the current request as the only active reasoning state. Decompose it into small, self-contained, verifiable subquestions/tasks; keep them MECE when possible. Build a temporary DAG: each node is an atom, and each edge means the upstream atom must be resolved before the downstream atom. Cycles are invalid. Classify atoms with no incoming edges as independent and solve them first; parallelize only independent atoms when tools or context make that safe. After solving independent atoms, contract their verified results into the next self-contained state: preserve answer equivalence with the original task, keep only necessary conditions, and discard redundant history. Repeat decomposition and contraction until the remaining state is directly solvable or further splitting adds no value. Validate dependencies, assumptions, edge cases, and tool outputs before acting; if a decomposition looks weak, revise it before contraction. Execute in topological order with production-ready changes, minimal blast radius, and tests or checks scaled to risk. Final output must expose only the answer, edits, verification, and actionable caveats; never reveal atom labels, DAG structure, hidden reasoning, confidence scores, or private chain-of-thought.
```

## Lighthouse Performance Targets (Slow 4G + Brave)
- Use a production-style HTTPS URL as the canonical audit target: the published site or a production-equivalent preview/build, not raw `127.0.0.1` Live Server runs.
- Evaluate performance with a 3-run median before judging regressions or improvements.
- Optimize for First Contentful Paint, Largest Contentful Paint, Speed Index, Total Blocking Time, and Cumulative Layout Shift.
- Prioritize fast initial render, stable layout, and minimal main-thread blocking.
- Avoid layout shifts by reserving space for images, fonts, and dynamic content.
- Current standard to defend on the primary entry point `/`: Performance `>= 0.95`, Accessibility `1.00`, Best Practices `1.00`, SEO `1.00`, FCP `<= 1.50s`, LCP `<= 1.50s`, Speed Index `<= 1.65s`, TBT `<= 250ms`, CLS `<= 0.01`.

## Lighthouse Quality Gates
- Accessibility: semantic HTML, labels, contrast, focus states, and keyboard navigation.
- Best Practices: safe and modern APIs, CSP-aware changes, and error-free console output.
- SEO: correct meta, structured headings, descriptive titles, and crawlable content.

## Lighthouse Review Checklist
- Performance: FCP, LCP, Speed Index, TBT, CLS stay within target ranges on Slow 4G, measured as a 3-run median against a production-style HTTPS URL.
- Accessibility: labels, alt text, focus order, contrast, ARIA, and keyboard flows verified.
- Best Practices: HTTPS, no console errors, modern APIs, CSP-safe assets.
- SEO: title/meta description, headings, canonical, and crawlable links verified.

## Current Lighthouse Baseline (Slow 4G)
- Source: `plans/rekonime.vercel.app-20260415T195819.json`, `plans/rekonime.vercel.app-20260415T195900.json`, `plans/rekonime.vercel.app-20260415T195937.json` (Lighthouse 13.0.2, URL `https://rekonime.vercel.app/`).
- Scores (3-run median): Performance 0.98, Accessibility 1.00, Best Practices 1.00, SEO 1.00.
- Metrics (3-run median): FCP 1.49s, LCP 1.49s, Speed Index 1.63s, TBT 243.5ms, CLS 0.003.
- Interpretation: this production measurement is the current quality bar for future homepage changes.
- Note: raw local Live Server audits such as `127.0.0.1:5500` are useful for debugging, but they are not the canonical acceptance gate because they can introduce environment-specific instability that does not reflect the deployed app.
- Update this baseline when a new report is generated.

## User Journey (Condensed)
- Entry points: `/` (primary), legacy `/index.html` and `/home` redirect to `/`, `/watchlist` or `watchlist.html`, plus deep links via query params.
- First load: `App.init()` shows loading state, loads watchlist, fetches `data/anime.preview.json`, then swaps to `data/anime.full.json`.
- Discover: scroll, search, filters, Surprise Me, seasonal chips, trending, and presets.
- Evaluate: detail modal shows synopsis, trailer, reviews, and similar anime; URL updates with `?anime=...`.
- Decide: update watch status or return to browsing; recommendations personalize based on watchlist.
- Persistence: theme, onboarding, shortcuts acknowledgement, watchlist, and cached synopsis/reviews stored via `CacheManager`.
- Resilience: embedded `ANIME_DATA` fallback for `file://` or fetch failures; image fallbacks use `data-fallback-src`.
- PWA: service worker registers, offline indicator appears, and update prompts are shown when new versions exist.

## Codebase Map (Key Files)
- `index.html`, `watchlist.html`: entry points; include CSS and JS.
- `css/styles.css`, `css/themes.css`: global styles, theme system, accessibility, responsive rules.
- `js/main.js`: module entrypoint; bootstraps app services and `App.init()`.
- `js/app.js`: central controller for state, rendering, filters, search, modals, SEO, watchlist.
- `js/stats.js`: metrics and score profiles.
- `js/recommendations.js`: sorting, badges, similarity scoring.
- `js/reviews.js`: Jikan reviews + synopsis utilities.
- `js/discovery.js`: surprise, seasonal, trending, because-you-watched.
- `js/filterPresets.js`, `js/keyboardShortcuts.js`, `js/metricGlossary.js`, `js/onboarding.js`, `js/themeManager.js`.
- `js/airing-dashboard.js`: shared airing schedule fetch/cache, countdown formatting, and dashboard rendering for home + watchlist.
- `js/security/trailer-url-policy.js`: shared trailer URL allowlist/sanitization policy.
- `js/image-proxy.js`: shared image proxy URL/status utilities for app and watchlist entry points.
- `js/watchlist-state.js`: shared watchlist status/progress normalization helpers.
- `js/services/*`: API client, cache, rate limiter, schema validation, analytics, error handling, logging.
- `data/*.json`: catalog sources (`anime.json`, `anime.full.json`, `anime.preview.json`, `franchise-map.json`).
- `js/data.js`: embedded fallback dataset.
- `sw.js`, `version.json`, `health.html`: PWA + health surface.
- `tools/generate-franchise-map.js`, `tools/lib/franchise-builder.js`: AniList relation crawl + franchise/watch-order metadata builder.
- `tools/*`: build pipeline, validation, deployment utilities, security checks, and coverage/report guards.
- `test/*.test.js`: node:test coverage for stats, recs, build pipeline.

## Runtime Flows (Key)
- Initial load and swap: preview data first, then full catalog refresh.
- Filters and sorting: `App.activeFilters` + `Recommendations.getSortOptions()`.
- Search: `anime.searchText` matched by `App.handleHeaderSearch()`.
- Detail modal: `App.showAnimeDetail()` renders synopsis, franchise hub, trailer, reviews, syncs URL, and manages back/forward.
- Reviews and synopsis: Jikan API via `ReviewsService`; cached via `CacheManager` with TTL.
- Watchlist: stored under `rekonime.watchlist` (legacy `rekonime.bookmarks` migrated), rendered in `watchlist.html`.
- Airing dashboard: watchlist `planned` and `watching` entries query live schedule metadata, cache it locally, and render local-time next-episode countdowns on `/` and `/watchlist`.

## Data Schema (Essentials)
- Catalog payload: `{ generatedAt, scoreProfile, anime[] }`.
- Anime object: core identity + metadata, `genres[]`, `themes[]`, `synopsis`, `trailer`, `communityScore`, `searchText`, `episodes[]`, `stats`, `colorIndex`, optional `franchise`.
- Franchise object: `{ id, title, mode, entryAnimeId, entryTitle, totalCount, catalogCount, mainCount, items[] }`.
- Franchise item: `{ animeId, externalKey, title, year, format, bucket, relationType, isEntry, isInCatalog, anchorAnimeId, anchorTitle, mainOrder, order }`.
- Stats object: see `js/stats.js` for full fields; includes quality, retention, momentum, consistency, safety, and trend metrics (most scaled with a strictness curve).

## DOM & UI Contracts
- Key IDs: `#anime-grid`, `#recommendations-grid`, `#filter-modal`, `#filter-sections`, `#active-filters`, `#header-search`, `#detail-modal`, `#detail-content`, `#franchise-hub-section`, `#community-reviews-section`, `#similar-anime-section`, `#watchlist-section`, `#watchlist-grid`.
- `data-action`: `open-anime`, `toggle-filter`, `watch-status`, `watch-progress`, `load-more`.
- Image fallbacks: `data-fallback-src` on `img`.
- Breakpoints: primary `max-width: 960px` and `max-width: 640px`; legacy `768px` and `480px` rules exist.

## External Services & CSP
- Allowed remote sources: Google Fonts, Jikan API, AniList GraphQL, YouTube / YouTube-nocookie.
- If you add new remote assets or APIs, update the CSP in `index.html` and `watchlist.html`.

## Data Pipeline (Short)
1. `tools/scraper/*` -> `tools/scraper/output/*.json`
2. `tools/merge-scores.js` -> `data/anime.json`
3. Metadata enrichers -> `data/anime.json`
4. `tools/generate-franchise-map.js` -> `data/franchise-map.json`
5. `tools/build-catalogs.js` -> `data/anime.full.json` + `data/anime.preview.json` (+ optional report/state)
6. `tools/regenerate-data.ps1` -> `js/data.js`
7. `tools/validate-data.js` for schema checks
8. `tools/check-entrypoint-dedup.js` guards against duplicate home entry templates
9. `tools/check-repo-hygiene.js`, `tools/check-coverage-thresholds.js`, `tools/check-outdated-budget.js`, and `tools/check-unsafe-patterns.js` gate CI/local quality and security checks

## Notes
- `js/charts.js` is optional and not wired by default; wire scripts and canvas IDs if used.

## Maintenance (Keep This Adaptive)
- Update this file when new modules, flows, schemas, or tools are added or removed.
- Keep the Codebase Map, Runtime Flows, DOM contracts, and pipeline steps accurate.
- Prefer concise bullets and current file paths over long prose.
