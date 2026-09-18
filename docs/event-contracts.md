# Event Contracts

## `rekonime:data-load-start`
- Emitter: `src/app/app.ts`
- Payload:
  - `source`: `preview | full | embedded`
  - `timestamp`: ISO string, optional

## `rekonime:data-load-end`
- Emitter: `src/features/catalog/catalog-loader.ts` through `src/app/app.ts`
- Payload:
  - `source`: `preview | full | embedded`
  - `count`: number of anime entries, optional
  - `durationMs`: number, optional
  - `status`: `ok | error | fallback`, optional

## `rekonime:catalog-cache`
- Emitter: `src/app/app.ts`
- Payload:
  - `type`: `network-full-loaded | indexeddb-full-hit | indexeddb-full-miss | indexeddb-full-used | indexeddb-full-read-failed | embedded-fallback-used | cache-write-ok | cache-write-failed | full-load-timeout | detail-chunk-loaded`
  - `at`: ISO string
  - `path`: catalog path when a network catalog is loaded
  - `phase`: `initial | full` when embedded fallback is used
  - `reason`: optional diagnostic reason

## `rekonime:watchlist-updated`
- Emitters: `src/app/app.ts`, `src/app/watchlist-main.ts`
- TypeScript contract: `WatchlistLifecycleEventMap['rekonime:watchlist-updated']` in `src/features/watchlist/contracts/watchlist-lifecycle.ts`
- Payload:
  - `id`: anime id
  - `status`: `planned | watching | completed | dropped` (optional when removed)
  - `progress`: non-negative integer (optional when removed)
  - `removed`: boolean

## `rekonime:theme-changed`
- Emitter: `src/shared/ui/themeManager.js`
- Payload:
  - `theme`: `light | dark | auto`

## Contract Rules
- Event names are stable and kebab-case after `rekonime:`.
- Payload fields must be additive-only for backward compatibility.
- Breaking payload changes require tests and release note.
