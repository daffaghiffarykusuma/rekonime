# Rekonime Migration Handoff

## Current State

The user wants Rekonime migrated from JavaScript to:

- Python for internal tools and data pipeline work.
- TypeScript for browser runtime, user-facing modules, shared runtime services, and app contracts.

The conversation used `grill-with-docs`, then `to-prd`, then `to-issues`.

Key decisions already confirmed by the user:

- Python owns internal tools/data pipeline; TypeScript owns browser runtime.
- TypeScript contracts must come before Python tool rewrites.
- TypeScript migration should proceed inside-out from deep/testable modules to app shell.
- Python conversion should be selective and evidence-led, not a blanket rewrite of every tool.
- Bun is preferred over Node for JavaScript/TypeScript tooling.
- Remaining Node-only paths should be documented with reason, owner, and removal condition.
- Migration PRs have a 5% performance regression budget for measured critical paths.

## Existing Artifacts

Do not recreate these unless asked. Continue from them:

- PRD: `C:\Users\Lenovo\Documents\VS Code Projetcs\rekonime\plans\2026-05-31-js-to-python-typescript-migration.prd.md`
- Issue drafts directory: `C:\Users\Lenovo\Documents\VS Code Projetcs\rekonime\plans\issues\`

There are 13 issue drafts in dependency order:

1. `2026-05-31-01-establish-migration-baselines-and-bun-first-gates.md`
2. `2026-05-31-02-add-shared-typescript-contracts-for-catalog-runtime.md`
3. `2026-05-31-03-add-shared-typescript-contracts-for-watchlist-lifecycle.md`
4. `2026-05-31-04-migrate-security-sensitive-url-and-trailer-policies-to-typescript.md`
5. `2026-05-31-05-migrate-pure-runtime-scoring-and-recommendation-modules-to-typescript.md`
6. `2026-05-31-06-migrate-catalog-runtime-services-to-typescript.md`
7. `2026-05-31-07-migrate-browser-experience-modules-to-typescript.md`
8. `2026-05-31-08-retire-javascript-app-shell-incrementally.md`
9. `2026-05-31-09-add-python-golden-fixture-harness-for-internal-tools.md`
10. `2026-05-31-10-migrate-data-validation-and-quality-reporting-to-python.md`
11. `2026-05-31-11-migrate-catalog-build-and-regeneration-to-python.md`
12. `2026-05-31-12-migrate-scraper-adjacent-tooling-and-data-operations-to-python.md`
13. `2026-05-31-13-close-migration-with-ci-ownership-and-documentation-update.md`

## Repo Context

Workspace:

`C:\Users\Lenovo\Documents\VS Code Projetcs\rekonime`

Important project vocabulary from `CONTEXT.md`:

- Catalog Runtime
- Catalog Payload
- Watchlist Lifecycle
- Watchlist Entry
- Snapshot
- Airing Schedule
- Detail Experience
- Runtime Capabilities

Useful docs:

- `CONTEXT.md`
- `docs\module-contracts.md`
- `docs\event-contracts.md`
- `docs\ci-local-matrix.md`
- `docs\ownership-matrix.md`

Important current repo facts:

- CI already installs Bun and uses `bun --silent run ...`.
- Many package scripts still call `node tools/...`.
- `tsconfig.json` already exists with `allowJs`, strict settings, Bun types, and no emit.
- `tools\scraper\` already contains Python code.
- Browser/runtime code lives mostly in `js\`.
- Internal tools/data pipeline live mostly in `tools\` and `data\`.
- `tools\build-catalogs.js` imports runtime scoring logic from `js\stats.js`.
- `tools\validate-data.js` imports trailer URL policy from browser runtime code.

## Working Tree Notes

At handoff time, expected repo status included:

- New untracked PRD file under `plans\`.
- New untracked issue drafts under `plans\issues\`.
- An unrelated deleted file: `plans\2026-04-15-design-thinking-gap-analysis.user.md`.

Do not restore or modify the unrelated deleted file unless the user explicitly asks.

## Blockers

Publishing to GitHub Issues was not completed because local GitHub CLI authentication was unavailable:

- `gh auth status` reported no logged-in GitHub host.
- `gh label list` also failed for the same reason.

Once GitHub auth is available, publish issue drafts in filename order and apply `ready-for-agent`.

## Suggested Skills

- `github:github` if the next step is checking GitHub issue labels or publishing issues through the GitHub connector.
- `to-issues` if the user wants the issue breakdown revised before publishing.
- `github:yeet` if the user wants to commit/push these local artifacts and open a PR.
- `tdd` if implementation begins with the first baseline/typecheck issue.
- `vercel:nextjs` is not relevant unless the app is converted to Next.js, which is explicitly out of scope in the PRD.

## Recommended Next Step

Ask whether the user wants to:

1. Publish the issue drafts to GitHub after authenticating GitHub access.
2. Commit the PRD and issue drafts.
3. Start implementation with issue 1: migration baselines and Bun-first gates.

