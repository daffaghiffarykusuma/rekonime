---
label: ready-for-agent
tracker: local-markdown
status: open
source: plans/wayfinder/mal-watchlist-import/spec.md
---

# Tickets: MyAnimeList Watchlist import

These tickets build a local-only, preview-first MyAnimeList XML import for the Watchlist Lifecycle. Source: [Import MyAnimeList progress into the Watchlist Lifecycle](plans/wayfinder/mal-watchlist-import/spec.md).

Work the **frontier**: any ticket whose blockers are all done. Start with **Import exact MAL matches into the Watchlist Lifecycle**; after it completes, the merge and validation tickets may proceed independently.

## Import exact MAL matches into the Watchlist Lifecycle

**What to build:** Let a user choose a valid MyAnimeList XML export, wait for the full Catalog Payload, preview exact MAL-ID matches, and confirm one local Watchlist import. The accepted batch creates matched Watchlist Entries with Snapshots atomically, updates Watchlist presentation once, and refreshes derived Taste Profile evidence once.

**Blocked by:** None — can start immediately.

- [x] A native file input reads the XML locally and makes clear that choosing a file does not mutate the Watchlist.
- [x] Planning waits for a successfully loaded full Catalog Payload and never matches against preview or partially loaded data.
- [x] The MAL-specific parser accepts the evidenced document shape and matches rows only by numeric MAL ID.
- [x] The review shows source, matched, proposed-create, and skipped totals before confirmation.
- [x] Created Watchlist Entries use the resolved status/progress mapping and contain catalog Snapshots.
- [x] Confirmation shows live add and skip totals, focuses **Go back** first, and explains that the batch has no one-step undo.
- [x] Cancel from review or confirmation changes no persisted or live state.
- [x] Confirmation validates and serializes a detached complete Watchlist payload before one storage write and changes the live map only after that write succeeds.
- [x] One changed batch emits one Watchlist update, refreshes Watchlist presentation once, schedules the Airing Schedule once, and rebuilds Taste Profile inference once.
- [x] XML contents and row data are not uploaded, logged, placed in URLs, or written outside the existing Watchlist storage boundary.
- [x] Focused unit, integration, and browser checks prove the supplied 415-row fixture reports 339 exact matches and 76 unmatched rows before application.

## Merge MAL progress without losing local Watchlist evidence

**What to build:** Let a user safely merge MAL progress into an existing Watchlist. Differences become explicit per-title conflicts that preserve Rekonime by default, while deliberate MAL overrides update only the selected lifecycle values and repeated imports remain no-ops.

**Blocked by:** Import exact MAL matches into the Watchlist Lifecycle.

- [ ] Plan to Watch maps to planned, Watching and On-Hold map to watching, Completed maps to completed, and Dropped maps to dropped.
- [ ] Imported progress is non-negative, respects trusted catalog episode totals, and preserves the existing completed-progress invariant.
- [ ] Valid MAL dates fill only missing local dates; unknown or invalid dates remain unknown and never replace existing dates.
- [ ] A matched row equal to its local Watchlist Entry is an unchanged no-op that does not advance timestamps.
- [ ] Every status or progress difference is shown as a conflict with both Rekonime and MAL values visible.
- [ ] Every conflict defaults to **Keep Rekonime** and can be changed individually to **Use MAL**.
- [ ] **Use MAL** replaces only status and progress, preserves loved state, loved timestamps, and existing dates, and uses one apply-time timestamp.
- [ ] Conflict choice changes recompute the pure plan and update the announced change and skip totals without mutating storage.
- [ ] A deterministic Watchlist fingerprint prevents an old review from applying after the Watchlist changes.
- [ ] Re-importing the same XML after a successful import returns no changes and performs no write, event, Snapshot update, render, or Taste Profile refresh.
- [ ] Unit and browser checks cover unchanged rows, Keep Rekonime, Use MAL, stale plans, preserved evidence, and idempotent repetition.

## Report invalid and unmatched MAL rows safely

**What to build:** Give users an accurate, recoverable review when XML structure, individual MAL rows, catalog readiness, or catalog coverage prevents some or all rows from being imported. Usable rows remain eligible, while unsafe or unmatched rows are explicit and never create incorrect Watchlist Entries.

**Blocked by:** Import exact MAL matches into the Watchlist Lifecycle.

