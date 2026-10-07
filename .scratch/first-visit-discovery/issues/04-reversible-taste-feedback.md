# 04: Make lasting Taste Profile feedback deliberate and reversible

**What to build:** A viewer can intentionally adjust lasting recommendation preferences through secondary controls and undo a mistaken action without resetting unrelated taste or saved history.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Place existing lasting Taste Profile adjustments behind a clearly named secondary control while preserving their availability.
- [x] Not for me explicitly communicates a lasting recommendation exclusion, distinct from session-only skipping when that control is present.
- [x] Offer Undo for lasting Taste Profile feedback through the owning Taste Profile interface.
- [x] Undo restores the affected preference evidence without resetting unrelated preferences or Watchlist-derived evidence.
- [x] Do not silently overwrite newer conflicting changes while undoing; preserve them and report when safe reversal is unavailable.
- [x] Reflect lasting feedback and successful Undo in subsequent recommendations and persisted preference state.
- [x] Keep Watchlist Lifecycle actions distinct from Taste Profile feedback; do not treat Already seen as a taste-preference write.
- [x] Verify persistence, reversal, isolation, and intervening-change cases through existing Taste Profile public interfaces and the browser feedback journey.
- [x] Verify the secondary control and Undo with keyboard navigation, understandable feedback, and mobile rendering.

## Resolution (2026-10-07)

Merged at 485a36f; reviewed ownership cleanup at 7407fdd. Taste Profile and desktop/mobile keyboard checks verify deliberate lasting feedback, persistent reversal, unrelated/inferred evidence preservation, conflict refusal, and accessible Undo. Secondary controls and feedback were visually inspected.

Final implementation: `1ddbcf0`. See the [combined verification report](../../../docs/first-visit-discovery-implementation.md) for full-suite results and visual evidence. Actual participant validation is tracked separately by ticket 06.
