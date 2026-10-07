# Module Contracts

## Runtime App Domains

### App Shell
- Stable TypeScript entry points: `src/app/main.ts`, `src/app/watchlist-main.ts`, `src/app/app.ts`, `src/shared/runtime/serviceWorker.ts`
- Decision note: `docs/app-shell-migration-decision-2026-05-31.md`
- Current deepening rule: keep broad render-slice extraction last; first move product behavior behind deeper Detail Experience, Watchlist Entry presentation, and Catalog Payload effect modules so App Shell slices do not become shallow pass-through modules.
- Inputs: browser document state, catalog runtime services, watchlist lifecycle state, user input, service worker lifecycle
- Outputs: booted home app, watchlist page render, app orchestration commands, PWA registration/update prompt
- Side effects: DOM rendering, event listeners, history state, local storage/cache reads and writes, service worker registration

### Catalog Loading
- Runtime module: `src/features/catalog/catalog-loader.ts`
- Runtime TypeScript entrypoint: `src/features/catalog/catalog-loader.ts`
- Payload module: `src/features/catalog/catalog-payload.ts`
- Payload TypeScript entrypoint: `src/features/catalog/catalog-payload.ts`
- Service TypeScript entrypoints: `src/features/catalog/catalog-cache.ts`, `src/shared/services/cache-manager.ts`, `src/shared/services/logger.ts`
- App handoff: `src/app/app.ts` (`applyCatalogPayload`, render/filter/meta refresh); App and Detail Experience call Catalog Runtime directly rather than mirroring its commands
- Inputs: catalog JSON payloads (full index, detail chunks, embedded fallback)
- Outputs: normalized `App.animeData`, filter options, score profile
- Runtime index omits `searchText` and `detailPath`; normalization builds search variants from all title fields, and Catalog Runtime derives detail URLs from the encoded anime ID. Build checks verify each derived chunk exists and enforce raw and gzip index budgets.
- Interface: load the initial/full catalog, track scheduled and active loads, and enrich a requested anime through detail chunks; Catalog Runtime owns detail readiness, request deduplication, requested-title acceptance, Catalog Payload normalization, merging into the current catalog, and accepted-detail bookkeeping. Network fetching and full-catalog cache access stay private to the runtime.
- Detail enrichment effects: one App adapter callback invalidates detail and grid caches and refreshes Watchlist Snapshots after acceptance. Rejected chunks remain retryable; accepted empty-episode chunks are remembered. Detail Experience refreshes only when enrichment returns a different record for the still-open title.
- Side effects: catalog network/cache events (`rekonime:data-load-*`, `emitCatalogEvent`); `src/features/catalog/catalog-payload.ts` owns payload acceptance, normalization, score-profile validation, validation handoff, render-ready catalog state, and downstream refresh intent; the App Shell applies document, cache, Snapshot, Airing Schedule, and filter effects from that intent

### Browse View Filtering
- Runtime module: `src/features/discovery/browse-filtering.ts`
- Inputs: Catalog Payload anime records, URL filter parameters, search text, selected facets, and available facet options
- Outputs: filtered anime list, normalized active filters, available facet options, active-filter summary items, and filter metadata inputs
- Interface: parse and write browse filter URL state, canonicalize selected facet values, extract available facet options, prepare and score catalog search matches, apply selected facets and search text, and build active-filter and metadata summaries
- Side effects: none; App Shell owns DOM rendering, history mutation, and metadata application after consuming Browse View Filtering output

### Taste Profile
- Runtime module: `src/features/preferences/taste-profile.ts`
- Inputs: recommendation feedback, Watchlist Lifecycle entries, Catalog Payload anime records, and excluded Watchlist Entry ids
- Outputs: persisted cross-title preferences, Watchlist-derived evidence, ranked recommendation source, weighted Discovery source, feedback result, and settings summary
- Interface: apply recommendation feedback, refresh inferred evidence, prepare recommendation and Discovery candidates, reset while preserving Watchlist Lifecycle evidence, commit a validated profile, and export personal data
- Side effects: Taste Profile storage writes only; App Shell owns DOM rendering, announcements, file download/upload, and Watchlist Lifecycle transitions such as Already seen

