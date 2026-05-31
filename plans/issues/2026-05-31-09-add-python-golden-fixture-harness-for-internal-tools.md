# Add Python Golden Fixture Harness For Internal Tools

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Add a Python-compatible golden fixture harness for internal tool migration. The harness should make generated catalog outputs, preview outputs, embedded data, validation reports, and quality reports comparable before Python replaces JavaScript tooling.

## Acceptance criteria

- [ ] Golden fixtures exist for representative catalog, preview, embedded data, validation report, and quality report outputs.
- [ ] A Bun package script can run the Python fixture/parity harness through the project command surface.
- [ ] The harness reports byte-compatible output or a clearly versioned intentional diff.
- [ ] Fixture coverage includes success and failure cases for data validation.
- [ ] The harness is documented for future Python tool migrations.

## Blocked by

- Establish Migration Baselines And Bun-First Gates
- Add Shared TypeScript Contracts For Catalog Runtime
