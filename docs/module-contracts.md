# Module Contracts

## Runtime App Domains

### App Shell
- Stable TypeScript entry points: `js/main.ts`, `js/watchlist-main.ts`, `js/app.ts`, `js/serviceWorker.ts`
- Decision note: `docs/app-shell-migration-decision-2026-05-31.md`
- Current deepening rule: keep broad render-slice extraction last; first move product behavior behind deeper Detail Experience, Watchlist Entry presentation, and Catalog Payload effect modules so App Shell slices do not become shallow pass-through modules.
- Inputs: browser document state, catalog runtime services, watchlist lifecycle state, user input, service worker lifecycle
- Outputs: booted home app, watchlist page render, app orchestration commands, PWA registration/update prompt
- Side effects: DOM rendering, event listeners, history state, local storage/cache reads and writes, service worker registration

### Catalog Loading
- Runtime module: `js/services/catalog-loader.ts`
- Runtime TypeScript entrypoint: `js/services/catalog-loader.ts`
- Payload module: `js/services/catalog-payload.ts`
- Payload effect module: `js/services/catalog-payload-effects.ts`
- Payload TypeScript entrypoint: `js/services/catalog-payload.ts`
- Service TypeScript entrypoints: `js/services/catalog-cache.ts`, `js/services/api-client.ts`, `js/services/cache-manager.ts`, `js/services/error-handler.ts`, `js/services/logger.ts`
- Shared TypeScript contracts: `js/contracts/catalog-runtime.ts`
- App handoff: `js/app.ts` (`applyCatalogPayload`, render/filter/meta refresh)
- Inputs: catalog JSON payloads (full index, detail chunks, embedded fallback)
- Outputs: normalized `App.animeData`, filter options, score profile
- Interface: load the full catalog index, fetch catalog payloads, read/write full catalog cache, use embedded fallback, and merge detail chunks
- Side effects: catalog network/cache events (`rekonime:data-load-*`, `emitCatalogEvent`); `js/services/catalog-payload.ts` owns normalization, score-profile validation, validation handoff, and render-ready catalog state; `js/services/catalog-payload-effects.ts` owns applying that state to App Shell caches, document flags, Snapshot refresh, Airing Schedule intent, and filter render intent
- Contract surface: `CatalogPayload`, `PreviewCatalogPayload`, `FullCatalogPayload`, `DetailChunkPayload`, `ScoreProfile`, `CatalogValidationIssue`, and `CatalogRuntimeEventMap`

### Watchlist State
- Entry points: `js/app.ts`, `js/watchlist-main.ts`
- Lifecycle module: `js/watchlist-state.js`
- Presentation module: `js/watchlist-entry-presentation.ts`
- Shared TypeScript contracts: `js/contracts/watchlist-lifecycle.ts`
- Storage key: `rekonime.watchlist`
- Interface: load entries, migrate legacy bookmarks, update status/progress, refresh snapshots, expose filtered entries/items, and build transition envelopes for adapters
- Side effects: storage writes only; callers apply the returned event, render, and dashboard scheduling intent; Watchlist Entry presentation owns shared control labels, progress visibility, total text, and detail/watchlist page adapters
- Contract surface: `WatchlistEntry`, `Snapshot`, `WatchlistPersistedPayload`, `WatchlistTransitionResult`, `WatchlistControlModel`, `WatchlistDisplayModel`, and `WatchlistLifecycleEventMap`

### Detail Experience
- Stable TypeScript entry point: `js/detail-experience.ts`
- Port adapter: `js/detail-experience-port.ts`
- App handoff: `js/app.ts` (`showAnimeDetail`, detail markup builders, image helpers, trailer control methods)
- Inputs: anime id, cached detail, review payload, detail URL state (`?anime=...`)
- Outputs: modal visibility, refreshed synopsis/reviews, cached detail HTML, detail URL synchronization
- Side effects: history state, metadata updates, trailer cleanup/replacement, full-catalog deep-link fallback, modal-open telemetry
- Interface rule: Detail Experience receives a narrow port adapter rather than the full App Shell object; tests should exercise the port seam instead of rebuilding unrelated App Shell state.

### Airing Schedule
- Stable TypeScript entry points: `js/airing-schedule.ts`, `js/airing-dashboard.ts`
- Inputs: planned/watching watchlist entries, catalog or snapshot anime items, AniList schedule responses, local clock
- Outputs: dashboard model with next episode, readiness, countdown, local time labels, and summary counts
- Interface: fetch/cache schedule metadata, build dashboard models, and run countdown refresh ticks
- Side effects: AniList GraphQL calls, local schedule cache writes, and renderer callbacks

