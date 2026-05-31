# Migrate Security-Sensitive URL And Trailer Policies To TypeScript

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Convert the shared URL and trailer policy surfaces to TypeScript with no intended behavior change. The migration must preserve trusted trailer host handling, sanitized URL outputs, Trusted Types integration, and all security-sensitive rejection behavior.

## Acceptance criteria

- [ ] URL sanitizer and trailer policy modules are migrated to TypeScript or typed entrypoints without changing public behavior.
- [ ] Existing URL sanitizer, fuzz, trailer policy, and render-security tests pass.
- [ ] Invalid or unsafe trailer/image/embed URLs continue to be rejected.
- [ ] Any tool or runtime consumer still imports the same stable policy behavior.
- [ ] Bundle and security checks stay within the migration regression budget.

## Blocked by

- Establish Migration Baselines And Bun-First Gates
