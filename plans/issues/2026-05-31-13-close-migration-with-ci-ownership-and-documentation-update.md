# Close Migration With CI, Ownership, And Documentation Update

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Close the migration by updating CI/local documentation, ownership guidance, release/security documentation, and the Node exception inventory. The final state should make the Python/TypeScript/Bun architecture clear to future contributors.

## Acceptance criteria

- [ ] CI and local command matrix reflect the final Bun-first, TypeScript, and Python tool workflow.
- [ ] Ownership documentation maps migrated runtime, tooling, data pipeline, and security-sensitive surfaces to the right reviewers.
- [ ] Release and security documentation reflect new validation, build, and compatibility gates.
- [ ] Remaining Node compatibility exceptions are either removed or documented with reason, owner, and removal condition.
- [ ] Full required verification passes after documentation and CI updates.

## Blocked by

- Retire JavaScript App Shell Incrementally
- Migrate Data Validation And Quality Reporting To Python
- Migrate Catalog Build And Regeneration To Python
- Migrate Scraper-Adjacent Tooling And Data Operations To Python
