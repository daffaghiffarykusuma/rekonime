# 04: Promote one recently updated Watching entry

**What to build:** Give returning viewers one compact homepage entry for their most recently updated Watching title, with accurate progress wording and access to the full Watchlist.

**Blocked by:** None (can start immediately).

**Status:** in-progress

Claimed by `t3/promote-watching-home-entry`. Required integration baseline
`5a59095a9977899f587ab5db8bdaee6954ca1b16` is an ancestor of HEAD; initial checkout clean.
Approved seams: browser Discovery/Watchlist journey and existing Continue watching public model.
Ticket remains open pending parent integration verification.

- [x] The promoted homepage section shows at most the single most recently updated Watching entry and a View all link to the Watchlist.
- [x] Zero recorded progress uses Start watching; positive progress uses Continue watching. Planned, Completed, and Dropped entries are excluded.
- [x] With no Watching entries, the section is absent; the one-entry limit does not restrict other Watchlist or Airing Schedule views.
- [x] Existing progress controls, updates, Snapshot fallback, and explicitly unknown episode totals remain correct without automatically changing lifecycle state or introducing playback.
- [x] Approved browser coverage verifies homepage presentation, View all, and progress tracking; existing model-interface tests cover deterministic ordering and eligibility where needed, with recorded red/green cycles.
- [x] Desktop/mobile inspection covers zero, positive, and multiple-entry cases and both themes; affected checks and type checking are recorded.

## Implementation and validation, 2026-11-08

Implementation commit: `2f38721`. Merged integration tip
`b978ae6bc99f05777fcd05b98a953658e1ec00c7` into the assigned branch in `16cb4af`.
No merge into integration, new branch, worktree, schema, backend, model interface,
or playback behavior. Remains **in-progress** until parent integration verification.

- Red/green slice 1: valid persisted Snapshot fixtures produced **2 articles instead of 1**.
  Applied the one-entry limit only in the homepage renderer, retained the existing
  Continue watching model and added View all. Browser test passed, including navigation
  to all five Watchlist entries. An initial invalid Snapshot fixture was corrected
  before counting this as a meaningful red.
- Red/green slice 2: zero-progress Watching entry failed to expose a **Start watching**
  heading. Added progress-dependent heading and explicit unknown-total wording.
  Browser test passed through progress increment, reload, and Watchlist verification
  of progress 1 with status still Watching.
- Post-merge development: **7/7 passed** using
  `bun run test:e2e test/e2e/promoted-watching.spec.js test/e2e/critical-flows.spec.js -g 'promoted|homepage|zero progress|backup roundtrip' --workers=1`.
  Six new cases plus the existing backup/edit/restore/home-progress roundtrip.
- Post-merge production: **10/10 passed**, all four existing production smoke tests
  plus the same six promoted Watching cases. Used the existing production config
  with a temporary, uncommitted config that includes this ticket's spec and sets
  the web-server working directory to the checkout root.
- `bun run typecheck`, `bun run build`, `check:dist-assets`,
  `check:runtime-preview`, `check:dist-size`, and `git diff --check`: passed after merge.
- Normal Bun suite was run. Initial runs hit unrelated 5-second catalog/Python
  launcher timeouts. With `bun run test --timeout 20000`, pre-merge output was
  **309 passed / 0 failed**; post-merge was **306 passed / 3 failed**, all Python
  launcher checks reporting Python 3 unavailable (`data:build`, `data:regenerate`,
  `data:validate:strict`). No launcher or environment changes made. The existing
  Continue watching model, Watchlist Lifecycle, restore/import, and Airing Schedule
  tests passed in the post-merge run. This is not a claim of a fully green normal suite.
  Explicit focused rerun of `test/unit/discovery-improvements.test.ts`: **3/3 passed**.
  `bun run data:validate` separately reproduced the Python 3 unavailable limitation.
- The existing backup roundtrip initially failed twice while editing Watchlist
  progress, before visiting the homepage. It passed on baseline `5a59095`, passed
  on this implementation alone, and passed again after integration merge. Recorded
  as intermittent rather than hidden or changed in this ticket.
- Frozen Bun install; reused the compatible cached Chromium headless shell from
  `t3-d0d74e1b/.scratch/playwright-browsers`; no browser installation or committed cache.

Rendered inspection: Playwright screenshots in `.scratch/ui-design/evidence/04/`
cover `zero-multiple`, `positive-multiple`, and `positive-single`, each at 1280x720
and 390x844 in dark/light themes, with page context and section captures. Inspected
all 12 section combinations, representative page context, and mobile 200% root
text captures. Titles, totals, progress buttons, and View all wrap without clipping
inside this section. View all uses the existing button styling and the section
header wraps at increased text size. Screenshots do not establish accessibility
compliance. Ticket03's known whole-page 407px overflow at 390px with 200% root text
remains deferred; this ticket adds no overflow hiding or unrelated fix.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
