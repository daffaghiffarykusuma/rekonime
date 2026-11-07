# 04: Promote one recently updated Watching entry

**What to build:** Give returning viewers one compact homepage entry for their most recently updated Watching title, with accurate progress wording and access to the full Watchlist.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The promoted homepage section shows at most the single most recently updated Watching entry and a View all link to the Watchlist.
- [ ] Zero recorded progress uses Start watching; positive progress uses Continue watching. Planned, Completed, and Dropped entries are excluded.
- [ ] With no Watching entries, the section is absent; the one-entry limit does not restrict other Watchlist or Airing Schedule views.
- [ ] Existing progress controls, updates, Snapshot fallback, and explicitly unknown episode totals remain correct without automatically changing lifecycle state or introducing playback.
- [ ] Approved browser coverage verifies homepage presentation, View all, and progress tracking; existing model-interface tests cover deterministic ordering and eligibility where needed, with recorded red/green cycles.
- [ ] Desktop/mobile inspection covers zero, positive, and multiple-entry cases and both themes; affected checks and type checking are recorded.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
