# Review resolution

Branch: `t3/mobile-discovery-review-fixes`. Prepared checkout: `C:/Users/Lenovo/.t3/worktrees/rekonime/t3-4f0195dd`.

## Baseline and scope

Started clean at `ec26f355cc121aa1d997400eb962da7e935aeb3a`. Verified it and reviewed head `6d71322` are ancestors. Read both review axes, parent repetition evidence, specification, GLOSSARY, integration-04-reflow, and tickets02/03/04/05. Applied TDD and diagnosing-bugs at the already approved browser seam. No extra checkout, branch, subagent, ranking/formula/provider/storage-schema change, root merge, or PR.

## Content and maintainability

- Zero-rated episode evidence now retains unavailable wording plus applicable limited-data, total-unknown, and provisional qualifiers. Community fallback decision notes consume that evidence too.
- Because-you-watched uses `Community Score (MAL)` and `/10`.
- Decision data carries `kind`; the recommendation renderer branches on `community` instead of display copy.
- `getPresentationEpisodeScore` centralizes evidence/finite-value/rounding for card stats, decision signals, similar titles and supporting recommendation presentation. Ranking still uses its original score inputs.
- Browser red: `qualifiers-red.log` failed on missing Limited data. Green: `qualifiers-green.log`, exit0. Browser red: `byw-red.log` reached the visible MAL8.2/10 label and failed the full-name assertion. Earlier invalid empty-cover Snapshot fixtures did not produce this section and are setup errors, not red evidence. `content-summary-green.log`: all3 targeted cases passed, exit0.

## Summary diagnosis

Parent observed3/3 failures at140.375px; local unchanged test reproduced3/3 (`reproduction-red.log`, exit1, backup3/3 passed in that run). Geometry probe measured54.375px copy +16px flex gap +44px Change button +24px padding +2px border =140.375px. The active flex row wraps the button below copy on mobile; `.viewing-intent-section.is-complete` supplies12px vertical padding. Keep the existing140px bound and all text/button dimensions. Mobile complete-state padding-block10px reduces actual height by4px to136.375px, without a height cap or overflow masking. The targeted unchanged assertion passes.

## Backup diagnosis

Ranked hypotheses: input replacement before blur; stale persistence after a successful edit; readiness/event ordering. Passive event probes captured connected input5, change5 and bubbled5. A storage-boundary stack captured a successful Watchlist-page setProgress write5 followed by a write3 from App.refreshWatchlistSnapshotsFromCatalog -> lifecycle.refreshSnapshotsFromCatalog -> save when the full catalog finished loading. The lazy App had loaded entry3 before the dedicated Watchlist lifecycle committed5. This is actual user edit loss, not simply a missing Tab or a test-readiness problem.

Local diagnostic artifacts: `probes.log`, `backup-probe.log`, `backup-passive.log`, `backup-boundaries.log`, `backup-stacks.log` under ignored output/playwright. Instrumented repeated success alone did not resolve the bug. Some exploratory repeats overlapped source edits and HMR, including a canceled download; those mixed runs are diagnostic artifacts, not final validation. All temporary event/storage/runtime instrumentation was removed.

Retained regression controls the network response at the existing browser seam, exports through the UI to initialize the lazy App, fills5 and Tabs, releases the full catalog response, waits for persisted Snapshot enrichment, reloads, and asserts visible5. `late-catalog-red2.log`: fails with visible3 instead of5, exit1. An earlier route targeted the wrong full JSON filename and was interrupted; not red evidence. Fix reloads the latest persisted lifecycle before Snapshot enrichment only on the dedicated Watchlist page. No sleeps, retries, skip, weakened assertions or private-method test calls.

## Final validation

Pending final integration and checks below. No ticket or parent closure is implied.

### Integrated checks and evidence

- Fix commit `7dcb353`; merge commit `bc01232d5cd64006879cb5a971b810c20f3635b1` integrates `f87c414146fd9edd3279dd7de02395d84a09e8c1`. Ancestry check passed. This includes the independent Watchlist enlarged-text implementation, without duplicating its CSS work.
- Pre-merge corrected critical-flow command: `bunx playwright test --config output/playwright/resolution.config.js test/e2e/critical-flows.spec.js --grep 'full catalog arriving|backup roundtrip|selected viewing intent collapses' --repeat-each=5 --workers=1 --output output/playwright/repeated-green`, port43423: **15 passed**, exit0. Five passes each of the unchanged original backup/summary cases and new delayed-catalog regression.
- Final development: same Chrome wrapper, port43424, workers2, output `output/playwright/merged-development`; rating-evidence, critical-flows, focused-mobile-discovery, mobile-filter-sort, promoted-watching, watchlist-reflow and all five first-visit suites: **61 passed**, exit0,4.7m. Includes original backup and deterministic delayed-catalog regression on merged runtime.
- Final production: `bunx playwright test --config output/playwright/resolution-prod.config.js --workers=2 --output output/playwright/merged-production`, strict port43425, installed Chrome: **33 passed**, exit0,3.0m. Covers production-smoke, rating-evidence, watchlist-reflow, promoted-watching and focused-mobile-discovery. No browser download.
- Merged `bun run test --timeout 30000`: **309 passed**,0 failed across73 files, exit0. `bun run typecheck`, `bun run data:validate`, `bun run build`: each exit0. Python launcher tests and baseline-enforced data validation succeeded. Data warnings remain baseline-governed; no provider refresh performed.
- Completed-distribution `check:dist-assets`, `check:runtime-preview`, `check:dist-size`: each exit0. Runtime full index3.46MiB/3.60MiB; distribution26.12MiB/27MiB. First asset-check attempt ran before static copying completed and failed missing dist/sw.js, exit1; this was invocation ordering, corrected by waiting for build exit0 before the final checks. No source fix was made for that setup failure.
- Logs remain locally under ignored `output/playwright/merged-*.log`, plus red/green/probe logs named above. Wrapper configs remain locally in output/playwright; development imports the repository config, sets testDir `../../test/e2e`, webServer.cwd `../..`, and channel `chrome`. Production imports the existing production config with the five suite names above, cwd `../..`, strict port43425 and Chrome. No retries or skipped assertions.

### Rendered review and limits

Inspected contact sheets assembled from actual merged-development PNGs with view_image: `qualifiers-inspection.png`, `because-inspection.png`, `summary-inspection.png`, `watchlist-inspection.png`. These cover1280x720 and390x844, both themes, normal/200% root text. Source PNGs remain in their respective test-result directories under `output/playwright/merged-development/`; corresponding production PNGs remain under merged-production. Original rating screenshots also remain in `.scratch/ui-design/evidence/02/`.

Unavailable/limited/unknown/provisional evidence and Community Score labels wrap with their scales. Active summary wraps copy and retains Change; enlarged mobile summary grows naturally rather than clipping to the normal-text bound. Merged reflow tests verify390px whole-page width and essential progress/data actions at200% in both themes, plus desktop; separate reflow acceptance is now verified here. Existing offline/update/keyboard notices overlap parts of some captures. Enlarged desktop Because-you-watched titles retain existing clipping and desktop header search/sort labels clip; those are recorded limitations, not claimed fixed or proven new regressions. Screenshot inspection is not an accessibility compliance audit, external-provider verification or measured user outcome.

All four actionable content/maintainability review findings and the two diagnosed critical-flow failures are resolved by the evidence above. The separate reflow result is integrated and verified. Ticket and parent status values remain unchanged; no ticket/parent closure, root merge, PR, watch, or worktree removal. Final evidence-only commit and final ancestry/cleanliness checks follow.
