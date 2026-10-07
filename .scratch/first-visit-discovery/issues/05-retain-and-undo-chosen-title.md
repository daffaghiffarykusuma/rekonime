# 05: Keep the chosen title visible with safe Undo

**What to build:** After Want to watch succeeds, the viewer keeps seeing the chosen title with confirmation, Undo, and a Watchlist link, so the decision remains visible and can be safely reversed.

**Blocked by:** 01: Make Watchlist save results trustworthy.

**Status:** ready-for-agent

- [ ] Retain the chosen title in the current decision context after successful Planned persistence instead of immediately losing it to saved-title exclusion.
- [ ] Provide saved confirmation, a Watchlist link, and Undo; do not mark the selection Watching.
- [ ] Treat retained selection as a narrow confirmation exception, not a new ranked pool of existing Watchlist entries.
- [ ] Undo a newly created selection without deleting unrelated entries and restore an existing entry's relevant prior state when reversal is safe.
- [ ] Route Undo through Watchlist Lifecycle so persistence failure cannot produce a false reversal or an inconsistent live state.
- [ ] Preserve unrelated and newer changes; report unsafe reversal rather than restoring a stale whole-store snapshot.
- [ ] Keep failure/retry behavior from ticket 01 intact, including the absence of confirmation for failed saves.
- [ ] Verify selection, retained confirmation, navigation, reload persistence, and Undo through the browser journey, with focused failure and intervening-change runtime checks.
- [ ] Inspect keyboard focus, announcements, and desktop/mobile confirmation layout.
