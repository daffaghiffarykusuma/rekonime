# 01: Make Watchlist save results trustworthy

**What to build:** A viewer can save a recommendation as Planned, receive confirmation only after it is persisted, and recover from a failed save without losing the previous Watchlist state.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Want to watch persists Planned without automatically marking the title Watching.
- [x] Ordinary selection writes use a checked Watchlist Lifecycle transition; candidate validation and persistence succeed before live state and success effects are exposed.
- [x] A refused or thrown storage write leaves the previous persisted and live Watchlist state unchanged.
- [x] Failed saving shows an actionable failure and allows retry without a false saved confirmation or success-derived Taste Profile effects.
- [x] Successful saving remains visible in the Watchlist after reload and preserves existing Watchlist Entry information.
- [x] Preserve existing import, status, progress, and Snapshot contracts when adjusting the shared persistence path.
- [x] Exercise the complete save/failure/retry browser flow and deterministic failure cases through existing Watchlist Lifecycle interfaces.
- [x] Verify keyboard access and readable success/failure feedback at desktop and mobile widths.

## Resolution (2026-10-07)

Merged at 780b6b1. Checked Watchlist candidate persistence, failure/retry, preserved entry state, and desktop/mobile keyboard feedback through the public runtime and browser journey.

Final implementation: `1ddbcf0`. See the [combined verification report](../../../docs/first-visit-discovery-implementation.md) for full-suite results and visual evidence. Actual participant validation is tracked separately by ticket 06.
