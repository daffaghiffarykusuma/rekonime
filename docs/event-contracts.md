# Event Contracts

## `rekonime:data-load-start`
- Emitter: `js/app.js`
- Payload:
  - `source`: `full | embedded`
  - `timestamp`: ISO string

## `rekonime:data-load-complete`
- Emitter: `js/app.js`
- Payload:
  - `source`: `full | embedded`
  - `count`: number of anime entries
  - `durationMs`: number

## `rekonime:catalog-cache`
- Emitter: `js/app.js`
- Payload:
  - `type`: `network-full-loaded | indexeddb-full-hit | indexeddb-full-miss | indexeddb-full-used | indexeddb-full-read-failed | embedded-fallback-used | cache-write-ok | cache-write-failed | full-load-timeout | detail-chunk-loaded`
  - `at`: ISO string
  - `path`: catalog path when a network catalog is loaded
  - `phase`: `initial | full` when embedded fallback is used
  - `reason`: optional diagnostic reason

## `rekonime:watchlist-updated`
- Emitters: `js/app.js`, `js/watchlist-main.js`
- Payload:
  - `id`: anime id
  - `status`: `planned | watching | completed | dropped` (optional when removed)
  - `progress`: non-negative integer (optional when removed)
  - `removed`: boolean

## `rekonime:theme-changed`
- Emitter: `js/themeManager.js`
- Payload:
  - `theme`: `light | dark | auto`

## Contract Rules
- Event names are stable and kebab-case after `rekonime:`.
- Payload fields must be additive-only for backward compatibility.
- Breaking payload changes require tests and release note.
