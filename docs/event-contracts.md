# Event Contracts

## `rekonime:data-load-start`
- Emitter: `js/app.js`
- Payload:
  - `source`: `preview | full | embedded`
  - `timestamp`: ISO string

## `rekonime:data-load-complete`
- Emitter: `js/app.js`
- Payload:
  - `source`: `preview | full | embedded`
  - `count`: number of anime entries
  - `durationMs`: number

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
