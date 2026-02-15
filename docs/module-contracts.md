# Module Contracts

## Runtime App Domains

### Catalog Loading
- Entry point: `js/app.js` (`fetchCatalog`, `applyCatalogPayload`)
- Inputs: catalog JSON payloads (`preview`, `full`)
- Outputs: normalized `App.animeData`, filter options, score profile
- Side effects: cache writes, meta updates, events (`rekonime:data-load-*`)

### Watchlist State
- Entry points: `js/app.js`, `js/watchlist-main.js`
- Shared normalization: `js/watchlist-state.js`
- Storage key: `rekonime.watchlist`
- Side effects: localStorage updates, watchlist UI updates

### Detail Modal
- Entry point: `js/app.js` (`showAnimeDetail`, trailer control methods)
- Inputs: anime id, cached detail, reviews payload
- Outputs: modal markup, URL sync (`?anime=...`)
- Side effects: DOM mutations, trailer postMessage, analytics events

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