### Personal Data Restore
- Runtime module: `src/features/preferences/personal-data-restore.ts`
- Inputs: version 1 full exports or legacy profile-only data, current Taste Profile, and current Watchlist Lifecycle entries
- Outputs: one restore outcome with the applied mode and restored Watchlist Entry count, or a validation/storage failure reason
- Interface: restore compatible personal data; a full restore commits Taste Profile and Watchlist Lifecycle together or rolls back, while a profile-only restore leaves Watchlist Lifecycle unchanged
- Side effects: delegates storage writes to Taste Profile and Watchlist Lifecycle and keeps a short-lived recovery journal across the two writes; App Shell owns file reading, rendering, and user feedback
- Contract rules: reject unsupported versions, invalid Watchlist Entries, and duplicate Watchlist Entry ids before writing; recompute inferred Taste Profile evidence from the restored or retained Watchlist Lifecycle

### Discovery
- Runtime module: `src/features/discovery/discovery.js`
- Inputs: Taste Profile-prepared weighted candidates, quality requirements, Catalog Payload anime records, and current date
- Outputs: Surprise Me selection, seasonal filter choices, trending titles, and weekly popularity
- Interface: apply quality gates and weighted random selection to prepared candidates; calculate seasonal, trending, and weekly catalog exploration models
- Side effects: Discovery analytics only; Taste Profile owns preference and Watchlist Lifecycle evidence interpretation

### Viewing Intent
- Runtime module: `src/features/discovery/viewing-intent.ts`
- Inputs: Viewing Intent key, session activity time, a title to dismiss or restore, and optional completion announcement
- Outputs: active Viewing Intent definition, Session Dismissals, dismissal/restore outcomes, and apply/clear transition effects
- Interface: list definitions, read/apply/clear the active Viewing Intent, dismiss/restore titles, read Session Dismissals, and record activity. Session Dismissals work without an active Viewing Intent and survive intent changes and clearing.
- Session expiry: all reads reject expired state first. `getActive()` retains activity renewal by default; App Shell rendering uses `getActive({ recordActivity: false })` and actual delegated user actions call `recordActivity()`. Reading dismissals never renews activity. Applying a goal, dismissing, or restoring renews the same four-hour sliding window.
- Browser lifetime: session storage preserves same-tab reloads. A genuinely fresh tab without an opener begins with no Session Dismissals. A duplicated tab, an opener-created tab, or browser session recovery can preserve/copy session storage; there is no promise of deletion when a tab closes. Dismissals never enter personal-data exports.
- Side effects: Viewing Intent session storage writes only; App Shell executes returned option, recommendation-mode, recommendation, and announcement effects

### Watchlist State
- Entry points: `src/app/app.ts`, `src/app/watchlist-main.ts`
- Airing dashboard adapter: `src/features/watchlist/watchlist-airing-dashboard-adapter.ts`
- Lifecycle module: `src/features/watchlist/watchlist-state.js`
- Lifecycle runtime module: `src/features/watchlist/watchlist-lifecycle-runtime.ts`
- Page interactions module: `src/features/watchlist/watchlist-page-interactions.ts`
- Page renderer module: `src/features/watchlist/watchlist-page-renderer.ts`
- Page runtime module: `src/features/watchlist/watchlist-page-runtime.ts`
- Presentation module: `src/features/watchlist/watchlist-entry-presentation.ts`
- Shared TypeScript contracts: `src/features/watchlist/contracts/watchlist-lifecycle.ts`
- Storage key: `rekonime.watchlist`
- Interface: load entries, migrate legacy bookmarks, update status/progress, refresh snapshots, expose filtered entries/items, and build transition envelopes for adapters
- Side effects: storage writes only; Watchlist Lifecycle Runtime owns shared home/watchlist mutation, ordinary transition snapshot resolution, transition envelopes, Taste Profile intent, recommendation render intent, and Airing Schedule dashboard intent; the pure MAL import planner builds detached creation Snapshots from the full Catalog Payload before the Runtime commits the batch; callers apply the returned event, render, and dashboard scheduling intent; Watchlist Airing Dashboard Adapter owns shared home/watchlist lazy dashboard loading, controller caching, idle scheduling, cancellation, scheduled data-source resolution, controller options, and update failure logging; Watchlist Page Renderer owns filter-chip markup, card DOM assembly, empty-state class updates, snapshot backfill, and dashboard render scheduling; Watchlist Page Interactions owns page-level DOM event listeners, filter changes, card opening, image fallback, settings, and sync events; Watchlist Page Runtime translates page DOM actions into Watchlist Lifecycle Runtime commands and applies returned render intent; Watchlist Entry presentation owns shared control labels, progress visibility, total text, and detail/watchlist page adapters
- Contract surface: `WatchlistEntry`, `Snapshot`, `WatchlistPersistedPayload`, `WatchlistTransitionResult`, `WatchlistControlModel`, `WatchlistDisplayModel`, and `WatchlistLifecycleEventMap`
- Discovery selection: `selectForLater` persists Planned and returns an opaque, runtime-local Undo receipt only after success. `undoSelection` reloads current entries, rejects conflicting changes to the selected entry, and commits only that entry's reversal. Unrelated entries and refreshed catalog Snapshots survive Undo; failed persistence keeps the receipt retryable. App Shell retains the latest selected title as an inline confirmation for the current decision context, outside the ranked recommendation pool.

