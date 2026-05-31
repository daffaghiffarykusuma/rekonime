# Migrate Data Validation And Quality Reporting To Python

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Selectively convert data validation and quality reporting internals to Python while preserving the existing Bun command surface and runtime contracts. The migration must prove parity through fixtures and keep security-sensitive URL and schema behavior intact.

## Acceptance criteria

- [ ] Data validation and quality reporting behavior is implemented through Python internals where selected.
- [ ] Existing package-script names continue to work through Bun.
- [ ] Golden fixture parity passes for validation and quality reporting outputs.
- [ ] Schema validation, trailer URL policy expectations, and data quality baselines remain enforced.
- [ ] Internal tool timing remains within the migration regression budget or improves.

## Blocked by

- Add Shared TypeScript Contracts For Catalog Runtime
- Migrate Security-Sensitive URL And Trailer Policies To TypeScript
- Add Python Golden Fixture Harness For Internal Tools
