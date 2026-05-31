# Migrate Browser Experience Modules To TypeScript

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Convert browser experience modules to TypeScript while preserving user-visible behavior. This includes Detail Experience, Airing Schedule, dashboard rendering adapter boundaries, Runtime Capabilities, keyboard/modal behavior, and watchlist integration points.

## Acceptance criteria

- [ ] Detail Experience, Airing Schedule/dashboard, Runtime Capabilities, and related browser integration points are migrated or typed.
- [ ] Detail modal open/close, deep link, review refresh, trailer replacement, modal focus, scroll lock, and Escape handling still work.
- [ ] Watchlist interaction behavior and dashboard scheduling remain compatible.
- [ ] Accessibility and keyboard behavior tests pass.
- [ ] Detail-modal latency and watchlist interaction latency remain within the migration regression budget.

## Blocked by

- Add Shared TypeScript Contracts For Watchlist Lifecycle
- Migrate Security-Sensitive URL And Trailer Policies To TypeScript
- Migrate Catalog Runtime Services To TypeScript
