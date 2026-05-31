# Migrate Catalog Runtime Services To TypeScript

Label: `ready-for-agent`

## Parent

JavaScript to Python and TypeScript Migration PRD

## What to build

Convert Catalog Runtime service boundaries to TypeScript while preserving preview load, full catalog upgrade, cached fallback, embedded fallback, and detail-chunk behavior. The completed slice should keep the app behavior demoable with existing catalog flows.

## Acceptance criteria

- [ ] Catalog Runtime, Catalog Payload, cache/API/error/logger service boundaries are migrated or typed without behavior regressions.
- [ ] Preview, full catalog, cached fallback, embedded fallback, and detail-chunk tests pass.
- [ ] Catalog events remain backward-compatible and typed.
- [ ] User-facing catalog load and preview render measurements remain within the migration regression budget.
- [ ] Security-sensitive validation and URL-policy interactions remain covered.

## Blocked by

- Add Shared TypeScript Contracts For Catalog Runtime
- Migrate Security-Sensitive URL And Trailer Policies To TypeScript
- Migrate Pure Runtime Scoring And Recommendation Modules To TypeScript
