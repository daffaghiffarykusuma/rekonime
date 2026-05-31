# Add Shared TypeScript Contracts For Catalog Runtime

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Add shared TypeScript contracts for the Catalog Runtime without changing browser behavior. The contracts should make preview catalog, full catalog, detail chunks, score profile, catalog events, and validation handoff explicit so later Python and TypeScript migrations can prove compatibility.

## Acceptance criteria

- [ ] Catalog Payload, preview catalog, full catalog, detail chunk, score profile, and validation issue shapes have TypeScript contracts.
- [ ] Catalog Runtime event payloads are typed while preserving existing event names and additive-only compatibility rules.
- [ ] Existing catalog loading tests still pass without behavior changes.
- [ ] Typecheck covers the new contracts.
- [ ] Documentation references the contracts using existing Catalog Runtime and Catalog Payload language.

## Blocked by

- Establish Migration Baselines And Bun-First Gates
