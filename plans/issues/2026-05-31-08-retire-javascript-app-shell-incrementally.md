# Retire JavaScript App Shell Incrementally

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Decide and execute the final browser-runtime shell migration only after extracted modules are typed and stable. The work should convert the large app orchestration and entrypoint shell incrementally, preserving user experience and avoiding a single risky rewrite.

## Acceptance criteria

- [ ] A short decision note identifies which app shell surfaces are safe to convert in this slice.
- [ ] App orchestration and entrypoint conversion preserves boot, render, filtering, detail modal, watchlist, PWA, and theme behavior.
- [ ] Existing unit, integration, e2e smoke, build, security, and accessibility checks pass.
- [ ] Bundle size, initial load, preview render, detail-modal latency, and watchlist latency remain within the migration regression budget.
- [ ] Any remaining JavaScript runtime surfaces are documented with reason and follow-up owner.

## Blocked by

- Migrate Catalog Runtime Services To TypeScript
- Migrate Browser Experience Modules To TypeScript
