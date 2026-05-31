# Add Shared TypeScript Contracts For Watchlist Lifecycle

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Add shared TypeScript contracts for Watchlist Lifecycle behavior without changing persistence or UI behavior. The contracts should cover Watchlist Entry, Snapshot, persisted payloads, lifecycle transitions, control models, display models, and watchlist update events.

## Acceptance criteria

- [ ] Watchlist Entry, Snapshot, persisted payload, transition result, control model, and display model shapes have TypeScript contracts.
- [ ] The `rekonime:watchlist-updated` payload is typed and remains backward-compatible.
- [ ] Legacy watchlist migration behavior is covered by existing or added tests.
- [ ] Typecheck covers the new contracts.
- [ ] Existing Watchlist Lifecycle tests continue to pass.

## Blocked by

- Establish Migration Baselines And Bun-First Gates
