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
- Payload TypeScript entrypoint: `js/services/catalog-payload.ts`
- Service TypeScript entrypoints: `js/services/catalog-cache.ts`, `js/services/cache-manager.ts`, `js/services/logger.ts`
- Shared TypeScript contracts: `js/contracts/catalog-runtime.ts`
- App handoff: `js/app.ts` (`applyCatalogPayload`, render/filter/meta refresh)
- Inputs: catalog JSON payloads (full index, detail chunks, embedded fallback)
- Outputs: normalized `App.animeData`, filter options, score profile
- Interface: load the full catalog index, fetch catalog payloads, read/write full catalog cache, use embedded fallback, and merge detail chunks
- Side effects: catalog network/cache events (`rekonime:data-load-*`, `emitCatalogEvent`); `js/services/catalog-payload.ts` owns normalization, score-profile validation, validation handoff, render-ready catalog state, and downstream refresh intent; the App Shell applies document, cache, Snapshot, Airing Schedule, and filter effects from that intent
- Contract surface: `CatalogPayload`, `PreviewCatalogPayload`, `FullCatalogPayload`, `DetailChunkPayload`, `ScoreProfile`, `CatalogValidationIssue`, and `CatalogRuntimeEventMap`

### Browse View Filtering
- Runtime module: `js/browse-filtering.ts`
- Inputs: Catalog Payload anime records, URL filter parameters, search text, selected facets, and available facet options
- Outputs: filtered anime list, normalized active filters, available facet options, active-filter summary items, and filter metadata inputs
- Interface: parse and write browse filter URL state, canonicalize selected facet values, extract available facet options, prepare and score catalog search matches, apply selected facets and search text, and build active-filter and metadata summaries
- Side effects: none; App Shell owns DOM rendering, history mutation, and metadata application after consuming Browse View Filtering output

### Taste Profile
- Runtime module: `js/taste-profile.ts`
- Inputs: recommendation feedback, Watchlist Lifecycle entries, Catalog Payload anime records, and excluded Watchlist Entry ids
- Outputs: persisted cross-title preferences, Watchlist-derived evidence, ranked recommendation source, weighted Discovery source, feedback result, and settings summary
- Interface: apply recommendation feedback, refresh inferred evidence, prepare recommendation and Discovery candidates, reset while preserving Watchlist Lifecycle evidence, and import/export personal profile data
- Side effects: Taste Profile storage writes only; App Shell owns DOM rendering, announcements, file download/upload, and Watchlist Lifecycle transitions such as Already seen

### Discovery
- Runtime module: `js/discovery.js`
- Inputs: Taste Profile-prepared weighted candidates, quality requirements, Catalog Payload anime records, and current date
- Outputs: Surprise Me selection, seasonal filter choices, trending titles, and weekly popularity
- Interface: apply quality gates and weighted random selection to prepared candidates; calculate seasonal, trending, and weekly catalog exploration models
- Side effects: Discovery analytics only; Taste Profile owns preference and Watchlist Lifecycle evidence interpretation

### Viewing Intent
- Runtime module: `js/viewing-intent.ts`
- Inputs: Viewing Intent key, session activity time, and optional completion announcement
- Outputs: active Viewing Intent definition and apply/clear transition effects
- Interface: list definitions, read the active Viewing Intent, apply a Viewing Intent, and clear it after discovery completes
- Side effects: Viewing Intent session storage writes only; App Shell executes returned option, recommendation-mode, recommendation, and announcement effects

