# Migrate Catalog Build And Regeneration To Python

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Convert data-heavy catalog build and regeneration paths to Python while preserving generated outputs, scoring semantics, preview selection, embedded fallback generation, and stable Bun package-script names.

## Acceptance criteria

- [ ] Catalog build and regeneration can run through the existing Bun command surface.
- [ ] Full catalog, preview catalog, embedded data, score profile, and detail outputs match golden fixtures or document intentional versioned changes.
- [ ] Scoring and recommendation-related build behavior remains compatible with typed runtime contracts.
- [ ] Build/regeneration timing remains within the migration regression budget or improves.
- [ ] Data validation and build verification pass after generated outputs are produced.

## Blocked by

- Migrate Pure Runtime Scoring And Recommendation Modules To TypeScript
- Add Python Golden Fixture Harness For Internal Tools
- Migrate Data Validation And Quality Reporting To Python
