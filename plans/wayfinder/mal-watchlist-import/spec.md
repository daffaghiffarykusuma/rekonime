---
title: Import MyAnimeList progress into the Watchlist Lifecycle
label: ready-for-agent
tracker: local-markdown
status: open
source: map.md
---

## Problem Statement

Rekonime users who already track anime in MyAnimeList cannot bring their status and episode progress into Rekonime. Re-entering hundreds of titles is slow and error-prone, while a blind import could overwrite newer local Watchlist Entries, lose loved evidence, create entries for the wrong title, or leave the Watchlist and Taste Profile inconsistent.

The supplied MyAnimeList XML export contains 415 anime rows. The current full Catalog Payload matches 339 rows by exact MAL ID and leaves 76 unmatched. The preview catalog is insufficient, title matching has demonstrated false positives, and the export has no reliable per-row update timestamp for deciding whether MAL or Rekonime is newer.

## Solution

Add a local-only, preview-first MyAnimeList XML import under Watchlist import in settings. Rekonime reads the file in the browser, waits for the full Catalog Payload, validates the MAL-specific XML, and matches titles only by exact numeric MAL ID. It then shows summary totals, actionable conflicts, and representative skipped results before any mutation.

New exact matches are selected for creation. Differences from existing Watchlist Entries are conflicts that default to Keep Rekonime and can be changed individually to Use MAL. Unmatched and invalid rows are skipped explicitly. Confirmation applies all selected changes through one atomic Watchlist Lifecycle batch, then refreshes derived Taste Profile evidence once from the committed Watchlist.

## User Stories

1. As a Rekonime user, I want to choose a MyAnimeList XML export, so that I can migrate my existing anime progress without re-entering it title by title.
2. As a privacy-conscious user, I want the import to stay in my browser, so that my list contents are not uploaded or exposed through telemetry.
3. As a user, I want Rekonime to tell me that choosing a file does not immediately change my Watchlist, so that I can inspect the result safely.
4. As a user, I want Rekonime to wait for the full Catalog Payload before matching, so that titles are not incorrectly reported missing because only preview data is loaded.
5. As a user, I want titles matched by exact MAL ID, so that similarly named but distinct anime are not merged.
6. As a user, I want a clear recoverable error when the full catalog is unavailable, so that I can retry without choosing the file again.
7. As a user, I want malformed or unsupported XML rejected before planning, so that invalid input cannot mutate my Watchlist.
8. As a user, I want forbidden document declarations rejected, so that untrusted XML is handled through a narrow browser-safe contract.
9. As a user, I want invalid rows reported separately from unmatched titles, so that I can understand whether source data or catalog coverage caused a skip.
10. As a user, I want otherwise valid rows to remain importable when individual rows are invalid, so that one bad row does not discard the whole usable list.
11. As a user, I want the review to show total, matched, conflicting, unchanged, invalid, and unmatched counts, so that I understand the proposed result before confirming.
12. As a user, I want new exact matches selected for creation by default, so that the common first-import path requires minimal work.
13. As a user, I want new Watchlist Entries to include catalog Snapshots, so that they can render before the full catalog is available later.
14. As a user, I want Plan to Watch, Watching, Completed, Dropped, and On-Hold rows mapped into Rekonime's existing statuses, so that imported progress fits the Watchlist Lifecycle.
15. As a user, I want On-Hold mapped to watching without adding a new provider-specific status, so that the Watchlist model remains consistent.
16. As a user, I want invalid or excessive episode progress normalized and disclosed, so that imported Watchlist Entries preserve existing lifecycle invariants.
17. As a user, I want valid MAL dates to fill only missing local dates, so that imports do not erase or replace dates already recorded in Rekonime.
18. As a user, I want unknown MAL dates to stay unknown, so that Rekonime does not invent dates from the import time.
19. As a user, I want unchanged matches treated as no-ops, so that importing the same data does not rewrite timestamps or storage.
20. As a user, I want every status or progress difference shown as a conflict, so that Rekonime does not guess which copy is newer.
21. As a user, I want conflicts to default to Keep Rekonime, so that existing local progress is preserved unless I explicitly override it.
22. As a user, I want each conflict to show both Rekonime and MAL values, so that I can make an informed per-title choice.
23. As a user, I want to choose Use MAL for an individual conflict, so that I can replace only the status and progress I select.
24. As a user, I want imports to preserve loved state and loved timestamps, so that affinity evidence is never lost when progress changes.
25. As a user, I want unmatched titles shown as skipped results, so that missing catalog coverage is visible rather than silent.
26. As a user, I want unmatched titles excluded from Watchlist creation, so that Rekonime does not create catalogless entries.
27. As a user, I want representative unmatched examples instead of all skipped rows rendered at once, so that a large review remains understandable and responsive.
28. As a keyboard user, I want to operate file choice, conflict controls, cancellation, confirmation, and retry without a pointer, so that the import is fully usable.
29. As a screen-reader user, I want focused headings or alerts and concise live announcements after state changes, so that I know when review, error, cancellation, success, or recovery states occur.
30. As a low-vision user, I want the review to keep a logical reading order at 200% zoom and on a 390 by 844 viewport, so that totals and decisions remain usable.
31. As a user, I want the confirmation dialog to focus Go back first, so that an accidental confirmation is less likely.
32. As a user, I want confirmation to state how many entries will be added, updated, and skipped, so that I understand the exact scope of the mutation.
33. As a user, I want confirmation to explain that the batch has no one-step undo, so that I can export a Rekonime backup first if needed.
34. As a user, I want to cancel from review or confirmation without mutation, so that inspecting an import remains safe.
35. As a user, I want selected changes committed atomically, so that a storage failure cannot leave only part of my list imported.
36. As a user, I want a changed import to emit one Watchlist update and render once, so that the interface reflects one coherent batch rather than hundreds of row updates.
37. As a user, I want my Taste Profile refreshed once from the committed Watchlist, so that recommendations reflect the imported lifecycle evidence without contradictory durable state.
38. As a user, I want a Taste Profile refresh failure reported separately after a successful Watchlist commit, so that Rekonime does not falsely claim my Watchlist import failed.
39. As a user, I want to retry only Taste Profile derivation after that partial success, so that the already committed Watchlist is not imported twice.
40. As a user, I want startup to rebuild inferred Taste Profile evidence from the Watchlist, so that reload provides another recovery path.
41. As a user, I want an immediate repeated import to produce no changes, so that importing the same file is idempotent.
42. As a user, I want a stale review rejected if my Watchlist changes before confirmation, so that an old plan cannot overwrite newer local actions.
43. As a user, I want an unreadable or resource-constrained file failure to leave all state unchanged and offer retry, so that Rekonime fails safely without silently truncating input.
44. As a user, I want MyAnimeList import clearly separated from Rekonime backup restore, so that I do not confuse a Watchlist merge with a full personal-data restore.