### Watchlist Import
- Workflow module: `src/features/watchlist/watchlist-import-workflow.ts`
- Presentation adapter: `src/features/watchlist/mal-import-presentation.ts`, with DOM and effect execution in `src/app/app.ts`; both pages use this same App Shell flow.
- Interface: `getView`, `review`, `choose`, `cancel`, `apply`, and state-directed `retry`. The workflow owns the selected file, lazy parser loading, pending request identity, detached review entries, conflict choices, applicable plan, and pre/post-commit recovery.
- Presentation receives detached counts, conflicts, issues, and retry availability, never the file handle, parsed rows, or applicable plan. Semantic update intents request focus and announcements; App Shell maps them to DOM actions.
- The parser/planner stays lazy-loaded and pure. Watchlist Lifecycle Runtime retains exact batch validation, stale-plan detection, and atomic persistence. Post-commit retry only refreshes Taste Profile and recommendations; it never reapplies a saved batch.
- Tests cross the workflow interface with fresh sessions and controlled adapters. App integration and browser checks retain the shared page wiring, effect ordering, confirmation, focus, and announcement coverage.

### Detail Experience
- Stable TypeScript entry point: `src/features/detail/detail-experience.ts`
- The session owner is available before the first detail request; presentation and media implementations download only when opened. It owns loading/error markup, cancellation, and retry with the original deep-link options. `src/features/discovery/decision-signal.ts` owns the score summary shared by browse cards and detail presentation.
- Media module: `src/features/detail/detail-media.ts`
- Private Reviews implementation: `src/features/detail/reviews.js`, lazy-loaded by Detail Experience with Jikan and AniList as external adapters
- Presentation module: `src/features/detail/detail-presentation.ts`
- App handoff: `src/app/app.ts` (`showAnimeDetail`, detail markup builders, image helpers, trailer settings policy)
- Interface: `open`, `close`, `retry`, `syncWithUrl`, `getCurrentAnimeId`, `invalidate`, `refreshCommunityReviews`, `refreshTrailerSection`, and `toggleTrailerPlayback`. App Shell reads the active title through a getter; it owns no mutable detail identity, request counter, loading promise, or markup cache.
- Inputs: anime id, review provider results, trailer metadata and settings policy, detail URL state (`?anime=...`)
- Outputs: modal visibility, one visible review refresh outcome, refreshed synopsis/reviews, trailer presentation and playback state, cached detail HTML, detail URL synchronization
- Side effects: history state, metadata updates, review provider/cache access and rendering, trailer rendering/playback/cleanup, full-catalog deep-link fallback, modal-open telemetry
- Ownership: each opening has a private session identity, including repeated openings of the same title. Lazy loading, full-catalog lookup, detail enrichment, and review success/failure check that identity before visible effects. Review retries also carry a request identity, so only the latest retry can render. Enrichment renders directly without recursively opening another session or requesting another chunk. Closing invalidates pending work and cleans up media.
- Cache contract: Detail Experience owns bounded LRU markup storage; catalog replacement calls `invalidate()` and chunk enrichment calls `invalidate(animeId)`. Cached openings still refresh watchlist controls, media, metadata, and reviews. Tests observe cache reuse and eviction through opens rather than manipulating the cache.
- Implementation: `src/features/detail/detail-presentation.ts` owns modal body and skeleton markup; `src/features/detail/detail-media.ts` owns trailer URL policy, rendering, playback, and cleanup. Reviews remain private and lazy, with injected adapters for loading races and provider outcomes. App Shell invokes experience-level commands and supplies browser effects.