- [ ] Empty input, forbidden declarations, malformed XML, an unexpected root, no anime rows, and duplicate MAL IDs are fatal errors that prohibit planning and application.
- [ ] Missing or duplicate required fields, invalid MAL IDs, invalid progress, invalid episode totals, and unknown statuses invalidate only the affected row in an otherwise usable file.
- [ ] Unknown dates, On-Hold mapping, unknown episode totals, progress normalization, completed-progress normalization, and title differences are surfaced as warnings where applicable.
- [ ] Summary counts satisfy the documented source, valid, matched, conflict, and skipped invariants; inconsistent plans are rejected before mutation.
- [ ] Valid rows without an exact catalog MAL-ID match are reported as unmatched and create no catalogless Watchlist Entries.
- [ ] No title or fuzzy fallback is attempted, including for demonstrated normalized-title false positives.
- [ ] The review shows invalid and unmatched totals plus representative examples without requiring every skipped row to render.
- [ ] A full-catalog load failure produces a recoverable catalog-unavailable state and keeps the selected file available for retry.
- [ ] Fatal errors focus and announce a concise alert, retain a retry path, and change no persisted or live state.
- [ ] No file-size or row-count ceiling is invented; input is never silently truncated, and browser read or resource failure remains recoverable without mutation.
- [ ] Tests distinguish fatal errors, row errors, warnings, unmatched rows, catalog unavailability, summary invariant failures, and successful partial acceptance.

## Recover cleanly from import and downstream failures

**What to build:** Ensure every rejected import leaves the prior Watchlist intact and every successful Watchlist commit remains authoritative even if later Taste Profile work fails. Users can retry the correct stage without duplicating or partially applying the batch.

**Blocked by:** Merge MAL progress without losing local Watchlist evidence; Report invalid and unmatched MAL rows safely.

- [ ] Candidate validation or serialization failure leaves persisted and live Watchlist state unchanged.
- [ ] A storage adapter that returns false or throws leaves the previous persisted payload and live entries unchanged.
- [ ] Rejected application emits no Watchlist event and triggers no render, Snapshot, Airing Schedule, or Taste Profile effect.
- [ ] A storage failure keeps the review available for retry unless the Watchlist fingerprint has become stale, in which case a new plan is required.
- [ ] A browser file-read failure focuses and announces a recoverable error and returns focus to file selection on retry.
- [ ] A successful Watchlist commit is not rolled back when Taste Profile derivation, Taste Profile UI, or recommendation rendering fails.
- [ ] Post-commit downstream failure reports **Watchlist imported; recommendations need refresh** and offers a derivation-only retry.
- [ ] Derivation-only retry rebuilds inference and downstream presentation without re-reading, re-planning, or reapplying the Watchlist batch.
- [ ] Startup reconstructs Watchlist-derived Taste Profile evidence before recommendation use, ignores legacy persisted inference, and persists explicit preferences without derived inference.
- [ ] Integration checks prove the fixed apply/effect order, exactly-once successful effects, zero rejected effects, storage atomicity, and partial-success recovery.

## Complete accessible, private, production-ready acceptance

**What to build:** Finish the import as a keyboard-operable, screen-reader-understandable, responsive, private production flow and verify it through the repository's normal acceptance gates.

**Blocked by:** Recover cleanly from import and downstream failures.

- [ ] File selection, conflict review, cancellation, confirmation, retry, and recovery work with keyboard alone.
- [ ] Conflict controls have programmatic names containing the title and choice, and both source values remain visible without relying on color.
- [ ] Review, fatal error, cancellation, success, and partial-success recovery move focus to the relevant heading or alert and produce one concise live-region announcement.
- [ ] Summary headings, totals, conflicts, and skipped examples maintain logical reading order at 200% zoom and at the existing 390 by 844 mobile viewport.
- [ ] Watchlist import remains visibly and semantically distinct from Rekonime backup restore.
- [ ] Privacy checks prove that XML text, filename, titles, MAL IDs, status, progress, dates, row details, and import counts do not reach requests, analytics, telemetry, URLs, unrelated storage, console output, or error logs.
- [ ] The supplied XML browser flow covers review totals, one conflict override, live total changes, confirmation focus, keyboard cancellation, success announcement, malformed-file retry, and partial-success recovery.
- [ ] Type checking, the full Bun test suite, verified production build, catalog validation, security checks, and end-to-end tests pass.
- [ ] Any unrelated pre-existing failure is recorded with its exact command and output rather than silently waived.
- [ ] The finished behavior stays MAL-specific and introduces no provider framework, background worker, server upload, history store, telemetry, or new dependency.