## Implementation Decisions

- Keep the feature MAL-specific. Use the browser's native XML parser and existing platform controls; add no parser dependency, provider abstraction, background worker, upload endpoint, service-worker behavior, or import-history store.
- Separate the feature into two pure operations: parsing the XML into validated MAL rows and planning the import against the full Catalog Payload plus current Watchlist Entries. Neither operation may read storage, render DOM, emit events, call the clock, or mutate live state.
- Accept a UTF-8, well-formed document rooted at `myanimelist` with direct anime rows. Reject empty input, forbidden declarations, malformed XML, an unexpected root, no anime rows, and duplicate MAL IDs as fatal errors.
- Treat missing or duplicate required fields, invalid MAL IDs, invalid progress, invalid episode totals, and unknown statuses as row errors. Keep otherwise usable rows eligible for review.
- Match only `series_animedb_id` to numeric catalog `malId` after the existing full-catalog load reports success. Never use the preview catalog, title fallback, or a partially loaded catalog.
- Map Plan to Watch to planned, Watching and On-Hold to watching, Completed to completed, and Dropped to dropped. Clamp progress to a trusted positive catalog episode count and honor the existing completed-progress invariant.
- Convert valid calendar dates to UTC midnight. Treat invalid dates and `0000-00-00` as unknown. Fill only missing local dates and never overwrite existing dates.
- Build a catalog Snapshot for every created entry. Preserve an existing Snapshot on updates and fill it from the catalog only when missing.
- Use a non-destructive merge. New matched entries default to create; unchanged entries are no-ops; every status or progress difference is a conflict defaulting to Keep Rekonime.
- Use MAL changes only when explicitly selected for a conflict. Replace status and progress, preserve local loved evidence and dates, and set the update timestamp once at apply time.
- Recompute the pure plan when conflict choices change. Do not maintain a mutable plan object.
- Record a deterministic fingerprint of normalized current Watchlist Entries in the plan and reject application when the live fingerprint differs.
- Keep summary counts internally consistent and reject a plan whose totals do not satisfy the documented source, valid, matched, conflict, and skipped invariants.
- Commit selected changes through one Watchlist Lifecycle batch operation. Build, validate, and serialize a detached complete payload before one write to the existing Watchlist storage key; update the live map only after the write succeeds.
- Return no changes without writing storage, emitting an event, refreshing a Snapshot, or updating the Taste Profile when the accepted plan contains no creates or updates.
- On success, emit one existing Watchlist update event with import batch details, refresh Watchlist presentation once, schedule the Airing Schedule once, rebuild inferred Taste Profile evidence once, and then refresh Taste Profile UI and recommendations once.
- Keep Watchlist-derived Taste Profile inference in memory and rebuild it from Watchlist Entries at startup. Persist explicit preferences, omit derived inference from future writes, and ignore legacy persisted inference when loading.
- If post-commit Taste Profile derivation or rendering fails, keep the Watchlist commit and offer a derivation-only retry. Do not roll back or repeat the import.
- Place the flow in a dedicated Watchlist import section. Keep Rekonime backup as a separate full-personal-data restore concept.
- Use a summary-first review: totals at the top, conflicts in the main review column, and unchanged, invalid, and unmatched information in a secondary rail with representative examples.
- Use a native file input and native confirmation dialog. The dialog initially focuses Go back and states live add, update, and skip totals, loved-evidence preservation, one Taste Profile refresh, and the lack of one-step undo.
- Do not expose source XML, filename, titles, MAL IDs, progress, dates, row details, or import counts through network requests, analytics, telemetry, URLs, unrelated storage, console output, or error logging.
- Support the evidenced 415-row fixture as a required case, not a maximum. Do not invent a file-size, row-count, or duration guarantee; never truncate silently.