### Shared URL Policies
- Stable TypeScript entry points: `js/security/trailer-url-policy.ts`, `js/urlSanitizer.ts`
- Inputs: trailer URL candidates and embed URL candidates
- Outputs: sanitized URL strings (`''` when invalid)
- Side effects: none (pure sanitization helpers)

### Shared Image Proxy
- Entry point: `js/image-proxy.js`
- Inputs: image URLs, storage keys, status TTL/probe config
- Outputs: proxy URL, status state, availability checks
- Side effects: localStorage reads/writes for proxy health status

### Runtime Calculations
- Stable TypeScript entry points: `js/stats.ts`, `js/recommendations.ts`, `js/filterPresets.ts`
- Shared TypeScript contracts: `js/contracts/calculations.ts`
- Inputs: episode score lists, Catalog Payload anime records, score profiles, active recommendation mode, and filter preset keys
- Outputs: calculated stats, ranking/recommendation models, card stat models, badges, similar-title matches, and filter preset view models
- Side effects: recommendations mode preference may use `CacheManager`; scoring and filter predicates are pure

### Runtime Capabilities
- Stable TypeScript entry point: `js/runtime-capabilities.ts`
- App handoff: `js/app.ts` (product-specific close handlers)
- Inputs: idle callbacks, modal ids, focus targets, Escape key events
- Outputs: idle task handles, modal open state, focus trap state, scroll lock state
- Side effects: modal attributes/classes, focus movement, body scroll lock, scheduled callbacks

### Keyboard Shortcuts
- Stable TypeScript entry point: `js/keyboardShortcuts.ts`
- Inputs: browser keyboard events, active route/modal state, app command handlers
- Outputs: command dispatch, shortcut help markup, shortcut acknowledgement state
- Side effects: focus movement, navigation, local preference cache, and modal/help rendering

### Reviews
- Entry point: `js/reviews.js`
- Inputs: MAL id and title
- Outputs: sanitized synopsis/review markup
- Side effects: network calls to Jikan, circuit breaker state

## Pipeline Domains

### Catalog Build
- Stable Bun entry point: `bun run data:build`
- JavaScript compatibility entry point: `tools/build-catalogs.js`
- Python migration adapter: `tools/build_catalogs.py`, `tools/run-build-catalogs.js`
- Python migration boundary: `tools/build_catalogs.py` owns normalization, score-profile derivation, build stats, preview selection, and quality-report handoff for the Python path; TypeScript `Stats` remains the browser/runtime scoring contract.
- Inputs: `data/anime.json`
- Outputs: `data/anime.full.json`, `data/anime.preview.json`
- Gates: schema validation, integrity checks, quality gates

### Pipeline Parity Contract
- Contract module: `tools/pipeline_parity_contract.py`
- Harness: `tools/python_golden_harness.py`
- Inputs: representative catalog input, validation payload, trailer policy vectors, fixture manifest
- Outputs: golden fixture actuals for Python data pipeline adapters
- Interface: adapters must satisfy the contract fixture set; Bun command surfaces stay stable while Python and JavaScript fallback behavior is compared through the contract

### Data Validation
- Stable Bun entry points: `bun run data:validate`, `bun run data:validate:strict`
- JavaScript compatibility entry point: `tools/validate-data.js`
- Python parity entry points: `tools/validate_data.py`, `tools/quality_reporter.py`, `tools/python_golden_harness.py`, `tools/run-validate-data.js`
- Inputs: generated catalog + embedded payload
- Outputs: error/warning report and process status

### Data Operations
- Stable Bun commands: `bun run data:regenerate`, `bun run data:backup`, `bun run data:rollback`, `bun run test:scraper`
- Python entry points: `tools/regenerate_data.py`, `tools/deploy_data.py`, existing `tools/scraper/*.py`
- JavaScript fallback launchers: `tools/run-regenerate-data.js`, `tools/run-deploy-data.js`, `tools/run-scraper-tests.js`
- Inputs: preview catalog, source/full/preview data files, backup ids, scraper fixtures
- Outputs: embedded `js/data.js`, data backups, restored data files, scraper test status
- Safety gates: embedded payload shape validation, backup id allowlist, backup directory containment, scraper host-policy tests

## Security-Sensitive Files
- `vercel.json`
- `sw.js`
- `js/urlSanitizer.ts`
- `tools/validate-data.js`
- `tools/validate_data.py`
- `tools/lib/schema-validator.js`