### Airing Schedule
- Stable TypeScript entry points: `src/features/airing/airing-schedule.ts`, `src/features/airing/airing-dashboard.ts`
- Shared dashboard adapter: `src/features/watchlist/watchlist-airing-dashboard-adapter.ts` is consumed by both the home App Shell and the watchlist page.
- Inputs: planned/watching watchlist entries, catalog or snapshot anime items, AniList schedule responses, local clock
- Outputs: dashboard model with next episode, readiness, countdown, local time labels, and summary counts
- Interface: fetch/cache schedule metadata, build dashboard models, and run countdown refresh ticks
- Side effects: AniList GraphQL calls, local schedule cache writes, and renderer callbacks

### Shared URL Policies
- Stable TypeScript entry points: `src/shared/security/trailer-url-policy.ts`, `src/shared/security/urlSanitizer.ts`
- Inputs: trailer URL candidates and embed URL candidates
- Outputs: sanitized URL strings (`''` when invalid)
- Side effects: none (pure sanitization helpers)

### Shared Image Proxy
- Entry point: `src/shared/runtime/image-proxy.js`
- Runtime module: `src/shared/runtime/image-proxy-runtime.js`
- Inputs: image URL, display intent, dimensions, loading priority, placeholder, storage key, and status TTL/probe config
- Outputs: complete image-delivery decision, proxy status, availability checks, and fallback transition
- Interface: resolve primary URL, fallback chain, dimensions, loading hints, and proxy use through one decision; apply image failures through the same module
- Side effects: localStorage reads/writes for proxy health status
- Fresh visits use original covers until the proxy health check succeeds. Failed proxies retry the original cover; unavailable covers end at the embedded `image-placeholder.js` image without another network request. Fallback transitions clear responsive image candidates and stop at the embedded image.

### Runtime Calculations
- Stable TypeScript entry points: `src/features/discovery/stats.ts`, `src/features/discovery/recommendations.ts`, `src/features/discovery/filterPresets.ts`
- Inputs: episode score lists, Catalog Payload anime records, score profiles, Taste Profile-prepared recommendation candidates, active Viewing Intent and recommendation mode facts, and filter preset keys
- Outputs: calculated stats, one render-ready recommendation decision with context, reasons, and Experience Cues, card stat models, badges, similar-title matches, and filter preset view models
- Interface: calculate statistics and display models; turn prepared candidates plus current intent/mode facts into one complete recommendation decision
- Discovery shortlist: defaults to three total picks, with an explicit larger limit for more choices. The decision identifies supported goal suggestions, general alternatives, no close matches, and whether more picks exist. Goal membership uses genre/theme rules independently of ranking; eligible suggestions precede alternatives, with one title per franchise. Episode summaries distinguish listed totals from observed episodes using retained rating evidence.
- Side effects: recommendations mode preference may use `CacheManager`; scoring and filter predicates are pure

### Runtime Capabilities
- Stable TypeScript entry point: `src/shared/runtime/runtime-capabilities.ts`
- App handoff: `src/app/app.ts` keeps one Runtime Capabilities instance and provides product-specific close handlers
- Inputs: idle callbacks, native dialog ids, focus targets, Escape key events
- Outputs: idle task handles, modal open state, scroll lock state
- Interface: schedules and cancels ordinary idle work and opens/closes native `<dialog>` elements; deferred boot, Shared Image Proxy, App Shell, and Airing Schedule adapters consume the same scheduling functions; the browser owns focus trapping
- Side effects: dialog attributes/classes, initial focus, body scroll lock, scheduled callbacks

### Onboarding Journey
- Runtime module: `src/features/onboarding/onboarding.js`
- First-paint adapter: `public/js/onboarding-gate.js`
- Static shell: `index.html`
- Inputs: persisted onboarding status, Viewing Intent choice, skip, and Escape
- Outputs: selected Viewing Intent event and completed/skipped status
- Interface: check completion, start or reopen the single welcome journey, and close it through completion or skip
- Side effects: onboarding storage writes, shell visibility, analytics, and `rekonime:onboarding-intent` dispatch; the gate and runtime are the two adapters at the same static-shell seam

