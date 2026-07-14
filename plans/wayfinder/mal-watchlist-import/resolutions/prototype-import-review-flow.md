# Resolution: Prototype the MAL import review flow

Use the human-selected summary-first settings flow represented by Variant B.

1. Keep MAL XML under a dedicated **Watchlist import** section. The native file input reads locally and states that no mutation occurs before confirmation.
2. After parsing, show the complete import totals first: total rows, new matches, conflicts, unchanged rows, and unmatched rows.
3. Put the small actionable set of conflicts in the main review column. Each defaults to **Keep Rekonime** and offers an explicit **Use MAL** override with both values visible.
4. Put safe exceptions in a secondary rail: unmatched titles are skipped with representative examples rather than all 76 rows, while unchanged rows are summarized as no-ops.
5. **Cancel import** returns to file selection without mutation. The primary action reports the live number of proposed Watchlist changes.
6. Use a native confirmation dialog before apply. Focus **Go back** first; state the number added, updated, and skipped, preservation of loved evidence, the single Taste Profile refresh, and that the batch has no one-step undo.
7. On success, focus and announce the combined Watchlist and Taste Profile result. On invalid input, focus an alert, state that nothing changed, and provide retry that returns focus to the file input.

Existing Rekonime JSON import remains outside this flow under **Rekonime backup**. It restores the full personal dataset; MAL XML merges Watchlist progress and must not look interchangeable with backup restore.

The selected prototype uses the supplied file's observed scale of 415 rows, 339 exact matches, and 76 unmatched rows. Its 330-new, 5-conflict, and 4-unchanged split is illustrative local Watchlist state, not a fixture fact.

Prototype and verification details: [MAL import review prototype](../prototypes/mal-import-review.md).
