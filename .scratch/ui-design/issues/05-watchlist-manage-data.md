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
- Limitation for parent final review: at 200% root text on mobile, surrounding existing Watchlist content/progress controls overflow the page. New data buttons remain within the viewport. Existing update/offline notices also appear in some screenshots. No overflow hiding or unrelated progress-control changes applied. Ticket03's separately known 407px homepage overflow at 390px remains out of scope.
- Keep status in-progress until parent integration verification. The final increased-text/page-wide acceptance criterion is not claimed complete.
