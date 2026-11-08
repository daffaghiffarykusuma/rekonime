# Integration code review

Reviewed base: a56cb448e4067e7ef7009a79606a7b929d157e23.
Reviewed head: 6d71322bf6d4b038dc67d8f763f72858b124839c.
Diff: `git diff a56cb448e4067e7ef7009a79606a7b929d157e23...6d71322bf6d4b038dc67d8f763f72858b124839c`.
Both axes used independent read-only delegates. Reports below describe the pinned head, not later fixes. No tests were run by those reviewers.

## Standards

No documented-standard breaches found. No tracked CONTRIBUTING or CODING_STANDARDS file was found; README guidance, module contracts, ownership guidance, and supplied design sources were reviewed.

Two maintainability findings are judgment calls under the supplied smell baseline, not established functional regressions:

1. **P3, Primitive Obsession: display copy controls rendering.** The recommendation renderer checks `decision.label === 'Community Score (MAL)'` to suppress a secondary community score. A future copy change could silently duplicate the score. Return a semantic discriminator such as a community kind and branch on that instead. Producer: decision-signal presentation; consumer: App Shell recommendation rendering.
2. **P3, Duplicated Code: presentation-score availability is distributed.** The decision signal, recommendation stats, and similar-title detail presentation separately check episode evidence and finite score before rounding. Consider a presentation-only accessor returning a number or null, keeping ranking logic unchanged. Duplication is proven; divergent behavior is not.

## Spec

Three P2 findings:

1. **Partial evidence disclosure.** The zero-rated-episodes early return in the rating evidence label omits limited-data, unknown-total, and airing/provisional qualifiers. The specification requires retaining unavailable, limited-data, and provisional states. Preserve applicable qualifiers alongside unavailable wording.
2. **Incomplete score naming.** Because-you-watched cards still use the shortened MAL label instead of the agreed Community Score name with attribution and /10. The specification explicitly standardizes all recommendation surfaces.
3. **Outstanding enlarged-text acceptance.** The pinned evidence records Watchlist page width 481px at a 390px viewport with 200% root text. Complete whole-page reflow and check essential progress controls in both themes. This is an acceptance gap; regression attribution remains unproven. A separate implementation is already in progress.

No substantiated scope creep found. The 140.375px summary versus 140px test limit alone does not establish a product-spec violation. The backup edit failure passed isolation in the supplied integration record; that did not resolve its cause.

Summary: Standards has 0 documented breaches and 2 P3 maintainability findings, with copy-dependent rendering the clearest coupling. Spec has 3 P2 partial requirements, including unresolved increased-text Watchlist reflow. Keep the axes separate when assessing completion.

## Additional reproduction by parent

On the reviewed head, the parent ran the two failing critical-flow cases three times each using the existing Playwright config with installed Chrome, one worker, port43301. Command: `bunx playwright test --config output/playwright/review.config.js test/e2e/critical-flows.spec.js --grep 'selected viewing intent collapses|backup roundtrip' --repeat-each=3 --workers=1`.

Result: 2 passed, 4 failed. All three selected-intent cases measured 140.375px against the unchanged 140px bound. One of three backup roundtrips failed to persist progress5 after fill/Tab; the other two passed. Root log and error contexts remain in ignored output/playwright/review-reproduction.log and output/playwright/review-reproduction/. These are genuine observed failures; no baseline cause is inferred.

## Resolution status

Resolved in this implementation branch with evidence in [review resolution](review-resolution.md). Standards P3 findings use a semantic decision kind and one presentation-only episode-score availability accessor. Spec content findings have failing-before/passing-after browser fixtures. The summary retains its original bound after a minimal padding fix; delayed catalog Snapshot enrichment was proven to overwrite progress and now preserves the dedicated Watchlist page edits. Critical-flow repeated validation passed15/15. Latest integration f87c414, including the separately owned Watchlist reflow, is merged and verified by61 development and33 production browser passes, including both-theme200% reflow/control checks. Normal309-test suite, typecheck, data validation, build and distribution checks passed with exit0. Rendered limitations and exploratory failures remain documented in the resolution. This resolves the reviewed findings without closing tickets or the parent specification.
