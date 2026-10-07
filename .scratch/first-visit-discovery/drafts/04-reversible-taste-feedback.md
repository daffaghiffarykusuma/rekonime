# 04: Make lasting Taste Profile feedback deliberate and reversible

**What to build:** A viewer can intentionally adjust lasting recommendation preferences through secondary controls and undo a mistaken action without resetting unrelated taste or saved history.

**Blocked by:** None (can start immediately).

**Status:** draft, pending breakdown approval

- [ ] Place existing lasting Taste Profile adjustments behind a clearly named secondary control while preserving their availability.
- [ ] Not for me explicitly communicates a lasting recommendation exclusion, distinct from session-only skipping when that control is present.
- [ ] Offer Undo for lasting Taste Profile feedback through the owning Taste Profile interface.
- [ ] Undo restores the affected preference evidence without resetting unrelated preferences or Watchlist-derived evidence.
- [ ] Do not silently overwrite newer conflicting changes while undoing; preserve them and report when safe reversal is unavailable.
- [ ] Reflect lasting feedback and successful Undo in subsequent recommendations and persisted preference state.
- [ ] Keep Watchlist Lifecycle actions distinct from Taste Profile feedback; do not treat Already seen as a taste-preference write.
- [ ] Verify persistence, reversal, isolation, and intervening-change cases through existing Taste Profile public interfaces and the browser feedback journey.
- [ ] Verify the secondary control and Undo with keyboard navigation, understandable feedback, and mobile rendering.