### Keyboard Shortcuts
- Stable TypeScript entry point: `src/shared/ui/keyboardShortcuts.ts`
- Inputs: browser keyboard events, active detail state, explicit product commands, and ordered anime ids
- Outputs: command dispatch, shortcut help markup, shortcut acknowledgement state
- Interface: configure explicit commands and a read-only navigation-state provider; Keyboard Shortcuts never receives the mutable App Shell
- Side effects: focus movement, navigation, local preference cache, and modal/help rendering

### Reviews
- Entry point: `src/features/detail/reviews.js`
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
- Score Refresh run module: `tools/lib/score-refresh-run.js`. `createScoreRefreshRun({ root, options, request?, save, onEvent? })` returns `run()` and `stop()`. It owns selection, pagination, independent score/episode results, catalog mutations, checkpoints, and the first unsuccessful/unfinished filtered resume index.
- Run contract: `run()` starts once and returns a `completed`, `stopped`, or `interrupted` outcome with stats, failed MAL IDs, and a resume index. `completed` means the selection was exhausted; individual fetch errors remain in the outcome. `stop()` synchronously saves completed work and aborts pending requests; late responses cannot mutate that checkpoint. A save failure rejects the run and prevents further worker mutations. The supplied `save(root)` adapter must be synchronous; a supplied request adapter must reject HTTP errors and accept an abort signal.
- CLI adapter: `tools/refresh-scores.js` owns arguments, file I/O, console output, termination signals, and exit status. Importing it starts no work. `tools/refresh-season-scores.js` selects seasonal MAL IDs and invokes this same adapter, rebuilding only after a completed run.
- Score refresh request module: `tools/lib/score-refresh-request.js`, shared by community-score fallback and episode pagination inside the run
- Score refresh request interface: request a URL; the module owns destination-host queues and paces every attempt, including retries and MAL fallbacks. Production fetch and mock fetch/clock adapters use the same seam.
- Score refresh source: both CLI commands and `fetchCommunityScore` default to `mal`, fetching community and episode scores directly from MAL without probing Jikan. The optional `--score-source auto` mode retains Jikan-first fallback behavior.
- Score refresh protection: defaults use one anime worker with 10-second MAL spacing. Optional `auto` mode adds 3-second Jikan spacing. Cooldowns apply before releasing a provider queue, honor `Retry-After`, and increase pacing after throttling. Permanent HTTP errors are not retried. Access denial, detected challenge pages, and three rate limits without provider success raise `ScoreRefreshStoppedError`, preventing queued fetches and score fallback for the rest of the run.
- Score refresh recovery: the run checkpoints completed results on protection stops or explicit interruption; the CLI handles termination signals, prints the resume index for the same selection, and exits nonzero. In-flight results may still be saved after another provider stops, but explicit interruption freezes the checkpoint. Request queues belong to a request instance; do not launch overlapping refresh runs.
- Score refresh outage fallback in optional `auto` mode: five consecutive Jikan connection/retryable-server failures mark Jikan unavailable within that request instance, before queued requests can start. Later community scores use the existing paced MAL fallback. Success and non-server HTTP responses reset this failure counter; access denial and repeated rate limits still stop the entire run. A fresh request instance can retry Jikan only when `auto` is explicitly selected.
- Score refresh preserves independent score/episode outcomes, partial saves, CLI options, and existing values when a fetch fails.
- Score refresh tests: run-level tests inject requests and checkpoint storage, with deterministic fetch/clock adapters for the real request module. Subprocess smoke tests retain file persistence, signal/exit wiring, seasonal selection, and MAL-default coverage without replacing global timers.
- Stable Bun commands: `bun run data:regenerate`, `bun run data:backup`, `bun run data:rollback`, `bun run test:scraper`
- Python entry points: `tools/regenerate_data.py`, `tools/deploy_data.py`, existing `tools/scraper/*.py`
- Launcher: `tools/run-python.js`
- Inputs: preview catalog, source/full/preview data files, backup ids, scraper fixtures
- Outputs: embedded `public/js/data.js`, data backups, restored data files, scraper test status
- Safety gates: embedded payload shape validation, backup id allowlist, backup directory containment, scraper host-policy tests

## Security-Sensitive Files
- `vercel.json`
- `sw.js`
- `src/shared/security/urlSanitizer.ts`
- `tools/validate_data.py`