### Watchlist State
- Entry points: `js/app.ts`, `js/watchlist-main.ts`
- Airing dashboard adapter: `js/watchlist-airing-dashboard-adapter.ts`
- Lifecycle module: `js/watchlist-state.js`
- Lifecycle runtime module: `js/watchlist-lifecycle-runtime.ts`
- Page interactions module: `js/watchlist-page-interactions.ts`
- Page renderer module: `js/watchlist-page-renderer.ts`
- Page runtime module: `js/watchlist-page-runtime.ts`
- Presentation module: `js/watchlist-entry-presentation.ts`
- Shared TypeScript contracts: `js/contracts/watchlist-lifecycle.ts`
- Storage key: `rekonime.watchlist`
- Interface: load entries, migrate legacy bookmarks, update status/progress, refresh snapshots, expose filtered entries/items, and build transition envelopes for adapters
- Side effects: storage writes only; Watchlist Lifecycle Runtime owns shared home/watchlist mutation, ordinary transition snapshot resolution, transition envelopes, Taste Profile intent, recommendation render intent, and Airing Schedule dashboard intent; the pure MAL import planner builds detached creation Snapshots from the full Catalog Payload before the Runtime commits the batch; callers apply the returned event, render, and dashboard scheduling intent; Watchlist Airing Dashboard Adapter owns shared home/watchlist lazy dashboard loading, controller caching, idle scheduling, cancellation, scheduled data-source resolution, controller options, and update failure logging; Watchlist Page Renderer owns filter-chip markup, card DOM assembly, empty-state class updates, snapshot backfill, and dashboard render scheduling; Watchlist Page Interactions owns page-level DOM event listeners, filter changes, card opening, image fallback, settings, and sync events; Watchlist Page Runtime translates page DOM actions into Watchlist Lifecycle Runtime commands and applies returned render intent; Watchlist Entry presentation owns shared control labels, progress visibility, total text, and detail/watchlist page adapters
- Contract surface: `WatchlistEntry`, `Snapshot`, `WatchlistPersistedPayload`, `WatchlistTransitionResult`, `WatchlistControlModel`, `WatchlistDisplayModel`, and `WatchlistLifecycleEventMap`

### Detail Experience
- Stable TypeScript entry point: `js/detail-experience.ts`
- Error state module: `js/detail-error-state.ts`
- Media module: `js/detail-media.ts`
- Reviews adapter: `js/detail-reviews.ts`
- Presentation module: `js/detail-presentation.ts`
- App handoff: `js/app.ts` (`showAnimeDetail`, detail markup builders, image helpers, trailer settings policy)
- Inputs: anime id, cached detail, review payload, trailer metadata and settings policy, detail URL state (`?anime=...`)
- Outputs: modal visibility, refreshed synopsis/reviews, trailer presentation and playback state, cached detail HTML, detail URL synchronization
- Side effects: history state, metadata updates, trailer rendering/playback/cleanup, full-catalog deep-link fallback, modal-open telemetry
- Interface rule: `js/detail-experience.ts` privately wires the single App Shell integration and exports only the Detail Experience factory; `js/detail-presentation.ts` owns modal body and loading markup, `js/detail-media.ts` owns trailer URL policy use, rendering, player messaging, autoplay, replacement, and cleanup, `js/detail-reviews.ts` owns review loading, and `js/detail-error-state.ts` owns unavailable-title messaging. The App Shell supplies trailer settings policy and invokes only experience-level commands.

### Airing Schedule
- Stable TypeScript entry points: `js/airing-schedule.ts`, `js/airing-dashboard.ts`
- Shared dashboard adapter: `js/watchlist-airing-dashboard-adapter.ts` is consumed by both the home App Shell and the watchlist page.
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
- Runtime module: `js/image-proxy-runtime.js`
- Inputs: image URL, display intent, dimensions, loading priority, placeholder, storage key, and status TTL/probe config
- Outputs: complete image-delivery decision, proxy status, availability checks, and fallback transition
- Interface: resolve primary URL, fallback chain, dimensions, loading hints, and proxy use through one decision; apply image failures through the same module
- Side effects: localStorage reads/writes for proxy health status

### Runtime Calculations
- Stable TypeScript entry points: `js/stats.ts`, `js/recommendations.ts`, `js/filterPresets.ts`
- Shared TypeScript contracts: `js/contracts/calculations.ts`
- Inputs: episode score lists, Catalog Payload anime records, score profiles, active recommendation mode, and filter preset keys
- Outputs: calculated stats, ranking/recommendation models, card stat models, badges, similar-title matches, and filter preset view models
- Side effects: recommendations mode preference may use `CacheManager`; scoring and filter predicates are pure

