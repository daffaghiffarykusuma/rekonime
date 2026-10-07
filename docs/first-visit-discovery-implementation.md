# First-visit Discovery implementation

Integration branch: `feat/first-visit-discovery`. Application baseline: `8c1b3bf`. Scope: the [agreed specification](first-visit-discovery-spec-draft.md) and tickets 01–06 in `.scratch/first-visit-discovery/issues/`.

The implemented journey offers three initial picks, supported goal grouping, episode information before optional ratings, session skipping with recovery, deliberate lasting preferences with Undo, and a retained chosen title after a checked Planned save. Watchlist and Taste Profile reversals protect unrelated and newer changes. No playback, streaming availability, new catalog curation, or Watchlist recommendation pool was added.

## Engineering verification

Final integration verification is in progress. Feature-level runtime and browser checks passed before merge. Desktop 1280px and mobile 390px screenshots were inspected for the shortlist, action controls, chosen-title confirmation, lasting-feedback Undo, and session review/restore. Screenshot inspection identified a translucent failure toast; the review-fix branch makes notification surfaces opaque.

The first combined coverage run hit two default-timeout failures in existing large-data tests. `bun run test:coverage --timeout 20000` subsequently passed 287 tests across 71 files. The initial full browser run passed all new first-visit scenarios but exposed existing readiness races, a live-review API dependency, and production-only assertions selected by the development configuration. These are being verified separately after correction.

Security policy checks, catalog validation, repository hygiene, and eight Python golden fixtures passed. The initial combined build exceeded the existing 190 KiB App Shell budget. A concurrent user task is extracting detail presentation from the App Shell; its current build is within budget. Final verification must cover the combined committed result.

## Standards review

The review of `8c1b3bf...cc0c7db` found no documented-standard violations and one low-priority heuristic: Taste Profile duplicated feedback dispatch when computing mutation and Undo conflict evidence. The review-fix branch computes both together, preserving the no-op conflict regression.

## Spec review

The same review found one P2 defect: normalization could turn observed-only episode data into a supposedly declared count. The review-fix branch retains declared-count provenance through normalization, detail enrichment, and statistics calculation. Its public-flow regression first reproduced the defect, then passed after the correction. No other implementation omission or UX scope creep was identified.

## Human evidence

Ticket 06 remains blocked on participants. The user confirmed none are available and requested protocol preparation. The [comparison protocol](first-visit-study-protocol.md) and [blank observation template](first-visit-study-observation-template.md) are prepared. No session has been conducted or scheduled, and no participant observation or improvement claim is recorded. Three initial picks remains a design hypothesis. The parent specification stays open until actual observations and an evidence-based comparison are available.
