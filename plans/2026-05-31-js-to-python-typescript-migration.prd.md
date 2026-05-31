# PRD: JavaScript to Python and TypeScript Migration

## Problem Statement

Rekonime currently uses JavaScript across both browser runtime code and internal project tooling. That makes runtime contracts implicit, allows data pipeline rules to share browser implementation details directly, and leaves migration/performance work harder to verify at module boundaries.

The team wants a faster and safer system by migrating internal tools to Python and the user-facing application/runtime to TypeScript. The migration must improve or protect internal tool speed and user experience, not become a language rewrite without measurable product value.

## Solution

Migrate Rekonime with a boundary-first strategy:

- Python owns internal tools, data pipeline, scraper-adjacent workflows, validation/reporting, and developer automation where Python materially improves maintainability or performance.
- TypeScript owns the browser runtime, user-facing modules, shared runtime services, event contracts, and typed application boundaries.
- Bun is the primary JavaScript/TypeScript runtime and package-script surface. Node is compatibility-only and every remaining Node-only path needs an explicit reason and owner.
- TypeScript contracts come before Python tool rewrites so Python and TypeScript implementations can be held to the same JSON schemas, fixtures, and behavior tests.
- Migration proceeds inside-out from deep, testable modules to browser orchestration.

The migration succeeds only when behavior is preserved and measured critical paths improve or stay within the accepted regression budget.

## User Stories

1. As a Rekonime user, I want the app to load at least as quickly after migration, so that the language change does not make browsing slower.
2. As a Rekonime user, I want preview catalog rendering to remain fast, so that the first useful screen appears quickly.
3. As a Rekonime user, I want detail modals to open with no added latency, so that anime inspection still feels responsive.
4. As a Rekonime user, I want watchlist changes to remain instant, so that saving progress does not feel delayed.
5. As a Rekonime user, I want offline behavior to keep working, so that Service Worker and cached catalog behavior are preserved.
6. As a Rekonime user, I want trailer and image handling to stay secure, so that unsafe URLs are still rejected.
7. As a Rekonime user, I want accessibility scores and keyboard behavior preserved, so that the migrated app remains usable.
8. As a maintainer, I want Catalog Runtime contracts typed, so that catalog payload changes fail during checks before they fail in the browser.
9. As a maintainer, I want Watchlist Lifecycle types, so that persisted watchlist entries and legacy migration behavior remain explicit.
10. As a maintainer, I want Detail Experience boundaries typed, so that modal state, URL state, and refreshed detail data remain coherent.
11. As a maintainer, I want Airing Schedule contracts typed, so that schedule cache, countdown, and local-time labels do not drift.
12. As a maintainer, I want Runtime Capabilities typed, so that modal focus, scroll lock, idle scheduling, and Escape handling are safer to change.
13. As a maintainer, I want event payloads typed, so that `rekonime:*` events remain additive and backward-compatible.
14. As a maintainer, I want data pipeline outputs validated against shared schemas, so that Python tools and TypeScript runtime agree on catalog shape.
15. As a maintainer, I want golden fixtures for generated catalog files, so that Python rewrites prove output compatibility.
16. As a maintainer, I want Bun-first package scripts, so that day-to-day commands stay consistent with project preference.
17. As a maintainer, I want Node-only paths documented, so that compatibility exceptions are visible and removable.
18. As a data pipeline maintainer, I want Python build and validation tools where they are data-heavy, so that pipeline work is easier to optimize and profile.
19. As a data pipeline maintainer, I want scraper orchestration aligned with existing Python scraper code, so that scraper-adjacent workflows are simpler.
20. As a reviewer, I want migration PRs to include before/after performance measurements, so that speed claims are evidence-based.
21. As a reviewer, I want each migration slice to preserve existing command names, so that CI and local workflows remain stable.
22. As a reviewer, I want small migration slices, so that behavior regressions are easy to isolate.
23. As a security reviewer, I want URL policy and Trusted Types behavior tested after migration, so that security-sensitive runtime behavior is preserved.
24. As a release owner, I want the CI/local matrix updated as commands change, so that release validation remains reproducible.
25. As a future contributor, I want clear module ownership after migration, so that changes go to the correct review group.

## Implementation Decisions

