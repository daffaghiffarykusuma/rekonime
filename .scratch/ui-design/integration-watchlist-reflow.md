# Watchlist reflow integration

Recorded on 2026-11-08 in the shared root checkout on `feat/mobile-discovery-ui`.

## Merge and ancestry

- Verified the root was clean at the expected `ec26f355cc121aa1d997400eb962da7e935aeb3a` before mutation.
- Verified `t3/watchlist-reflow-fix` resolved to requested source head `1942456ee8f303c087b5ff2c6449db85164c919c`.
- Read `docs/ui-design-spec.md`, the source `.scratch/ui-design/watchlist-reflow-resolution.md`, and source ticket `.scratch/ui-design/issues/05-watchlist-manage-data.md` before merging. Also read the previous `integration-05.md` record for the regression command and historical evidence boundaries.
- Before merging, the original integration tip and implementation `b69714a` were verified ancestors of the source head.
- Ran `git merge --no-ff 1942456ee8f303c087b5ff2c6449db85164c919c -m "Merge Watchlist enlarged-text reflow fix into integration"`. Git used ort without conflicts.
- Merge commit: `58b3fcab7abf49f98971557193cd818b3d09b00a`.
- First parent: `ec26f355cc121aa1d997400eb962da7e935aeb3a`. Second parent: `1942456ee8f303c087b5ff2c6449db85164c919c`.
- Post-merge ancestry checks passed for the original integration tip, requested source head, implementation `b69714a`, and source's latest integration merge `c7362a74cea1fd46dcc4e4cd16721efdd08da3fe`.
- `git diff --exit-code 1942456ee8f303c087b5ff2c6449db85164c919c HEAD` passed immediately after merging. The merged tree exactly equals the source tree, preserving implementation, evidence and integration ancestry.

## Checks run in the merged root

- `bun run typecheck`: passed, exit 0.
- Focused Bun regression below: **68 passed, 0 failed across 13 files**, exit 0, 9.24 seconds.
- `git diff --check HEAD^1 HEAD`: passed, exit 0.
- `git status --porcelain=v1`: empty after merge and checks, before adding this record.

```powershell
bun test --preload ./test/setup.js test/unit/watchlist-page-interactions.test.js test/unit/watchlist-page-renderer.test.js test/unit/watchlist-page-runtime.test.js test/unit/watchlist-lifecycle-runtime.test.js test/unit/watchlist-state.test.js test/unit/watchlist.test.js test/contracts/watchlist-lifecycle-contract.test.ts test/unit/personal-data-restore.test.ts test/unit/mal-watchlist-import.test.ts test/unit/watchlist-import-workflow.test.js test/unit/import-limits.test.ts test/integration/app-personal-data-restore.test.js test/integration/app-mal-watchlist-import.test.js
```

## Source evidence and limits

- The committed source resolution records **22 development browser passes**, **13 production browser passes**, and **68 focused Bun passes across 13 files**. Both browser commands exited successfully. Each browser run includes eight reflow cases spanning 390/1280px, light/dark and 100%/200% root text, with disclosure closed/open, control bounds and actions, progress persistence and real backup export.
- Source evidence records actual **390px page width at 200% root text in a 390px viewport in both themes**, including final production PNG widths and browser geometry assertions. Source screenshots were inspected there; no new screenshot inspection or browser execution occurred in this merger task.
- The source's failing-before regression measured **576px page width in the 390px viewport**, distinct from ticket 05's historical **481px** measurement. The source explicitly did not reproduce exactly 481px. Other pre-fix production captures measured 561px dark and 527px light during font loading; the retained regression waits for fonts. Preserve these as separate measurements, not interchangeable reproductions.
- Source records post-integration typecheck, build, dist-assets, runtime-preview, dist-size and diff checks as successful, with distribution 26.12 MiB against 27 MiB. Source later merged `ec26f35` with only the review document added; its tested runtime/test files did not change. These source checks were not repeated here beyond root typecheck, focused regression and Git checks.
- No full browser rerun was required for this conflict-free merge with an identical source tree. No full Bun suite, build, broader homepage acceptance, accessibility compliance or measured user outcomes are claimed by this integration.
- Existing offline/update notices obscure some source captures, and one desktop cover was still loading. Source geometry/actions provide separate evidence of control access. Historical interrupted mixed runs and the earlier development cleanup stall remain interrupted commands, not clean passes.
- Ticket 05 remains in-progress with the final acceptance item unchecked. Parent and other tickets remain open. This record adds integration evidence without closing them or extending acceptance beyond the source's recorded scope.

## Handoff

This record is committed separately after the merge. The final integration HEAD is the commit containing this record. The separately running final-review implementation must merge that latest integration HEAD into its own branch before its final report; this merger does not edit that active worktree or claim that follow-up merge has occurred.

No PR, watch, subagent, reset, force operation or worktree removal was performed. Only the shared root integration branch was changed.
