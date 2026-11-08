# Tickets 01–03 integration, 2026-11-08

Integration branch: `feat/mobile-discovery-ui`. Started clean at `5a59095a9977899f587ab5db8bdaee6954ca1b16`, containing ticket02 implementation and evidence. Read `docs/ui-design-spec.md` and the source resolution records for tickets01/03 before merging. Ticket and parent statuses remain unchanged. Final integration review follows tickets04/05.

## Preserved history

- Source `t3/mobile-filter-sort-1` verified at `0ca1f5521e0996fd0c36f38885290424704bd6c4`. Its implementation `ceb5f2b80a65cdb4650e9cdb1737defa733ae2eb` and separate evidence commit remain ancestors.
- First normal `--no-ff` merge: `22460887cb148dfb70bf5498369d9711d10cd5f6`, parents initial integration and ticket01 head.
- Source `t3/mobile-discovery-landing-1` verified at `e82301b99cbd19e51a2f20910191068b5de46372`. Implementation `bce9079b9fafb829fa2839274d394a31391f71d5` and separate evidence commit remain ancestors.
- Second normal `--no-ff` merge: `7c37c4da07b3bfd4f49cafd4402d9bbccac45ff8`, parents first merge and ticket03 head. Authorized escalation was needed for Git metadata access.
- Both sources fork at `511769ce2a7872b8b8b308adca88b04b90b7201f`. Both source heads and the initial integration head passed `git merge-base --is-ancestor ... HEAD` after merging.
- No textual conflicts. Automatic merges preserved ticket02 rating terminology/scales, ticket01 shared `currentSort` and synchronized controls/presets, and ticket03 compact hierarchy. No reset, force operation, or worktree removal.

## Integration adjustment

Initial three-slice browser run: 13 passed, 3 failed. Ticket01 assertions still expected `Highest episode rating strength` and `Current order: Highest community rating`. Actual UI correctly used ticket02's `Highest Episode Rating Strength (/100)` and `Current order: Highest Community Score (MAL, /10)`. Updated only those three test assertions; no production-label rollback or application change.

## Checks on merged tree

- `bun run typecheck`: passed.
- `bun test --preload ./test/setup.js test/integration/app-discovery.test.js test/unit/discovery.test.js test/unit/discovery-improvements.test.ts test/unit/detail-presentation.test.js test/integration/app-render-security.test.js test/recommendations.test.js --timeout 30000`: 22 passed, zero failed.
- `bun run test --timeout 30000`: 306 passed, 3 failed out of 309. Failures: `data:build launcher preserves catalog output behavior`, `data:regenerate command preserves embedded data output through migration launcher`, `data:validate:strict launcher preserves validation behavior`. Targeted reruns of their actual files (`python-build-catalog-command.test.js`, `python-regenerate-data.test.js`, `python-validate-command.test.js`) reproduced each failure with `Python 3 is required. Tried the local .venv, python, python3, and py -3.` These remain failing environment-dependent checks; no baseline execution/comparison is claimed.
- `REKONIME_E2E_PORT=43212 bunx playwright test test/e2e/mobile-filter-sort.spec.js test/e2e/rating-evidence.spec.js test/e2e/focused-mobile-discovery.spec.js --workers=1`: final 16 passed. Covers shared sort, presets, order, filter/reset/URL, focus, unmodified taste/intent, narrow layouts, score evidence and compact hierarchy. Missing-score fixtures log a detail catalog JSON fallback error while their visible unavailable-state assertions pass.
- `REKONIME_E2E_PORT=43211 bunx playwright test test/e2e/critical-flows.spec.js test/e2e/first-visit-shortlist.spec.js test/e2e/first-visit-selection.spec.js test/e2e/first-visit-dismissal.spec.js test/e2e/first-visit-taste.spec.js test/e2e/first-visit-save.spec.js --workers=2`: 27 passed. Includes the source-recorded `home renders catalog grid` concern, which passed here. No baseline comparison is claimed.
- `bun run build`: passed. `check:dist-assets`, `check:runtime-preview`, `check:dist-size`, and `git diff --check`: passed.
- Production touch: standard config attempt failed before assertions because its default headless-shell executable was missing; its teardown hung and was interrupted. Chrome retry initially encountered occupied port4174. Temporary config importing `playwright.prod.config.js`, using installed `channel: 'chrome'` and port43213, then ran `--grep 'mobile filters' --workers=1`: 1 passed, including touch sort/apply/reopen, menu and sidebar. Temporary config removed after use. No full production suite claimed.
- T3 shared preview status reported unavailable; used the repository Playwright regression seam. Inspected generated 320px light Filter & sort and 390px dark 200% evidence screenshots. Full selected sort wording wraps below the clipped native select; expanded evidence retains names/scales and unknown total. Generated rating images moved into ignored `output/playwright/integration-rating/`; other captures remain in ignored `test-results/` and `output/playwright/integration-prod/`.

## Pending concern

Ticket03's source evidence measured full-page scroll width **407px at a 390px viewport with 200% root text**, in both themes. This is still pending final review/fix. It was not remeasured in this merger pass. Passing recommendation-card bounds and screenshots do not certify page-wide reflow. No overflow hiding, skipped failing assertion, baseline attribution, ticket closure, or accessibility-compliance claim was added. Full integration review remains after tickets04/05.
