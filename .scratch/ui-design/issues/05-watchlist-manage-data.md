# 05: Put Watchlist administration behind Manage data

**What to build:** Keep everyday Watchlist progress and status controls prominent while retaining accessible export, restore, and MAL import in a Manage data disclosure.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Manage data contains existing export, Personal Data Restore, and MAL Watchlist Import entry controls.
- [ ] The browser-local storage reminder stays visible while the disclosure is closed; status tabs, saved entries, and progress actions remain prominent.
- [ ] Disclosure open/close works with touch and keyboard, with understandable names, state, reading order, and focus behavior.
- [ ] Opening or closing the disclosure performs no data operation or progress mutation and preserves existing lazy-loading behavior.
- [ ] Restore and MAL import remain distinguishable and retain validation, review, confirmation, privacy, cancellation, and failure recovery semantics.
- [ ] Approved browser coverage demonstrates disclosure access, existing backup roundtrip/progress workflow, and reviewed MAL import reachability, with a recorded failing-before/passing-after TDD cycle.
- [ ] Desktop/mobile rendered inspection covers both themes, narrow controls, and increased text size; affected production tests, type checking, and relevant existing checks are recorded.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