### Runtime Capabilities
- Stable TypeScript entry point: `js/runtime-capabilities.ts`
- App handoff: `js/app.ts` keeps one Runtime Capabilities instance and provides product-specific close handlers
- Inputs: idle callbacks, native dialog ids, focus targets, Escape key events
- Outputs: idle task handles, modal open state, scroll lock state
- Interface: schedules and cancels ordinary idle work and opens/closes native `<dialog>` elements; deferred boot, Shared Image Proxy, App Shell, and Airing Schedule adapters consume the same scheduling functions; the browser owns focus trapping
- Side effects: dialog attributes/classes, initial focus, body scroll lock, scheduled callbacks

### Onboarding Journey
- Runtime module: `js/onboarding.js`
- First-paint adapter: `public/js/onboarding-gate.js`
- Static shell: `index.html`
- Inputs: persisted onboarding status, Viewing Intent choice, skip, and Escape
- Outputs: selected Viewing Intent event and completed/skipped status
- Interface: check completion, start or reopen the single welcome journey, and close it through completion or skip
- Side effects: onboarding storage writes, shell visibility, analytics, and `rekonime:onboarding-intent` dispatch; the gate and runtime are the two adapters at the same static-shell seam

### Keyboard Shortcuts
- Stable TypeScript entry point: `js/keyboardShortcuts.ts`
- Inputs: browser keyboard events, active detail state, explicit product commands, and ordered anime ids
- Outputs: command dispatch, shortcut help markup, shortcut acknowledgement state
- Interface: configure explicit commands and a read-only navigation-state provider; Keyboard Shortcuts never receives the mutable App Shell
- Side effects: focus movement, navigation, local preference cache, and modal/help rendering

### Reviews
- Entry point: `js/reviews.js`
- Inputs: MAL id and title
- Outputs: sanitized synopsis/review markup
- Side effects: network calls to Jikan, circuit breaker state

## Pipeline Domains

### Catalog Build
- Stable Bun entry point: `bun run data:build`
- Python implementation: `tools/build_catalogs.py`
- Cross-platform launcher: `tools/run-python.js`
- `tools/build_catalogs.py` owns normalization, score-profile derivation, build stats, preview selection, and quality-report handoff; TypeScript `Stats` remains the browser/runtime scoring contract.
- Inputs: `data/anime.json`
- Outputs: `data/anime.full.json`, `data/anime.preview.json`
- Gates: schema validation, integrity checks, quality gates

### Pipeline Golden Fixtures
- Harness: `tools/python_golden_harness.py`
- Inputs: representative catalog input, validation payload, fixture manifest
- Outputs: regression fixtures for the Python data pipeline

### Data Validation
- Stable Bun entry points: `bun run data:validate`, `bun run data:validate:strict`
- Python entry points: `tools/validate_data.py`, `tools/quality_reporter.py`, `tools/python_golden_harness.py`
- Inputs: generated catalog + embedded payload
- Outputs: error/warning report and process status

### Data Operations
- Stable Bun commands: `bun run data:regenerate`, `bun run data:backup`, `bun run data:rollback`, `bun run test:scraper`
- Python entry points: `tools/regenerate_data.py`, `tools/deploy_data.py`, existing `tools/scraper/*.py`
- Launchers: `tools/run-python.js`; scraper tests retain `tools/run-scraper-tests.js`
- Inputs: preview catalog, source/full/preview data files, backup ids, scraper fixtures
- Outputs: embedded `js/data.js`, data backups, restored data files, scraper test status
- Safety gates: embedded payload shape validation, backup id allowlist, backup directory containment, scraper host-policy tests

## Security-Sensitive Files
- `vercel.json`
- `sw.js`
- `js/urlSanitizer.ts`
- `tools/validate_data.py`
