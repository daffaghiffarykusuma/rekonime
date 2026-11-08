# 01: Make mobile catalog filtering and sorting directly accessible

**What to build:** Let a mobile catalog browser choose filtering and explicit sorting in one Filter & sort sheet, with predictable results and the same state as desktop controls.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [x] Mobile users can open Filter & sort and directly select every supported catalog sort option.
- [x] Reopening shows the current selection, and retained desktop controls share the same sort state.
- [x] Applying controls produces the expected catalog order while preserving existing presets, filter application/reset, summaries, pagination, and URL behavior.
- [x] Wording distinguishes catalog ordering from personalized ranking; sorting does not mutate Viewing Intent or saved Taste Profile.
- [x] Keyboard operation, programmatic names, focus return, and scroll locking reuse existing Runtime Capabilities.
- [x] Browser tests at the approved seam demonstrate a nondefault sort, result order, reopening, and preserved filter behavior, with a recorded failing-before/passing-after TDD cycle.
- [x] Desktop/mobile rendered inspection covers both themes and narrow layouts; relevant production touch coverage, type checking, and affected checks pass or documented baseline limitations remain explicit.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
## Resolution notes

Implementation is ready for parent integration review; status intentionally remains `in-progress`. Implementation commit: `ceb5f2b80a65cdb4650e9cdb1737defa733ae2eb`.

- Baseline ancestry confirmed before editing: `git merge-base --is-ancestor 511769ce2a7872b8b8b308adca88b04b90b7201f HEAD` and `git merge-base --is-ancestor feat/mobile-discovery-ui HEAD` both exited 0. No checkout or worktree was created. Recovered only the useful browser test from `C:/Users/Lenovo/.t3/worktrees/rekonime/t3-d0d74e1b`; that checkout was left untouched. Installed this checkout's dependencies with `bun install --frozen-lockfile`.
- The sheet exposes the same three catalog sort options and `currentSort` as desktop. Changing either control and applying a preset synchronizes both controls. Sorting retains the existing immediate application, pagination reset, filter reset and URL contracts. No score labels, recommendation algorithm, homepage/card layout, storage schema or other tickets changed.
- Existing Runtime Capabilities still own modal keyboard behavior, scroll locking and focus return. The sheet explains the distinction between catalog order, Discovery ranking, Viewing Intent and saved Taste Profile. At 320px, a wrapping current-order summary makes the full selected label readable with enlarged text.

### Red/green evidence

Browser runs reused the compatible old binaries through `PLAYWRIGHT_BROWSERS_PATH=C:/Users/Lenovo/.t3/worktrees/rekonime/t3-d0d74e1b/.scratch/playwright-browsers`. No binaries, caches, helper scripts or log files are included in Git.

1. RED: `REKONIME_E2E_PORT=4187 bun run test:e2e test/e2e/mobile-filter-sort.spec.js` failed waiting for the missing `Filter & sort` button. The first attempt on default port 4173 was blocked by an occupied port and is not red evidence.
2. GREEN: after implementing the shared control, the same behavior test passed in the combined browser run. It observes known fixture order Beta/Gamma/Alpha by community rating, Alpha/Gamma/Beta by episode strength, reopening, desktop synchronization, Action filtering, URL and active summary, reset semantics, keyboard operation, focus return, unchanged Viewing Intent, Discovery picks and Taste Profile. A native select must release focus before Escape closes the sheet; the recovered test was corrected accordingly.
3. Render-driven RED: `REKONIME_E2E_PORT=4188 bun run test:e2e test/e2e/mobile-filter-sort.spec.js -g 'dark at 320px'` failed because the wrapping current-order summary was missing. GREEN: the same suite with `--workers=1` passed all 7 tests after adding that summary.
4. Extended preset regression: `REKONIME_E2E_PORT=4190 bun run test:e2e test/e2e/mobile-filter-sort.spec.js -g 'catalog sheet'` passed with Community favorites and Stable episode ratings preset synchronization. An intermediate assertion wrongly expected the preset label as the sort label; source inspection confirmed the existing preset owner maps it to Highest episode rating strength. That failed assertion is not claimed as an implementation defect or TDD evidence.

### Validation and rendered inspection

- `bun run typecheck`: passed, including after the final source changes.
- `bun run test --timeout 30000`: 309 passed, 0 failed. The first `bun run test` attempt had 298 passes and 11 failures under the default 5-second timeout, in untouched statistics, catalog, score-refresh, distribution-budget and Python launcher tests. The longer-timeout rerun passed them all. An initial unscoped `bun test` was exploratory, not the repository's normal test command.
- `REKONIME_E2E_PORT=4187 bun run test:e2e test/e2e/mobile-filter-sort.spec.js test/e2e/critical-flows.spec.js --workers=2`: 23 passed, 1 failed. Advanced filtering, Discovery-to-Watchlist, imports, restore/progress, search and detail coverage passed. The untouched `home renders catalog grid` scenario failed looking for `.card-cover` at line 418. No baseline checkout execution was performed, so this is recorded as an unrelated existing-test failure, not a proven baseline pass/fail comparison.
- Final presentation suite: `REKONIME_E2E_PORT=4188 bun run test:e2e test/e2e/mobile-filter-sort.spec.js --workers=1`: 7 passed. Final extended behavior/preset test on port 4190: 1 passed.
- Production touch: `PLAYWRIGHT_BROWSERS_PATH=... bunx playwright test --config .scratch/ui-design/playwright.prod-ticket01.config.js --grep 'mobile filters'`: 1 test passed. Temporary config reused the production config with port 4189 and repository cwd; no helper config is staged. Sorting was exercised through touch, applied, reopened and retained before existing mobile menu/sidebar checks.
- Vite build and `node tools/copy-static.js` completed. `bun run check:dist-assets`, `bun run check:runtime-preview`, and `bun run check:dist-size` passed after static copying completed. Initial asset checks ran before static copying had finished and reported missing files; those are superseded by the completed-artifact checks. `bun run build:verify` initially stopped at `check:build-clean` because intended tracked edits were uncommitted. Clean-tree check: `bun run check:build-clean` passed after committing the intended changes.
- `bun run data:validate` remains blocked: Python 3 is unavailable in this environment. This is separate from the passing Python-launcher fixture tests.
- Playwright screenshots were inspected with `view_image`, not inferred from source: `output/playwright/ui-ticket-01/filter-sort-dark-1280.png`, `filter-sort-light-1280.png`, `filter-sort-dark-390.png`, `filter-sort-light-390.png`, `filter-sort-dark-320.png`, and `filter-sort-light-320.png`. Desktop is 1280x720, mobile 390x844, narrow 320x844 with 125% root text size. Both themes show readable selected order, scope explanation, available sheet scrolling and reachable fixed actions without horizontal overflow. Initial narrow screenshots exposed native-select text clipping; the revised screenshots show the full wrapping current-order summary. Screenshots and automated checks do not establish accessibility compliance or measured user outcomes.
- The standard native select still clips long option text at enlarged narrow widths; the full selected label is repeated immediately below it at 320px. Existing close-button placement and the rest of the sheet were retained.

### Integration handoff

Integration sync: After committing, `git merge feat/mobile-discovery-ui` reported already up to date; latest integration tip remains `511769ce2a7872b8b8b308adca88b04b90b7201f`. Parent owns merging this branch into integration and closing the ticket. Keep this worktree available for merger/cleanup.
