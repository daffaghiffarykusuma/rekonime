# 05: Put Watchlist administration behind Manage data

**What to build:** Keep everyday Watchlist progress and status controls prominent while retaining accessible export, restore, and MAL import in a Manage data disclosure.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [x] Manage data contains existing export, Personal Data Restore, and MAL Watchlist Import entry controls.
- [x] The browser-local storage reminder stays visible while the disclosure is closed; status tabs, saved entries, and progress actions remain prominent.
- [x] Disclosure open/close works with touch and keyboard, with understandable names, state, reading order, and focus behavior.
- [x] Opening or closing the disclosure performs no data operation or progress mutation and preserves existing lazy-loading behavior.
- [x] Restore and MAL import remain distinguishable and retain validation, review, confirmation, privacy, cancellation, and failure recovery semantics.
- [x] Approved browser coverage demonstrates disclosure access, existing backup roundtrip/progress workflow, and reviewed MAL import reachability, with a recorded failing-before/passing-after TDD cycle.
- [ ] Desktop/mobile rendered inspection covers both themes, narrow controls, and increased text size; affected production tests, type checking, and relevant existing checks are recorded.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.

## Implementation evidence (pending parent integration verification)

- Claimed on `t3/watchlist-manage-data`; required baseline `5a59095a9977899f587ab5db8bdaee6954ca1b16` is an ancestor, verified before edits. No extra checkout or branch created.
- Native details/summary groups the existing export, Personal Data Restore and MAL import controls. Storage reminder remains outside. Existing IDs, operation handlers, lazy loading, domains and progress controls are unchanged.
- TDD red: new browser scenario failed because Manage data did not exist. Green: same scenario passes after disclosure implementation. An intermediate test setup failure expected status tabs on the intentionally empty Watchlist; corrected to seed a Watching entry before testing tab/progress visibility.
- Validation: frozen Bun install; build and typecheck passed; 37 existing affected unit tests passed across Watchlist page interactions/renderer/runtime, Personal Data Restore, MAL parsing and import workflow. Unsafe-pattern, dist asset, runtime preview and size-budget checks passed.
- Production Chrome suite: 8/8 passed, covering touch navigation, browse/search/detail/Watchlist, reviewed MAL import from Manage data, and four desktop/mobile theme combinations. Follow-up run tightens app-chunk lazy-load assertion and records page width with 100%/200% root text.
- Screenshots inspected for desktop 1280px and mobile 390px, light/dark, collapsed/expanded, including 200% root text. Evidence stays local under `test-results-prod-05/`; no browser caches/helpers/screenshots committed. Native focus ring and disclosure marker are visible; data buttons wrap with minimum 44px height.
- Follow-up reflow fix: the mobile 200% root-text overflow is resolved locally by wrapping the Watchlist content and progress stepper; page width is now 390px in both themes. Data buttons and progress/status controls remain actionable. See [reflow diagnosis and validation](../watchlist-reflow-resolution.md). Existing update/offline notices remain visible in some captures. Ticket03's separately known 407px homepage overflow at 390px remains out of scope.
- Keep status in-progress until parent integration verification. The final increased-text/page-wide acceptance criterion is not claimed complete.

### Handoff validation

- Implementation commit: `c577b3b`. Integration tip `b978ae6bc99f05777fcd05b98a953658e1ec00c7` merged afterward as `d340884d09642c364a77ce2611e3df549900a81e`; merge had no conflicts.
- Post-merge: `bun run typecheck`, `bun run build`, `check:dist-assets`, `check:runtime-preview`, `check:dist-size`, and `git diff --check` passed. Chrome production suite exited successfully: **8 passed**, including all four Watchlist width/theme combinations, touch navigation and reviewed MAL import through Manage data.
- Development focused run reported **4 passing scenarios**: native disclosure keyboard/lazy-load/data preservation; MAL conflict/cancel/privacy/repeat; malformed import retry/downstream recovery; backup export, restore button file chooser, and editable progress roundtrip. The runner stalled in cleanup after reporting all four passes and was interrupted; do not describe that command as a clean successful exit.
- Follow-up pre-merge production run exited successfully with **5 passed** after tightening lazy-load assertions. Final merged-tree screenshots were inspected again for mobile light/dark.
- Measured page widths: desktop 1280px at both 100% and 200% root text; mobile 390px at 100%, **481px at 200%** in both themes. Data operation buttons remain within the viewport; these are historical pre-fix measurements; the follow-up reflow regression now passes at 390px in both themes, with parent integration verification pending. This is additional to ticket03's separately deferred homepage overflow.
- Reproduction used the existing Playwright development/production configs with local-only wrappers selecting installed `channel: 'chrome'`, unique ports 4276/4275, and unchanged test suites. Dependencies installed with `bun install --frozen-lockfile`; no browser installation. Local wrappers, JSON reports and screenshots remain uncommitted.
- Ticket remains **in-progress**, awaiting parent integration verification and final increased-text review.

