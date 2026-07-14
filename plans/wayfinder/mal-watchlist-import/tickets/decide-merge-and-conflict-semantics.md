---
title: Decide Watchlist merge and conflict semantics
label: wayfinder:grilling
parent: ../map.md
status: closed
assignee: codex
blocked_by: []
---

## Question

When a MAL row matches no entry, an existing Watchlist Entry, or a conflicting local status/progress value, what should be created, preserved, overwritten, skipped, or shown for confirmation, and should one import be all-or-nothing or allow accepted partial results?

## Resolution requirements

- Resolve status mapping for Watching, Completed, On-Hold, Dropped, and Plan to Watch against Rekonime's planned/watching/completed/dropped values.
- Resolve progress, start/finish dates, repeated import behavior, local `loved` state, and newer-local-versus-imported conflicts.
- State whether the default operation is merge or replace and how the user can cancel without mutation.
- Keep unmatched titles explicit; do not silently create catalogless Watchlist Entries unless that behavior is consciously chosen.

## Resolution comment

Use a preview-first, non-destructive merge. Reading and planning the XML never mutates storage; cancel leaves the Watchlist unchanged. Applying an accepted batch is one atomic persistence operation. Malformed XML, batch validation failure, or storage failure applies nothing, while unmatched, invalid, and user-rejected rows may be skipped from an otherwise valid accepted batch.

### Status and progress mapping

| MAL status | Rekonime status | Imported progress |
| --- | --- | --- |
| Plan to Watch | `planned` | `0` |
| Watching | `watching` | Non-negative `my_watched_episodes` |
| On-Hold | `watching` | Non-negative `my_watched_episodes` |
| Completed | `completed` | Non-negative `my_watched_episodes`; normalize to the catalog episode count when the Watchlist Lifecycle's existing completion invariant requires it |
| Dropped | `dropped` | Non-negative `my_watched_episodes` |

Clamp imported progress to a trusted positive Catalog Payload episode count when known. Do not add an On-Hold status or provider-specific state to the Watchlist Entry.

### Row decisions

- A matched title with no Watchlist Entry is selected for creation by default using the mapping above and the catalog Snapshot.
- A matched title whose normalized import values equal the local entry is an unchanged no-op; do not rewrite it or advance `updatedAt`.
- Any status or progress difference is a conflict because the supplied XML has no per-row last-updated timestamp. Do not guess which side is newer. Show both values, default to **Keep Rekonime**, and permit an explicit per-row **Use MAL** override.
- **Use MAL** replaces only status and progress. It sets `updatedAt` to the apply time but never clears or changes local `loved`/`lovedAt` evidence.
- A valid MAL start date fills a missing `startedAt` only. A valid finish date fills a missing `completedAt` only for a Completed row. Existing local dates are never overwritten, including after **Use MAL**. Treat `0000-00-00` and invalid dates as unknown; do not substitute the import time.
- An unmatched title remains an explicit unmatched/skipped preview row. Do not create a catalogless Watchlist Entry.

### Repeated imports

Re-importing the same XML is idempotent: unchanged rows remain no-ops, previously skipped unmatched rows remain visible, and any later local divergence returns as a conflict defaulting to **Keep Rekonime**. No import provenance or history UI is required for this plan; the preview is sufficient to explain the current operation.
