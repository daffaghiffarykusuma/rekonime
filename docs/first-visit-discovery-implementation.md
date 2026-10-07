# First-visit Discovery implementation

Integration branch: `feat/first-visit-discovery`. Application baseline: `8c1b3bf`. Final implementation: `1ddbcf0`. Scope: the [agreed specification](first-visit-discovery-spec-draft.md) and tickets 01–06 in `.scratch/first-visit-discovery/issues/`. Tickets 01–05 are complete; ticket 06 remains blocked on participant access.

The implemented journey offers three initial picks, supported goal grouping, episode information before optional ratings, session skipping with recovery, deliberate lasting preferences with Undo, and a retained chosen title after a checked Planned save. Watchlist and Taste Profile reversals protect unrelated and newer changes. No playback, streaming availability, new catalog curation, or Watchlist recommendation pool was added.

## Engineering verification

Desktop 1280px and mobile 390px screenshots were inspected for the shortlist, action controls, chosen-title confirmation, lasting-feedback Undo, session review/restore, and synthetic missing-data states. Failed-save feedback was checked over cover art in light and dark themes after making notification surfaces opaque. No-close-match alternatives, unknown episode counts, observed-only counts, and limited rating evidence remain explicit. Local screenshots are under `output/playwright/first-visit/` (ignored QA artifacts).

| Check | Result |
| --- | --- |
| TypeScript typecheck | Passed during integration and review fixes. |
| `bun run test:coverage --timeout 60000` | Final implementation: 290 passed, 0 failed, across 71 files. |
| Development browser suite, one worker | 28 passed; one initial catalog-readiness timeout was corrected, then `--last-failed` passed the remaining dismissal journey. All 29 scenarios verified across these runs. |
| Final shortlist browser checks | Both scenarios passed after the final explanation-copy change. |
| Production browser suite, one worker | All four scenarios passed on the final build. |
| `bun run build:verify` | Build cleanliness, distribution assets, runtime catalog, and size checks passed. App Shell: 184.3 KiB / 190 KiB. |
| Security and repository hygiene | Passed. |
| Catalog validation and Python golden fixtures | Validation passed; all eight golden fixtures matched. |

The browser commands used `--timeout=120000`. Earlier large-data coverage cases exceeded the default 5-second timeout, and one exceeded 20 seconds under machine contention. The final 60-second-limit coverage run completed in 11.61 seconds. Repository timeout defaults were not increased. The browser test for review contrast now controls the external review response; development configuration excludes production-only asset assertions.

Browser verification also exposed an initialization race: catalog-cache completion could close a title opened while detail code was loading. A controlled browser regression reproduced it; the App Shell now preserves the active opening. Concurrent commits `cd12b0f`, `c2fec8f`, and `730bd40` were preserved. The detail-presentation extraction in `c2fec8f` contributed to meeting the existing bundle budget; no budget was raised.

## Standards review

The review of `8c1b3bf...cc0c7db` found no documented-standard violations and one low-priority heuristic: Taste Profile duplicated feedback dispatch when computing mutation and Undo conflict evidence. Commit `46d1d0d` computes both together, preserving the no-op conflict regression. The Standards reviewer confirmed resolution. No open Standards findings remain.

## Spec review

The same review found one P2 defect: normalization could turn observed-only episode data into a supposedly declared count. Commit `46d1d0d` retains declared-count provenance through normalization, detail enrichment, and statistics calculation. Its public-flow regression first reproduced the defect, then passed after correction. The Spec reviewer confirmed resolution. No other implementation omission or UX scope creep was identified. Final visual inspection additionally prompted `ad50c7c`: generic explanations acknowledge missing or limited episode evidence without promising future data or inferring consistency from one rating; two decision regressions verify this.

Formal review totals: Standards one heuristic resolved; Spec one P2 resolved. Human validation remains separate and pending.

## Human evidence

Ticket 06 remains blocked on participants. The user confirmed none are available and requested protocol preparation. The [comparison protocol](first-visit-study-protocol.md) and [blank observation template](first-visit-study-observation-template.md) are prepared. No session has been conducted or scheduled, and no participant observation or improvement claim is recorded. Three initial picks remains a design hypothesis. The parent specification stays open until actual observations and an evidence-based comparison are available.

## Workspace cleanup

All seven implementation worktrees were removed from Git's worktree registry. Windows kept a loaded Rolldown native binary locked in six temporary dependency directories under `C:/Users/Lenovo/.codex/worktrees/rekonime-first-visit/`; those residual files could not be deleted. This task's browser and preview servers were stopped. Other running applications and the unrelated worktree were left intact.
