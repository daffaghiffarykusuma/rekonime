# 03: Make the Discovery homepage compact and focused

**What to build:** Help visitors reach a compact set of useful picks quickly, with supporting browsing available below the main journey.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [x] The initial landing uses a short introduction and compact optional Viewing Intent choices before useful picks; immediate selection and the active summary remain functional.
- [x] Mobile covers are shorter while titles, supported fit explanations, honest episode information, details access, and primary actions remain readable and operable.
- [x] Up to three initial picks, Show more picks, goal suggestions versus alternatives, Planned confirmation, Session Dismissal, lasting feedback, and Undo remain intact.
- [x] Seasonal picks, trending, genre exploration, and the catalog remain on the homepage under a quieter Browse anime area below the main picks; search and existing navigation targets remain accessible.
- [x] Existing palette, typography, themes, recommendation rules, and rating disclosure hierarchy are preserved.
- [x] Browser tests verify visible hierarchy and the discovery-to-selection journey at the approved seam, with a recorded failing-before/passing-after cycle for changed behavior.
- [x] Desktop/mobile inspection covers fresh/returning visits, active/no goal, long titles, unknown data, expanded evidence, keyboard use, and increased text size; record dimensions chosen through inspection and affected check results.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Coordinate shared homepage edits with other slices, but they are not prerequisites. Record implementation commit and actual validation evidence when closing.

## Implementation resolution (awaiting parent integration)

- Owner: implementation agent in branch `t3/mobile-discovery-landing-1`, checkout `C:/Users/Lenovo/.t3/worktrees/rekonime/t3-1478edb3`. Status intentionally remains in-progress; parent closes after integration.
- Confirmed baseline ancestry before editing: `git merge-base --is-ancestor 511769ce2a7872b8b8b308adca88b04b90b7201f HEAD` returned 0. Integration tip was that baseline when work began.
- Recovered only `test/e2e/focused-mobile-discovery.spec.js` from old checkout `t3-3949d84f`; old source had no edits. Old checkout was not modified. Dependencies installed with `bun install --frozen-lockfile`; no caches or helper configs are committed.
- Implementation: short landing copy, retained all three landing actions, compact optional goal panel, 160px mobile shortlist covers, unclipped mobile titles, named Browse anime region containing existing genre exploration, seasonal picks, trending, and catalog. Existing IDs and runtime handlers remain in place. No changes to ranking, scoring, Continue watching, filter/sort state, or Watchlist data tools.

### TDD and regression evidence

Approved seam: browser Discovery/catalog/Watchlist journey, using real runtime modules and existing data-route fixtures. No new application-wide test API or internal mocks.

Commands use `PLAYWRIGHT_BROWSERS_PATH=C:/Users/Lenovo/.t3/worktrees/rekonime/t3-3949d84f/.scratch/playwright-browsers` and a temporary `playwright.ticket03.config.js` importing the standard config with `use.channel='chromium'`. The old cache contains compatible full Chromium 1254, but lacks headless-shell. The ordinary launch failed before executing assertions and is not red evidence. Temporary config is excluded from commits.

- Red grouping: `bun run test:e2e --config playwright.ticket03.config.js test/e2e/focused-mobile-discovery.spec.js --workers=1` failed at missing accessible Browse anime region before source changes.
- Recovered-test corrections: desktop does not expose the mobile Genres tab, so check the accessible Add Action filter instead. Browse all titles scrolls only on mobile by existing design, so use 390px before checking the jump. These were test assumptions, not source regressions.
- Red compact panel: same command with `--grep 'mobile Discovery'` failed at 286.97px panel height before compaction. Further runs measured 272.17px and 260.17px; spacing was adjusted after rendered inspection. Target is under 260px at 390x844, covers at most 180px, title and Want to watch visible together after scrolling to the card.
- Regression command: `bun run test:e2e --config playwright.ticket03.config.js test/e2e/focused-mobile-discovery.spec.js test/e2e/first-visit-shortlist.spec.js test/e2e/first-visit-selection.spec.js test/e2e/first-visit-dismissal.spec.js test/e2e/first-visit-taste.spec.js test/e2e/first-visit-save.spec.js --workers=1`: 15 passed, only the 260.17px panel threshold failed before final spacing adjustment. All ten existing journey regressions passed, including keyboard recovery, save failure, Planned persistence, concurrent Undo protection, three/more picks, no-match alternatives, honest missing totals, lasting feedback, and detail access.
- `bun test --preload ./test/setup.js test/integration/app-discovery.test.js test/unit/discovery.test.js test/unit/discovery-improvements.test.ts`: 8 passed, 0 failed.
- `bun run typecheck`: passed. Final whitespace and browser rerun results recorded below.

### Rendered inspection and limitations

Screenshots produced by Playwright and inspected using view_image at 1280x720 and 390x844 in both dark and light themes. Files are under `test-results/focused-mobile-discovery-D-*/`: `landing.png`, `active-goal.png`, `evidence.png`, `large-text.png`, plus fresh welcome/skip captures. These ignored artifacts remain in the checkout for parent review.

- Desktop retains comparison columns; mobile uses 160px covers rather than the prior 260px. Compact landing retains Pick a title for me, Explore genres, and Choose a viewing goal. Active goal continues to hide the landing and exposes Change with keyboard focus return.
- Unknown covers use the existing image-unavailable presentation in controlled fixtures. Unknown episode totals and limited/provisional evidence remain visible in the disclosure. Fixture captures do not prove live provider image availability or improved user comprehension.
- At 200% root text size, the recommendation card remains within the viewport and text wraps. An exploratory full-page assertion measured 407px scroll width at 390px in both themes. This is an unresolved page-level overflow limitation, not claimed as a verified unrelated baseline failure; the retained card-boundary assertion is narrower and does not certify page-wide reflow.
- No unrelated baseline test failures identified in the affected suites. A port collision also prevented one rerun from starting; retry used a separate port. No production build, exhaustive browser suite, external provider verification, or participant study claimed.

### Final verification

- Implementation commit: bce9079b9fafb829fa2839274d394a31391f71d5.
- Final browser command used REKONIME_E2E_PORT=43184 with the Chromium config above: all 6 ticket tests passed, including refreshed fresh/skip captures with modal-hidden waiting, both themes/viewports, long-title screenshots, and 200% card bounds. This follows the separate 10 passing existing first-visit regression tests recorded above.
- Final typecheck passed. Screenshot files also include long-title.png. Final captures inspected with view_image included mobile dark fresh welcome and full long title, mobile light landing and 200% evidence, desktop light fresh skip, desktop dark active goal and 200% layout, plus earlier evidence captures in both themes. The captured fade-out artifact was corrected in the test by waiting for the welcome modal to hide and disabling screenshot animations.
- All acceptance checks above refer to this scoped implementation and the explicit page-level reflow limitation. Ticket remains in-progress for parent integration.
