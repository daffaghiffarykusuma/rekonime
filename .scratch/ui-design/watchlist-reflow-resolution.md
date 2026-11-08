# Watchlist enlarged-text reflow resolution

Status: locally verified; ticket 05 remains in-progress for parent integration verification.

## Checkout and scope

- Tool-prepared checkout: `C:/Users/Lenovo/.t3/worktrees/rekonime/t3-e60d6fdf`, branch `t3/watchlist-reflow-fix`.
- Started clean at `0eaf5d24a76dbb516458d3ecc26f5d7d2f69e7cb`; `git merge-base --is-ancestor 0eaf5d24a76dbb516458d3ecc26f5d7d2f69e7cb HEAD` passed before changes.
- Read the specification, GLOSSARY, ticket05, integration-05, TDD and diagnosing-bugs instructions. Used the already approved browser Discovery/Watchlist seam. No branches, worktrees, subagents, environment settings or shared font/palette changes were created.

## Diagnosis and TDD

- Added `test/e2e/watchlist-reflow.spec.js` before production changes. Reuses the existing backup-roundtrip/catalog fixture selection and persisted version-1 Watching entry at progress 3, with AniList responses controlled at the network boundary.
- Red command: `$env:REKONIME_E2E_PORT='4286'; bun x playwright test --config .scratch/ui-design/playwright-reflow.config.mjs watchlist-reflow --grep '390px.*200%' --reporter=list`. Both themes failed the page-width assertion: **576px > 390px**. Geometry: content starts x197, status label x226..434 (208px minimum), progress total x388.375..484.375, increment button x495.5625..575.5625. This reproduced the reported overflow behavior; the exact historical 481px width was not reproduced in this environment.
- An unchanged production build and original production Manage data scenarios also reproduced overflow. PNG widths at 390px/200% were **561px dark, 527px light**; desktop was 1280px. Differences between runs were observed during font loading, so the retained regression waits for `document.fonts.ready`. These are actual measurements, not a claim of reproducing exactly 481px.
- Ranked hypotheses before probes: insufficient space beside the cover; nonwrapping stepper; intrinsic child minimum width. Temporary single-variable browser CSS probes measured baseline 552px with content width172 and stepper width114/scroll326. Moving content across the row reduced page width to390 but left stepper scroll339 in290px. Wrapping only the stepper left434px page width from the status label. Removing only the label minimum still left574px page width. Full-width content plus stepper wrapping produced390px and no content-panel overflow. Probe removed afterward.
- Minimal fix: narrow rows use wrapping flex layout, retaining the 5.5rem cover and giving the content a 12rem preferred basis. At normal text they remain side by side; enlarged content moves below the cover. The stepper wraps in available space. No overflow masking, text reduction, removed controls, progress rules or data-operation code changes.
- Green browser test checks page width with Manage data closed/open, bounds and actual actions for increment/decrement, status changes, editable progress and persistence after reload, Watching filter activation, keyboard disclosure, data button actionability, and a real export containing the edited progress.
- Test refinement exposed an incorrect expectation: moving Watching -> Planned -> Watching resets progress to0 under the existing lifecycle. Corrected the expectation to0; production semantics were preserved. The mixed run was stopped after six existing scenarios passed and three new cases failed this expectation; it is not counted as a successful run.

## Reproducible local runners

Frozen Bun install succeeded. Used installed Chrome, without downloading a browser. Bun launches Playwright; Vite/browser execution uses the existing Node boundary. Local runner configs are uncommitted and derive from `playwright.config.js`, set testDir to `../../test/e2e`, webServer cwd to the checkout, workers1 and launchOptions channel chrome. Development port4286; production preview port4287. Screenshots and geometry attachments remain under ignored `test-results/`.

Validation and final integration evidence follows below.

## Validation before integration merge

