# Ticket 05 integration

Recorded on 2026-11-08 in the shared root checkout on `feat/mobile-discovery-ui`.

## Merge and ancestry

- Before merging, the root was clean at `b978ae6bc99f05777fcd05b98a953658e1ec00c7`.
- The local source ref `t3/watchlist-manage-data` resolved to the requested head `967264ed09ec4ff7ea2ae1aff8b7962b70bfca56`.
- Read `docs/ui-design-spec.md` and the source branch's `.scratch/ui-design/issues/05-watchlist-manage-data.md` before merging.
- Before the merge, both the original integration head and implementation `c577b3b0520937f9c83a6534c52a26e43ea0b899` were ancestors of the source head. The source head was not yet an ancestor of the root.
- Ran `git merge --no-ff 967264ed09ec4ff7ea2ae1aff8b7962b70bfca56 -m 'Merge ticket 05 Watchlist Manage data into integration'`. Git used the ort strategy without conflicts.
- Merge commit: `9703161134177a43555fd288c022763978f3999f`.
- First parent: `b978ae6bc99f05777fcd05b98a953658e1ec00c7`. Second parent: `967264ed09ec4ff7ea2ae1aff8b7962b70bfca56`.
- After merging, ancestry checks passed for the original root, requested source head, implementation commit, and source integration merge `d340884d09642c364a77ce2611e3df549900a81e`.
- `git diff --exit-code 967264ed09ec4ff7ea2ae1aff8b7962b70bfca56 HEAD` passed immediately after merging. The merged tree equals the source tree, preserving its implementation and evidence.

## Validation run in the merged root

- `bun run typecheck`: passed, exit 0.
- Focused Bun regression command below: **68 passed, 0 failed across 13 files**, exit 0.
- `git diff --check HEAD^1 HEAD`: passed.

```powershell
bun test --preload ./test/setup.js test/unit/watchlist-page-interactions.test.js test/unit/watchlist-page-renderer.test.js test/unit/watchlist-page-runtime.test.js test/unit/watchlist-lifecycle-runtime.test.js test/unit/watchlist-state.test.js test/unit/watchlist.test.js test/contracts/watchlist-lifecycle-contract.test.ts test/unit/personal-data-restore.test.ts test/unit/mal-watchlist-import.test.ts test/unit/watchlist-import-workflow.test.js test/unit/import-limits.test.ts test/integration/app-personal-data-restore.test.js test/integration/app-mal-watchlist-import.test.js
```

## Evidence boundaries and open acceptance concern

- Source ticket evidence records a successful production browser run with **8/8 passed**, plus build, runtime and asset checks. These were not repeated here because the merge was conflict-free and produced the same tree as the source head. No new browser or rendered-layout verification is claimed by this integration.
- Source development browser evidence reports four passing scenarios followed by a cleanup stall and interruption. That command must not be described as a clean successful exit.
- Watchlist at **200% root text has a measured page width of 481px in a 390px viewport**, in both themes according to source evidence. This remains an unresolved acceptance concern. This integration does not establish whether it predates ticket 05, and does not hide overflow or claim the concern is resolved.
- The full Bun suite was not run in this merger task. The focused suite and typecheck above are the checks performed here.
- Parent specification and all tickets remain open. Ticket 05 remains in-progress with its increased-text/rendered acceptance item unchecked. No worktrees, homepage overflow implementation, or ticket 04 implementation were changed. No PR was created and no monitoring was started.

This record is committed separately after the merge so the integration result can be reviewed independently.
