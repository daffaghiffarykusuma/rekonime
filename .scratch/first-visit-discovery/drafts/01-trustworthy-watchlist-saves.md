# 01: Make Watchlist save results trustworthy

**What to build:** A viewer can save a recommendation as Planned, receive confirmation only after it is persisted, and recover from a failed save without losing the previous Watchlist state.

**Blocked by:** None (can start immediately).

**Status:** draft, pending breakdown approval

- [ ] Want to watch persists Planned without automatically marking the title Watching.
- [ ] Ordinary selection writes use a checked Watchlist Lifecycle transition; candidate validation and persistence succeed before live state and success effects are exposed.
- [ ] A refused or thrown storage write leaves the previous persisted and live Watchlist state unchanged.
- [ ] Failed saving shows an actionable failure and allows retry without a false saved confirmation or success-derived Taste Profile effects.
- [ ] Successful saving remains visible in the Watchlist after reload and preserves existing Watchlist Entry information.
- [ ] Preserve existing import, status, progress, and Snapshot contracts when adjusting the shared persistence path.
- [ ] Exercise the complete save/failure/retry browser flow and deterministic failure cases through existing Watchlist Lifecycle interfaces.
- [ ] Verify keyboard access and readable success/failure feedback at desktop and mobile widths.
