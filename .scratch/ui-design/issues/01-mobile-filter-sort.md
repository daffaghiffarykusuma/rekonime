# 01: Make mobile catalog filtering and sorting directly accessible

**What to build:** Let a mobile catalog browser choose filtering and explicit sorting in one Filter & sort sheet, with predictable results and the same state as desktop controls.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Mobile users can open Filter & sort and directly select every supported catalog sort option.
- [ ] Reopening shows the current selection, and retained desktop controls share the same sort state.
- [ ] Applying controls produces the expected catalog order while preserving existing presets, filter application/reset, summaries, pagination, and URL behavior.
- [ ] Wording distinguishes catalog ordering from personalized ranking; sorting does not mutate Viewing Intent or saved Taste Profile.
- [ ] Keyboard operation, programmatic names, focus return, and scroll locking reuse existing Runtime Capabilities.
- [ ] Browser tests at the approved seam demonstrate a nondefault sort, result order, reopening, and preserved filter behavior, with a recorded failing-before/passing-after TDD cycle.
- [ ] Desktop/mobile rendered inspection covers both themes and narrow layouts; relevant production touch coverage, type checking, and affected checks pass or documented baseline limitations remain explicit.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
