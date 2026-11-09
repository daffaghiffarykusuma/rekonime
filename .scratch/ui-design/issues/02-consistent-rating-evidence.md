# 02: Standardize rating names, scales, and evidence

**What to build:** Give viewers consistent rating names, scales, and evidence disclosures across recommendations, catalog cards, details, sorting, and help.

**Blocked by:** None (can start immediately).

**Status:** closed

Closed after final integration verification on 2026-11-08. Implementation f06d14e and review fixes 7dcb353 are integrated at 827e734. Zero-rated qualifiers and Because-you-watched naming are verified, with semantic decision kinds and shared presentation availability. Final combined checks passed: 309 Bun, 61 development browser, 33 production browser and 15 repeated critical-flow cases plus typecheck, data, build and distribution checks. Both review axes cleared. See [final report](../../../docs/ui-design-implementation.md).

- [x] Community score has MAL attribution and an explicit /10 scale across relevant surfaces.
- [x] Episode rating strength has an explicit /100 scale; user-facing finish-rate and satisfaction labels for these metrics are replaced consistently.
- [x] Explanations remain expandable and preserve unavailable, limited-data, unknown-total, and provisional states.
- [x] An unavailable episode-score sentinel is never presented as a measured zero or completion probability.
- [x] Score formulas, provider work, storage keys, and recommendation rules remain unchanged.
- [x] Existing browser fixtures verify supported values and missing/provisional evidence through the approved seam, with a recorded red/green TDD cycle rather than internal markup assertions.
- [x] Desktop/mobile rendered inspection confirms readable labels, scales, and disclosures in both themes; affected checks and type checking are recorded.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.


## Resolution notes, 2026-11-08

Implementation: f06d14e. Status remains in-progress for parent integration and closure.

- Confirmed before editing: baseline 511769ce2a7872b8b8b308adca88b04b90b7201f is an ancestor of HEAD; integration branch initially pointed to that baseline.
- Recovered only the four modified source files from C:/Users/Lenovo/.t3/worktrees/rekonime/t3-09265bac. That checkout was read only. No dependency/browser cache or scratch helper is included in the commit.
- Community Score (MAL), /10, and Episode Rating Strength, /100, now agree across Discovery, catalog, details/similar titles, ranking, sorting and recommendation help. Explanations remain expandable. Presentation checks distinguish rated episodes from declared totals; unavailable sentinels are hidden instead of displayed as measured zero. Formula, provider, storage and ranking logic are unchanged.

### TDD at the approved browser seam

All commands ran in this prepared checkout with Bun 1.4.4. Temporary Playwright configs extend repository configs and select installed Chrome using channel: 'chrome'. The old browser-cache directory has no compatible executable. Missing-binary and an initial occupied-port setup failure are not red evidence.

1. RED: REKONIME_E2E_PORT=4182 bunx playwright test --config .scratch/rating-playwright.config.js test/e2e/rating-evidence.spec.js --workers=1. Failed visible agreed label assertion: Discovery showed Episode strength instead of Episode Rating Strength.
2. GREEN after recovering terminology patch: the same one-case browser command passed the supported score fixture through Discovery, catalog, sorting labels and details.
3. RED: same command with -g 'known totals'. A fixture with 12 declared episodes, zero rated episodes and internal retentionScore: 0 displayed 0/100 in expanded Discovery evidence. An earlier fixture without a community score produced no Discovery pick; that setup failure is not red evidence.
4. GREEN after presentation availability guard: final rating suite passes supported scores, limited/provisional evidence with unknown total, community-only fallback for zero rated episodes, and missing community/episode scores through catalog and details. During iteration, two assertions expecting N/A were corrected to the existing community fallback, 8.0/10; those failures were test expectation errors.

### Verification

- bun install --frozen-lockfile: passed.
- bun run typecheck: passed.
- bun test --preload ./test/setup.js test/unit/detail-presentation.test.js test/integration/app-render-security.test.js test/recommendations.test.js: 14 passed.
- bun run test --timeout 30000: 309 passed, zero failed. Initial default-timeout run had 301 passed and 8 failures: one old label assertion fixed here, four unrelated timeouts and three Python-launcher failures. These did not reproduce on the complete rerun with the longer timeout. No Python/tooling change was made.
- REKONIME_E2E_PORT=4183 bunx playwright test --config .scratch/rating-playwright.config.js test/e2e/rating-evidence.spec.js test/e2e/first-visit-shortlist.spec.js test/e2e/first-visit-save.spec.js --workers=1: 7 passed. Log: .scratch/rating-browser-final.log.
- bun run build: passed. check:dist-assets, check:runtime-preview, check:dist-size: passed. Log: .scratch/rating-build.log.
- bunx playwright test --config .scratch/rating-prod.config.js --workers=1: existing four production smoke journeys passed, including browse/search/details/Watchlist, mobile controls, deep links and reviewed import. The combined first run still had the incorrect N/A assertion in one new test.
- bunx playwright test --config .scratch/rating-prod.config.js test/e2e/rating-evidence.spec.js --workers=1: final 3 rating tests passed. Log: .scratch/rating-prod-final.log. PowerShell reported native stderr warnings as NativeCommandError and a shell exit of 1 even where Playwright reported all tests passed; recorded pass counts are the Playwright results, not the wrapper exit.
- git diff --check: passed before implementation commit.

### Rendered inspection and limits

Used Playwright screenshots and view_image to inspect expanded Discovery evidence and catalog cards at 1280x720 and 390x844 in both dark and light themes. Files remain local under .scratch/ui-design/evidence/02/:

- rating-example-discovery-1280-dark.png and rating-example-discovery-1280-light.png
- rating-example-discovery-390-dark.png and rating-example-discovery-390-light.png
- rating-example-catalog-1280-dark.png and rating-example-catalog-1280-light.png
- rating-example-catalog-390-dark.png and rating-example-catalog-390-light.png

Labels, numeric scales, attribution and limited/provisional/unknown-total copy wrap within cards. The long title uses existing truncation; details retain full title access. One initial offscreen catalog capture was blank; capture now scrolls into view and the replacement was inspected. Fixtures deliberately have no artwork. The environment's offline banner overlaps the artwork area in Discovery captures, without covering the rating evidence. The missing-score development fixture also logs a detail-fetch JSON fallback error; catalog/details remain available and the asserted unavailable-state behavior passes. No live provider evidence, increased-text-size audit, accessibility compliance or measured comprehension improvement is claimed.
