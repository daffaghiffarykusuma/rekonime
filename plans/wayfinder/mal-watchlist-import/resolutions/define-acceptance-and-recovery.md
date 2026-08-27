# Resolution: Define import acceptance and recovery criteria

Approved through human review on 2026-07-14. This resolution adds no implementation scope beyond the closed import-contract and review-flow decisions.

## Functional acceptance

The implementation is accepted when these examples pass:

1. **First import:** the supplied 415-row XML is read locally; planning waits for the full Catalog Payload; the preview reports 415 source rows, 339 exact MAL-ID catalog matches, and 76 unmatched rows. Applying creates the selected matched Watchlist Entries with Snapshots in one storage write. Unmatched rows create nothing.
2. **Repeated import:** immediately importing the same file again produces only unchanged rows plus the same explicit unmatched rows, returns `no-changes`, and performs no storage write, Watchlist event, Snapshot change, or Taste Profile refresh.
3. **Conflicts:** every status or progress difference shows both values and defaults to **Keep Rekonime**. Only an explicit **Use MAL** choice changes status or progress; local `loved`, `lovedAt`, and existing dates remain intact. Cancelling either review or confirmation mutates nothing.
4. **Invalid rows:** a structurally usable file may skip row-level validation failures while reporting each invalid row in the totals. A fatal parse error prohibits planning and application.
5. **Unmatched titles:** unmatched valid MAL IDs remain visible as skipped results and never create catalogless Watchlist Entries or use title fallback.
6. **Malformed XML:** empty input, forbidden declarations, malformed XML, an unexpected root, no anime rows, and duplicate MAL IDs show a focused error, retain the ability to choose or retry a file, and change no persisted or live state.
7. **Large or unreadable XML:** do not publish a file-size or row-count limit from the single supplied fixture. Never truncate input. Any file the browser can read and parse must receive the same validation; a browser read/resource failure becomes a recoverable error with no mutation and a retry path. Tests simulate the failure rather than asserting an invented maximum.
8. **Storage failure:** if serialization fails or the Watchlist storage adapter returns false or throws, the previous persisted payload and live map remain byte-for-byte/logically unchanged; no Watchlist event, render, Snapshot, or Taste Profile effect runs. The preview remains available for retry unless its fingerprint has become stale, in which case it must be regenerated.
9. **Taste Profile success:** one successful changed batch emits one Watchlist batch transition, renders Watchlist state once, rebuilds inferred Taste Profile evidence from the committed Watchlist exactly once, then updates Taste Profile UI and recommendations once. No-change and rejected results perform none of those effects.
10. **Taste Profile recovery:** if derived Taste Profile refresh or its UI/recommendation render fails after the Watchlist commit, do not roll back or re-import. Report **Watchlist imported; recommendations need refresh**, retain the committed Watchlist, and offer a retry that reruns only derivation and downstream rendering. Startup also rebuilds inference from the Watchlist, so reload is a recovery path.

Summary-count invariants from **Define the Watchlist Lifecycle import contract** must hold in every planner test; a plan with inconsistent totals is rejected before mutation.

## Privacy acceptance

- XML parsing, catalog matching, preview, and planning occur in the browser. The import makes no upload, API, background-service, service-worker-cache, or server request.
- No telemetry, analytics, error logger, URL, storage key other than the existing Watchlist key, or console message may receive the XML text, filename, titles, MAL IDs, status/progress/dates, row details, or import counts. Local DOM events used to update the page are not telemetry and must not expose row content outside the import flow.
- Existing unrelated catalog requests may continue; an integration test must prove that importing does not add a request whose body, query, or path contains import data.

## Accessibility acceptance

- Use the native file input and native confirmation dialog. All review and retry actions work with keyboard alone; the dialog opens with **Go back** focused.
- On review, fatal error, cancellation, successful apply, and partial-success recovery, move focus to the relevant heading or alert and announce one concise status through the existing live-region pattern without duplicate announcements.
- Conflict controls have programmatic names containing the title and choice, expose both Rekonime and MAL values as text, and do not rely on color. Updated change/skip totals are announced politely.
- Summary headings, totals, conflicts, and skipped examples have a logical reading order at 200% zoom and the existing 390 x 844 mobile viewport. The 76 unmatched rows may remain summarized with representative examples; full row rendering is not required.
- The dedicated **Watchlist import** copy remains distinct from **Rekonime backup** and states before confirmation that reading the file does not mutate data and that the accepted batch has no one-step undo.

## Focused implementation checks

- `test/unit/mal-watchlist-import.test.ts`: parser validation, exact-ID full-catalog matching, mapping and clamping, row errors, fatal errors, summary invariants, first import, conflicts, unmatched rows, and repeated-import idempotence.
- `test/unit/watchlist-state.test.js`: detached candidate serialization plus one successful write; false, thrown, and serialization failures leave persisted and live entries unchanged.
- `test/unit/watchlist-lifecycle-runtime.test.js`: invalid/full-catalog/stale-plan guards; `no-changes`; one batch event and effect set on success; zero effects on rejection.
- `test/unit/taste-profile.test.js`: imported inference is derived once, omitted from persistence, rebuilt on startup, and legacy persisted inference is ignored.
- `test/integration/app-mal-watchlist-import.test.js`: full-catalog readiness, local file-read failure, cancel/retry, effect ordering, post-commit Taste Profile partial-success recovery, and absence of import-data network or logging calls.
- `test/e2e/critical-flows.spec.js`: privacy-safe XML review, one conflict override, confirmation focus, keyboard cancel, successful announcement, malformed-file retry focus, partial-success message, 200% zoom, and 390 x 844 layout.

The implementation handoff is green only after the focused tests and the repository gates pass:

```powershell
bun run typecheck
bun run test
bun run build:verify
bun run data:validate
bun run check:security
bun run test:e2e
```

`bun run data:validate` is retained even though this feature does not edit catalog data because full-catalog MAL-ID matching depends on the validated Catalog Payload. `check:security` is required because XML is an untrusted local input boundary. Any pre-existing unrelated failure must be recorded with its command and exact output; it is not silently waived as feature acceptance.

## Supported-scale statement

The only evidenced compatibility fixture is the supplied 415-row export. It is a required acceptance case, not a maximum. No duration, file-size, or row-count service level is claimed. Implementation must keep the summary-first UI bounded by rendering conflicts and representative exceptions rather than all rows, and must fail without mutation or silent truncation when browser resources cannot process a file.