- `bun run typecheck`: exit0.
- Focused Watchlist/data suite (same 13 files listed in integration-05): **68 passed, 0 failed**, exit0.
- Development reflow matrix: **8 passed**, exit0 (53.2s), widths390/1280 at100%/200% in light/dark, including all control behavior above.
- Existing Discovery-to-Watchlist, Watchlist persistence, Manage data lazy loading, MAL conflict/cancel/repeat, malformed import recovery, and backup roundtrip browser scenarios: all six reported passes in the mixed run. The mixed command was interrupted after the unrelated incorrect test expectation described above; a clean final regression command is recorded below.
- Screenshots: `test-results/reflow/watchlist-reflow-*/closed.png` and `open.png` (16 captures). Inspected via `view_image` in all eight viewport/theme/text-size combinations. Enlarged mobile body stacks below the cover; the stepper wraps and its input, total, and both buttons remain visible. At100% the row remains side by side. The existing offline/update notices obscure some content in full-page captures; successful browser interactions and geometry checks separately establish control access. These screenshots do not establish accessibility compliance.

## Final integrated result

- Implementation commit: `b69714a`. Latest local integration tip `6d71322bf6d4b038dc67d8f763f72858b124839c` merged without conflicts as `d97c3e6aff216d2274ad5ee3a24b9ca6aae99c3c`. Both that tip and required starting head pass `git merge-base --is-ancestor ... HEAD`. No merge into root, PR, watch, worktree removal or subagent.
- Post-merge `bun run typecheck`, `bun run build`, `bun run check:dist-assets`, `bun run check:runtime-preview`, `bun run check:dist-size` and `git diff --check`: passed, exit0. Distribution26.12MiB /27MiB.
- Post-merge development command: `$env:REKONIME_E2E_PORT='4286'; bun x playwright test --config .scratch/ui-design/playwright-reflow.config.mjs watchlist-reflow critical-flows mobile-filter-sort --grep 'Watchlist|watchlist|MAL conflict|MAL malformed|mobile|Filter' --reporter=list`: **22 passed**, exit0 (2.4m). Includes eight reflow cases, seven existing Discovery/Watchlist/data/filter scenarios, and seven mobile filter/sort cases.
- Post-merge production command: `bun x playwright test --config .scratch/ui-design/playwright-reflow-prod.config.mjs watchlist-reflow production-smoke --grep 'Watchlist|watchlist' --reporter=list`: **13 passed**, exit0 (1.6m). Includes eight reflow cases, four existing Manage data theme/width cases and production browse/search/detail/Watchlist flow.
- Production screenshots: `test-results/reflow-prod-final/watchlist-reflow-*/closed.png` and `open.png`; all eight open variants inspected via `view_image` after integration. The existing production scenarios additionally captured `watchlist-{390,1280}-{dark,light}-{100,200}-{closed,open}.png` beneath `test-results/reflow-prod-final/production-*`. PNG widths confirm390px mobile and1280px desktop at200% in both themes. Reflow tests assert those same page widths at100%/200%, closed/open, and control bounds/actions. Offline/update notices remain a separate rendered limitation; one desktop cover was still loading in a final capture. Neither changes the measured control reflow result.
- Full Bun suite and unrelated homepage rendered acceptance were not run or claimed. Ticket05 remains in-progress with parent integration verification pending. Its historical enlarged-text caveat now points to this verified local resolution.

### Local config reconstruction

Development wrapper imports `../../playwright.config.js` and overrides `testDir: '../../test/e2e'`, `workers:1`, `use.launchOptions: {channel:'chrome'}`, `webServer.cwd: process.cwd()`, and `outputDir:'../../test-results/reflow'`. Retains the base config's environment-selected port4286.

Production wrapper uses the same overrides with `testIgnore:undefined`, baseURL `http://127.0.0.1:4287`, webServer command `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4287 --strictPort`, port4287, and outputDir `../../test-results/reflow-prod-final`. Local wrappers remain untracked for replay; no browser cache or screenshots committed.

- Post-merge focused Watchlist/data regression rerun: **68 passed, 0 failed across13 files**, exit0 (3.40s).
