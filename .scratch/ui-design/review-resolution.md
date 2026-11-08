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