## Testing Decisions

- Prefer the highest existing seams: pure parser/planner behavior, the single Watchlist Lifecycle apply boundary, the App Shell effect adapter, and one critical browser flow. Do not test private helper structure or add seams for each row type.
- Parser and planner unit tests cover supported MAL fields and statuses, forbidden and malformed input, duplicate IDs, row errors, dates, progress normalization, exact full-catalog matching, title-mismatch warnings, Snapshots, conflicts, summary invariants, and idempotent repeated import.
- Watchlist State unit tests cover detached validation and serialization, exactly one successful write, and false, thrown, or serialization failures that preserve both persisted and live entries.
- Watchlist Lifecycle Runtime unit tests cover invalid-plan, non-full-catalog, and stale-plan rejection; the no-change path; one batch transition and one effect set on success; and zero downstream effects after rejection.
- Taste Profile unit tests cover one derivation from the committed Watchlist, omission of inferred evidence from persistence, startup reconstruction, and rejection of legacy persisted inference.
- App Shell integration tests cover full-catalog readiness, file-read failure, cancel and retry, effect ordering, post-commit Taste Profile recovery, and the absence of import-data network or logging calls.
- The critical browser-flow test uses the privacy-safe generated XML fixture to cover review totals, one conflict override, live count updates, confirmation focus, keyboard cancellation, success announcement, malformed-file retry focus, partial-success messaging, 200% zoom, and the 390 by 844 viewport.
- Accessibility checks assert programmatic conflict names, visible comparison text, non-color-dependent state, logical heading and reading order, deliberate focus movement, and one concise live-region announcement per transition.
- Privacy checks assert that the import introduces no request containing source data and does not send source or result data to analytics, logging, URLs, or unrelated storage.
- Repository acceptance requires type checking, the full Bun test suite, verified production build, catalog validation, security checks, and end-to-end tests. Any unrelated baseline failure must be recorded with its exact command and output rather than silently waived.

## Out of Scope

- Continuous MyAnimeList synchronization, OAuth, or API integration.
- Exporting Rekonime changes to MyAnimeList.
- Importing manga lists.
- Expanding the Rekonime catalog solely to match every export row.
- Title or fuzzy matching.
- Provider-general import abstractions or support for unobserved MAL XML layouts.
- Importing MAL scores into the Taste Profile.
- Adding an On-Hold Watchlist status.
- Replacing the Watchlist instead of merging it.
- Persisted import provenance, history, or one-step undo.
- A server, worker, upload, telemetry, or new dependency for import processing.
- A claimed maximum file size, row count, or processing-time service level.

## Further Notes

- Evidence is limited to one privately reviewed MAL XML export: 415 rows, 339 exact full-catalog matches, and 76 unmatched rows. The source file was removed after analysis; a privacy-safe generated fixture preserves this regression case but does not prove every MAL export variant.
- The current Catalog Payload's TV-only coverage explains all 69 unmatched non-TV rows and seven unmatched TV rows. Two attempted normalized-title matches were demonstrated false positives, supporting exact-ID-only matching.
- The selected human-reviewed prototype is the summary-first settings flow with conflicts as the primary task and safely skipped results summarized alongside it.
- The feature is ready for implementation with no unresolved product or transaction decisions. Implementation should reuse the existing Watchlist Lifecycle, Catalog Runtime, Taste Profile, Runtime Capabilities, App Shell, and critical-flow test patterns.
