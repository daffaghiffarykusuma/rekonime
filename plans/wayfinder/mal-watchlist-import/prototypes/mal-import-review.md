# MAL import review prototype

## Question

What is the smallest understandable settings flow for choosing an MAL XML file, reviewing matched and exceptional rows, confirming one mutation, and seeing the resulting Watchlist and Taste Profile state?

## Run

```powershell
bun run dev
```

Open `/?prototype=mal-import-review`. The selected summary-first design is mounted inside the existing settings dialog.

## Scenario

The prototype uses the supplied 415-row XML's observed catalog coverage: 339 exact MAL-ID matches and 76 unmatched rows. The split of those matched rows into 330 new, 5 conflicts, and 4 unchanged is explicitly illustrative local Watchlist state for comparing the review flows.

All actions are in-memory. The success screen describes the planned result but does not write storage.

## Shared behavior

- Native file input accepts XML; another extension enters a retryable error state.
- Five conflicts default to Keep Rekonime and allow per-row Use MAL overrides.
- The confirmation uses a native dialog, focuses Go back first, states that the batch is not one-step undoable, and reports the current change/skip totals.
- Cancel returns to file selection without mutation. Success reports Watchlist changes and one Taste Profile refresh.
- Headings receive focus after state changes; a polite live region announces review, conflict, cancellation, error, and success status.
- The MAL import sits under Watchlist import. Existing Rekonime JSON import remains a separate Backup and restore concept because it restores the full personal dataset rather than merging MAL progress.

## Verification

- `bun run typecheck` passed.
- `bun run build` passed.
- Playwright exercises the privacy-safe 415-row XML fixture, one Use MAL override, live count update, confirmation cancel-first focus, success focus/status, invalid-file retry focus, and a 390 x 844 viewport.
- Mobile screenshot: [`output/playwright/mal-import-review-mobile.png`](../../../../output/playwright/mal-import-review-mobile.png).
- The dev server logs the repository's existing missing full-catalog-index request; it is outside this prototype and does not block reviewing the flow.

## Verdict

Variant B won through human review on 2026-07-14. Preserve its summary-first split: import totals across the top, conflicts as the main task, and safely skipped or unchanged rows in a secondary rail. Variants A and C and the prototype switcher were deleted.
