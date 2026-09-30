# Discovery and Watchlist improvements

The home page prioritizes viewing goals, recent Watching progress, and recommendations. Returning visitors get a compact hero. Ranking modes are available inside Tune ranking. Continue watching shows the three most recently updated Watching entries, supports incrementing progress or marking finished, and links to the complete Watchlist.

Recommendation eligibility, genre cues, and reason labels are documented in [Episode rating strength](episode-rating-strength.md). The policy relies on available catalog watch-order metadata and cannot detect missing relationships.

## Import and backup boundaries

MyAnimeList XML import is a local, exact-ID merge. Conflicts default to Keep Rekonime. An individual Use MAL choice updates status/progress, preserves loved state and existing dates, and fills only missing valid UTC dates. Repeated identical imports are no-ops. Review counts include source, valid, matched, creates, updates, conflicts, unchanged, invalid, unmatched, and skipped rows. Invalid rows do not block usable rows; unsafe document structure or duplicate MAL IDs blocks the entire file. Examples are limited in the presentation; processing is never truncated.

Confirmation checks a deterministic fingerprint against the latest persisted Watchlist, validates and serializes a detached candidate, then commits one complete payload. Failed persistence leaves prior entries intact. One successful batch emits the existing event, refreshes the Watchlist, schedules the airing dashboard, derives taste evidence, updates preference UI, and refreshes recommendations. Post-commit failure keeps saved progress and offers a recommendation-only retry.

The import-triggered airing refresh reads cached schedules without sending imported membership to AniList or creating airing cache records. Ordinary later Watchlist use retains its existing live schedule service. XML source text, filenames, row titles, dates, and counts remain transient; only accepted catalog snapshots and lifecycle values enter the Watchlist store. Derived taste evidence is recomputed in memory on startup and never persisted with explicit preferences.

The Watchlist toolbar exposes Rekonime JSON export and restore separately from MAL import. JSON restore replaces existing saved personal data. The export indicator records when a download was requested; it cannot verify that the user saved or retained the downloaded file.

## Verification

Focused checks cover prerequisites, one-per-franchise selection, honest cues, taste evidence persistence, recent progress, XML errors/counts, conflicts/dates, stale review, invalid candidates, failed storage, and recommendation-only retry. Browser checks cover the generated 415-row fixture with 339 exact matches/76 unmatched rows, keyboard conflict choices/cancel, confirmation focus, mobile/200% viewport, preserved local evidence, repetition, malformed retry, and partial-success recovery. Acceptance results:

- `bun run typecheck`: passed.
- `bun run test:coverage`: 217 passed, zero failed, across 65 files. Function coverage 83.25%; line coverage 85.45%.
- `REKONIME_E2E_PORT=4187 bun run test:e2e`: 17 browser tests passed.
- `bun run test:e2e:prod`: production build and both production smoke tests passed.
- Distribution assets, runtime catalog, and size checks passed. Runtime full index: 3.93 MiB of 4 MiB; total distribution: 26.53 MiB of 27 MiB.
- `bun run check:security`: no dependency vulnerabilities; outdated budget, unsafe-pattern scan, and security headers passed. The existing Undici override was patched to 7.29.1 without adding a dependency.
- `bun install --frozen-lockfile` and `bun run check:repo-hygiene`: passed.
- `bun run data:validate`: passed against the existing baseline. The source catalog still reports `missingScore: 3578`, `missingTrailer: 571`, `missingStudio: 21`, `missingAnilistId: 78`, and `missingEpisodes: 59`; embedded data reports `missingScore: 200`, `missingTrailer: 7`, and `missingAnilistId: 3`. Index-reference checks report no errors or warnings.

Development tests use an explicit configurable port and reject reuse of another server. Browser layout measurements wait for visible content. The six recommendation cards remain laid out to prevent deferred content from moving touch targets during scrolling; the catalog retains its existing rendering optimization. Dialogs become visible before native opening, with opacity-only opening transitions, so deliberate focus placement is reliable.

## Standards

The review identified an incompatible restore event payload, duplicate episode-total resolution, and an untyped import presentation state. The event now retains required fields, totals share the existing catalog resolver, and presentation uses a discriminated state type. The final focused review found duplicate help copy and an asynchronous canceled-read flag; both were corrected. No unresolved documented standards violations remain.

## Spec

The review identified cross-tab stale plans, an unrestricted Because you watched path, misleading surprise wording, schedule requests triggered by import, and effect order. These were corrected and covered through unit/integration/browser checks. A repeated no-change import now reports that the Watchlist is current without claiming a Taste Profile refresh. No unresolved blocking spec gaps remain.

Review summary: zero unresolved findings on either axis. Catalog relationship coverage remains a documented limitation of franchise eligibility.
