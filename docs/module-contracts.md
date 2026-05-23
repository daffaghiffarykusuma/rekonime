# Module Contracts

## Runtime App Domains

### Catalog Loading
- Runtime module: `js/services/catalog-loader.js`
- Payload module: `js/services/catalog-payload.js`
- App handoff: `js/app.js` (`applyCatalogPayload`, render/filter/meta refresh)
- Inputs: catalog JSON payloads (full index, detail chunks, embedded fallback)
- Outputs: normalized `App.animeData`, filter options, score profile
- Interface: load the full catalog index, fetch catalog payloads, read/write full catalog cache, use embedded fallback, and merge detail chunks
- Side effects: catalog network/cache events (`rekonime:data-load-*`, `emitCatalogEvent`); `js/services/catalog-payload.js` owns normalization, score-profile validation, validation handoff, and render-ready catalog state

### Watchlist State
- Entry points: `js/app.js`, `js/watchlist-main.js`
- Lifecycle module: `js/watchlist-state.js`
- Storage key: `rekonime.watchlist`
- Interface: load entries, migrate legacy bookmarks, update status/progress, refresh snapshots, expose filtered entries/items, and build transition envelopes for adapters
- Side effects: storage writes only; callers apply the returned event, render, and dashboard scheduling intent

### Detail Experience
- Experience module: `js/detail-experience.js`
- App handoff: `js/app.js` (`showAnimeDetail`, detail markup builders, image helpers, trailer control methods)
- Inputs: anime id, cached detail, review payload, detail URL state (`?anime=...`)
- Outputs: modal visibility, refreshed synopsis/reviews, cached detail HTML, detail URL synchronization
- Side effects: history state, metadata updates, trailer cleanup/replacement, full-catalog deep-link fallback, modal-open telemetry

### Airing Schedule
- Schedule module: `js/airing-schedule.js`
- Renderer adapter: `js/airing-dashboard.js`
- Inputs: planned/watching watchlist entries, catalog or snapshot anime items, AniList schedule responses, local clock
- Outputs: dashboard model with next episode, readiness, countdown, local time labels, and summary counts
- Interface: fetch/cache schedule metadata, build dashboard models, and run countdown refresh ticks
- Side effects: AniList GraphQL calls, local schedule cache writes, and renderer callbacks

### Shared URL Policies
- Entry points: `js/security/trailer-url-policy.js`, `js/urlSanitizer.js`
- Inputs: trailer URL candidates and embed URL candidates
- Outputs: sanitized URL strings (`''` when invalid)
- Side effects: none (pure sanitization helpers)

### Shared Image Proxy
- Entry point: `js/image-proxy.js`
- Inputs: image URLs, storage keys, status TTL/probe config
- Outputs: proxy URL, status state, availability checks
- Side effects: localStorage reads/writes for proxy health status

### Runtime Capabilities
- Runtime module: `js/runtime-capabilities.js`
- App handoff: `js/app.js` (product-specific close handlers)
- Inputs: idle callbacks, modal ids, focus targets, Escape key events
- Outputs: idle task handles, modal open state, focus trap state, scroll lock state
- Side effects: modal attributes/classes, focus movement, body scroll lock, scheduled callbacks

### Reviews
- Entry point: `js/reviews.js`
- Inputs: MAL id and title
- Outputs: sanitized synopsis/review markup
- Side effects: network calls to Jikan, circuit breaker state

## Pipeline Domains

### Catalog Build
- Entry point: `tools/build-catalogs.js`
- Inputs: `data/anime.json`
- Outputs: `data/anime.full.json`, `data/anime.preview.json`
- Gates: schema validation, integrity checks, quality gates

### Data Validation
- Entry points: `tools/validate-data.js`, `tools/lib/schema-validator.js`
- Inputs: generated catalog + embedded payload
- Outputs: error/warning report and process status

## Security-Sensitive Files
- `vercel.json`
- `sw.js`
- `js/urlSanitizer.js`
- `tools/validate-data.js`
- `tools/lib/schema-validator.js`
