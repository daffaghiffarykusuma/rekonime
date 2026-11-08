# Ticket 04 and ticket 03 reflow integration

Recorded 2026-11-08 in the shared root checkout on `feat/mobile-discovery-ui`.
Merger-only scope. Parent specification and all tickets remain open, with their
existing status values unchanged. No PR, monitoring, subagents, reset, force,
worktree creation or removal, dependency change, or application/test adjustment.

## State and preserved history

- Root verified clean at the requested `0eaf5d24a76dbb516458d3ecc26f5d7d2f69e7cb`.
- Source refs matched `t3/promote-watching-home-entry` at
  `0e84c4b618bdcfcb3060e05902437e7ad38a9011` and
  `t3/ticket03-mobile-overflow` at `420348355574d8a8f5d95b11a81110940a08fb3c`.
- Read parent `docs/ui-design-spec.md`, ticket04 source evidence, overflow-resolution
  source evidence, and existing integration-01-03/integration-05 records.
- Normal `git merge --no-ff 0e84c4b618bdcfcb3060e05902437e7ad38a9011`
  created `cfa3f6565068c3199eb84d639c961c62a65e1f45`. Parents are the starting
  root and requested ticket04 head. Git automatically merged `core-ui.css`.
- Normal `git merge --no-ff 420348355574d8a8f5d95b11a81110940a08fb3c`
  created `7ef3f1b58731a2ba95eaebbe4b6c128d99389883`. Parents are the first
  merge and requested overflow head. Neither merge had conflicts or needed escalation.
- Both source heads and the original root passed `git merge-base --is-ancestor`
  against the merged HEAD. This preserves ticket04 implementation `2f38721`, its
  integration/evidence ancestry, the committed overflow fix/evidence, and the
  already integrated tickets01/02/03/05. No cherry-picking or history replacement.
- This record is a separate commit after the two merges.

## Checks on merged application tree

- `bun run typecheck`: exit 0.
- Focused Bun command below: **86 passed, 0 failed across 18 files**, exit 0.
- `bun run test --timeout 30000`: **309 passed, 0 failed across 73 files**, exit 0.
- `bun run data:validate`: separately verified exit 0. It printed existing
  missing-score/trailer counts and warnings under the enforced baseline. Python
  ran successfully here; the previously reported missing-Python limitation did
  not reproduce, including the three launcher tests in the normal suite.
- `bun run build`, `bun run check:dist-assets`, `bun run check:runtime-preview`,
  `bun run check:dist-size`: all exited 0. `git diff --check`: passed.

```powershell
bun test --preload ./test/setup.js test/unit/watchlist test/unit/discovery-improvements.test.ts test/unit/personal-data-restore.test.ts test/unit/mal-watchlist-import.test.ts test/unit/import-limits.test.ts test/contracts/watchlist-lifecycle-contract.test.ts test/integration/app-personal-data-restore.test.js test/integration/app-mal-watchlist-import.test.js test/integration/app-discovery.test.js test/integration/app-filters.test.js --timeout 30000
```

## Browser results and unresolved checks

Shared T3 preview returned `available:false`. Used repository Playwright with
installed Chrome (`use.channel: 'chrome'`), without downloading a browser. Temporary
root configs imported the existing development/production configs. Development
used `REKONIME_E2E_PORT=43238`; isolated rerun used 43240. Production baseURL and
strict-port preview server used 43239, with `reuseExistingServer:false`.
Temporary configs were removed after processes completed; no existing server
or worktree was stopped or removed.

Development command:

```powershell
bunx playwright test --config playwright.integration04.config.js test/e2e/focused-mobile-discovery.spec.js test/e2e/promoted-watching.spec.js test/e2e/mobile-filter-sort.spec.js test/e2e/rating-evidence.spec.js test/e2e/critical-flows.spec.js test/e2e/first-visit-shortlist.spec.js test/e2e/first-visit-selection.spec.js test/e2e/first-visit-dismissal.spec.js test/e2e/first-visit-taste.spec.js test/e2e/first-visit-save.spec.js --workers=2
```

Result: **48 passed, 2 failed**, exit 1, 3.8 minutes. All focused-mobile-discovery,
promoted-watching, mobile-filter-sort, rating-evidence, and first-visit cases
passed, as did Manage data reachability and reviewed MAL import scenarios.

1. `critical-flows.spec.js:105`, selected viewing intent summary: section height
   measured **140.375px**, exceeding the existing **140px** assertion at line131.
   Isolated one-worker rerun reproduced exactly the same result. No baseline
   comparison was performed, so this record does not attribute its cause or
   call it pre-existing. The assertion remains unchanged. This is still a
   failing browser check despite the passing page-width/reflow checks.
2. `critical-flows.spec.js:700`, backup roundtrip: progress remained 3 instead
   of becoming 5 after fill/Tab, at line718, before returning to the homepage.
   This matches the kind of intermittent failure reported by ticket04.
   Isolated rerun **passed**, including export/restore and homepage progress.
   The initial failure remains recorded; no baseline or definitive cause claimed.

Isolated rerun used the same development config with
`test/e2e/critical-flows.spec.js --grep 'selected viewing intent collapses|backup roundtrip' --workers=1 --output=output/playwright/integration04-rerun`:
**1 passed, 1 failed**, exit 1.

Production temporary config selected
`/(?:production-smoke|promoted-watching|focused-mobile-discovery)\.spec\.js/`.
`bunx playwright test --config playwright.integration04-prod.config.js --workers=2`:
**20 passed**, exit 0, 1.5 minutes. This includes all eight production smoke tests,
six promoted Watching cases, and six focused Discovery cases. Covers touch sorting,
navigation/search/detail, MAL import, Manage data at 1280/390px in both themes
and 100/200% root text, and Discovery page-width/actionability at increased text.

The **known Watchlist 200% root-text 481px page width in a 390px viewport remains
pending a separate fix**. Production Manage data tests check reachable controls
and annotate page width; they do not assert whole-Watchlist page width. Their
success does not resolve that acceptance concern. No overflow suppression or
claim of accessibility compliance was added.

## Rendered evidence and boundaries

Inspected merged-tree screenshots with `view_image`: 390px dark enlarged active
intent, 1280px light enlarged active intent, 390px light positive-multiple promoted
Watching section, and production 390px light enlarged open Manage data page.
Change wraps below intent copy on mobile; the promoted long title, unknown total,
progress action, and View all remain readable. Desktop enlarged search/sort text
still clips inside its controls. Watchlist has visible increased-text layout
limitations and the capture includes existing offline/update notices. These
screenshots establish rendered observations only, not user outcomes.

Generated evidence from this task was moved from initially untracked
`.scratch/ui-design/evidence/` into ignored `output/playwright/integration04-evidence/`.
Development captures remain in ignored `test-results/`; production captures are
in `output/playwright/integration04-production/`. Logs are retained locally in
`output/playwright/integration04-logs/`, including full Bun, data, development,
production, and rerun output. The missing-rating fixture logged its catalog JSON
fallback error while visible unavailable-state assertions passed. Development
also logged an EBUSY file-watcher warning on a concurrently written screenshot;
the run completed and returned its actual failure status. No live-provider or
participant verification is claimed. No full accessibility audit was performed.
