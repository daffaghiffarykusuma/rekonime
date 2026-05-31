# Migrate Pure Runtime Scoring And Recommendation Modules To TypeScript

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Convert pure or mostly pure runtime logic to TypeScript, starting with scoring, recommendations, filter presets, and related calculation modules. The slice should keep public behavior stable while making the calculation contracts explicit for both runtime and tooling consumers.

## Acceptance criteria

- [ ] Scoring, recommendation, and filter preset public behavior is preserved by tests.
- [ ] TypeScript contracts cover the calculation inputs and outputs used by runtime and tools.
- [ ] Bundle size and measured runtime paths remain within the 5% regression budget.
- [ ] Existing recommendation, stats, filter preset, and related integration tests pass.
- [ ] Tool consumers of scoring behavior continue to work during the migration.

## Blocked by

- Establish Migration Baselines And Bun-First Gates
- Add Shared TypeScript Contracts For Catalog Runtime
