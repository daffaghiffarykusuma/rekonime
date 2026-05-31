# Migrate Scraper-Adjacent Tooling And Data Operations To Python

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Align scraper-adjacent tooling and data operations with Python where it improves cohesion with the existing scraper stack. This includes selected score refresh/merge helpers, scraper orchestration, and data backup/rollback operations while preserving stable Bun package scripts.

## Acceptance criteria

- [ ] Selected scraper-adjacent and data operation tools are implemented or wrapped through Python.
- [ ] Existing Bun package-script names remain stable for users and CI.
- [ ] Scraper tests and data operation safety checks pass.
- [ ] Backup/rollback behavior is covered by tests or fixture verification.
- [ ] Tool timing remains within the migration regression budget or improves.

## Blocked by

- Add Python Golden Fixture Harness For Internal Tools
