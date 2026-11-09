# Ticket03 page overflow resolution

Prepared checkout: `C:/Users/Lenovo/.t3/worktrees/rekonime/t3-90847132`, branch `t3/ticket03-mobile-overflow`. Before edits, HEAD was `b978ae6bc99f05777fcd05b98a953658e1ec00c7`, and `git merge-base --is-ancestor b978ae6bc99f05777fcd05b98a953658e1ec00c7 HEAD` returned 0. No checkout, branch, or worktree setup was performed.

Read the UI specification, ticket03, integration-01-03 record, GLOSSARY, TDD and diagnosing-bugs guidance. Approved seam is the real browser Discovery/catalog/Watchlist journey. No new test interface, provider requests, or internal mocks were introduced. Dependencies installed with `bun install --frozen-lockfile`. Shared preview reported `available:false`; repository Playwright used installed Chrome without downloads.

## Reproduction and red

Temporary root `playwright.overflow.config.js` imports `playwright.config.js` and sets `use.channel: 'chrome'`. It is not committed. All commands below use that config and the existing fixtures.

`REKONIME_E2E_PORT=43224 bunx playwright test --config playwright.overflow.config.js test/e2e/focused-mobile-discovery.spec.js --grep '390px' --workers=1`

Both dark and light failed the new page-width assertion before the CSS edit: expected <=390, received **407**. The scenario uses the existing deterministic long-title/partial-evidence catalog fixture, selects Help me unwind with the keyboard, expands evidence, then sets root font size to 200%. A repeat dark-theme run reproduced 407. This is actual red evidence, not a browser setup failure.

The regression now asserts normal page width and enlarged page width at 390x844 and 1280x720 in both themes. It also checks that Change, Want to watch, Skip for now, and Filter & sort have horizontal bounds inside the viewport, are visible/enabled, and pass Playwright trial-click actionability after vertical scrolling. Existing goal selection, keyboard operation, evidence, and recommendation-card bounds remain exercised.

## Cause and isolation

Ranked hypotheses were a nonwrapping control row, flex/grid minimum sizing, and offscreen positioned content. DOM geometry identified:

- `#active-viewing-intent [data-action="change-viewing-intent"]`: left 265.21875, right **406.546875**. Its parent is a full-width flex row with a 1rem gap and no wrapping. The completed intent summary bypasses the existing mobile column rule, which only matches `.viewing-intent-section:not(.is-complete)`.
- A catalog `N/A /100` stat reached right 405.453125 within its card, but did not contribute to document scroll width in the isolated probe. Preset cards extended farther right inside their existing horizontal scrolling container. The closed sidebar was positioned left of the viewport. Geometry alone does not establish that each out-of-viewport descendant expands the document.

Independent temporary style probes, removed after measurement:

| Probe | Document scroll width |
| --- | ---: |
| No change | 407 |
| Intent row `flex-wrap: wrap` only | 390 |
| Catalog stat wrapping only | 407 |
| Both | 390 |

The minimal production fix adds only `flex-wrap: wrap` to `.active-viewing-intent`. It allows Change to move below the summary when needed. No horizontal overflow suppression, font-size reduction, removed controls, palette/font changes, or ticket04/05 behavior changes.

## Verification and boundaries

First green command: port43225, same config, `test/e2e/focused-mobile-discovery.spec.js --workers=1`: **6 passed**. Page width passed at both viewport sizes/themes, and save/skip/filter controls remained actionable at 200%. The final suite also explicitly checks Change and captures the enlarged intent summary.

`bun run typecheck`: passed. Final focused command on port43225 with `--workers=2` covered `focused-mobile-discovery`, `mobile-filter-sort`, `rating-evidence`, `first-visit-shortlist`, `first-visit-selection`, `first-visit-dismissal`, `first-visit-taste`, and `first-visit-save`: **26 passed (2.9m)**. One missing-rating fixture logged the existing catalog JSON fallback error while its visible unavailable-state assertions passed. `git diff --check`: passed.

Inspected eight green screenshots with view_image: `active-goal.png` and `large-text.png` for 390px/1280px, dark/light. Normal desktop retains comparison columns, mobile retains compact covers and wrapped intent copy. Enlarged recommendation text and expanded evidence remain readable with honest unknown totals. Fixture covers intentionally use image-unavailable placeholders. The desktop long title retains its existing ellipsis. Screenshots do not establish accessibility compliance or participant outcomes.

Local captures are in ignored `output/playwright/overflow-red/`, `output/playwright/overflow-green/`, and final `test-results/focused-mobile-discovery-D-*/`. They are review artifacts in this checkout; this Markdown and the browser assertion provide committed reproduction evidence. No full production suite, build, exhaustive accessibility audit, or live-provider verification is claimed. Existing integration-log Python-dependent failures were not rerun for this CSS change.

Also inspected final `large-text-intent.png` at both viewport sizes/themes. Change wraps below the full summary on mobile and remains beside it on desktop. Existing enlarged header branding is vertically crowded, and the desktop search placeholder/native sort text is clipped by its field; these did not expand page width or block tested essential controls and were left outside this fix. Untracked `.scratch/ui-design/evidence/02/` images were generated during the rating suite and were left untouched and unstaged.