- Use the confirmed language boundary: Python for internal tools and data pipeline; TypeScript for the browser runtime and shared runtime services.
- Treat Bun as the primary JavaScript/TypeScript command runner. Convert package scripts away from direct `node` invocation when Bun can run the path correctly.
- Keep Node only as a documented compatibility fallback for dependencies or scripts that cannot yet run under Bun.
- Add or refine shared TypeScript contracts before Python rewrites. Contracts must cover catalog payloads, detail chunks, watchlist entries, stats output, validation issues, trailer URL policy results, and app event payloads.
- Migrate TypeScript inside-out:
  - Shared contracts and schemas.
  - Pure or mostly pure runtime modules such as Watchlist Lifecycle, URL/trailer policies, stats, recommendations, and filter presets.
  - Runtime services such as Catalog Runtime, Catalog Payload, cache/API/logger/error handling.
  - Browser experience modules such as Detail Experience, Airing Schedule/dashboard, and Runtime Capabilities.
  - Final app orchestration and entrypoints.
- Keep the large app orchestration shell in JavaScript until extracted modules are typed and tested.
- Migrate Python selectively, starting with data-heavy and scraper-adjacent tools: catalog build/validation/reporting, score refresh and merge helpers, scraper orchestration, deploy backup/rollback, integrity checks, schema validation, and quality reporting.
- Defer tiny static checks unless profiling or maintainability evidence supports conversion.
- Preserve stable package-script names such as data validation, regeneration, tool tests, build verification, and security checks.
- Use JSON schemas and golden output fixtures to prevent drift between Python-generated data and TypeScript runtime expectations.
- Preserve documented domain language: Catalog Runtime, Catalog Payload, Watchlist Lifecycle, Watchlist Entry, Snapshot, Airing Schedule, Detail Experience, and Runtime Capabilities.
- Use a 5% regression budget for measured critical paths. A migration PR that slows a measured critical path by more than 5% must document why that trade-off is accepted.
- Do not claim speed improvements without benchmark evidence from the same machine class, same dataset, and comparable command path.
- Update CI/local command documentation whenever command behavior changes.
- Apply the intended issue-tracker triage label `ready-for-agent` when this PRD is published.

## Testing Decisions

- Tests should verify external behavior and stable contracts, not implementation details of a specific language.
- Keep existing required checks as the baseline: repo hygiene, unit tests, integration tests, data validation, coverage, coverage thresholds, entrypoint dedup, build verification, distribution checks, runtime preview budget, distribution size budget, and security checks.
- Add a TypeScript typecheck command to the required local/CI matrix before large runtime migrations begin.
- Add contract tests for shared schemas and event payloads before converting dependent modules.
- Add golden fixture tests for Python-generated catalog, preview, embedded data, validation reports, and quality reports.
- Add parity tests where Python replaces JavaScript tooling: same inputs must produce byte-compatible output or an explicitly versioned intentional diff.
- Add performance measurements for internal tools: catalog build/regenerate, data validation, scraper tests, and build verification.
- Add performance measurements for user experience: bundle size, initial load, preview render, detail-modal latency, watchlist interaction latency, Lighthouse performance, and Lighthouse accessibility.
- Run security-sensitive regression tests after URL policy, trailer handling, validation, service worker, or data pipeline migrations.
- Use existing module tests as prior art for Watchlist Lifecycle, Catalog Runtime, Catalog Payload, Detail Experience, Airing Schedule, Runtime Capabilities, security URL policies, and tooling validators.

## Out of Scope

- Rebuilding Rekonime as a server-rendered or Python-served web application.
- Migrating browser runtime logic to Python.
- Rewriting every internal script regardless of measured value.
- Changing product behavior, visual design, recommendation semantics, or watchlist lifecycle semantics as part of the migration.
- Replacing Vite, Playwright, Bun, or the current static deployment model unless a separate decision record is created.
- Making breaking event payload changes without separate compatibility planning.
- Relaxing security checks, validation baselines, accessibility requirements, or coverage thresholds to make migration easier.

## Further Notes

- Current publication to GitHub Issues is blocked because the local GitHub CLI is not authenticated.
- The PRD should be published to the project issue tracker with label `ready-for-agent` after authentication is available.
- This PRD intentionally separates facts, assumptions, and judgments:
  - Fact: the repo already uses Bun in CI and package scripts, but many scripts still call `node tools/...`.
  - Fact: internal tooling and browser runtime currently share JavaScript modules such as stats and trailer URL policy.
  - Fact: existing Python code already exists under scraper tooling.
  - Assumption: Python will be most valuable in data-heavy and scraper-adjacent tools.
  - Judgment: TypeScript contracts should precede Python rewrites to reduce cross-language drift.
