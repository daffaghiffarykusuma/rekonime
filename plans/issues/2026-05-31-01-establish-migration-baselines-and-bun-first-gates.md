# Establish Migration Baselines And Bun-First Gates

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Create the migration baseline that every later slice can compare against. The project should have a Bun-first command surface, a required TypeScript typecheck gate, documented Node compatibility exceptions, and repeatable measurements for internal tools and user-facing performance before any runtime or tool migration changes behavior.

## Acceptance criteria

- [ ] A Bun-first TypeScript typecheck command exists and is documented in the local/CI command matrix.
- [ ] Current package scripts that still require direct Node execution are inventoried with reason, owner, and removal condition.
- [ ] Baseline timings are captured for data validation, catalog build/regenerate, scraper tests, and build verification.
- [ ] Baseline user-facing measurements are captured for bundle size, initial load, preview render, detail-modal latency, watchlist interaction latency, Lighthouse performance, and Lighthouse accessibility.
- [ ] The migration regression budget is documented as no more than 5% slowdown on measured critical paths unless explicitly accepted in the PR.

## Blocked by

None - can start immediately
