# Episode rating strength

Scoring version 2 describes episode poll ratings on a 0–100 scale. It is not a retention rate, completion probability, or a prediction validated against viewing activity. The internal `retentionScore` key remains for compatibility.

The base index combines opening ratings, inverse rating weakness, momentum, and flow. Opening weight uses actual episode positions 1–3; missing opening episodes reduce that weight. Consecutive weak ratings contribute a gradual severity penalty instead of a fixed three-episode cliff. Gaps in episode numbering break consecutive runs.

Evidence adjusts the base score toward 50: `50 + (base - 50) * weight`. The weight combines sample size (up to 12 rated episodes, or the declared length for shorter series), square-root coverage, known episode positions, and median vote count when available. Missing voter counts do not imply a measured confidence level. No ratings produces 0, the existing unavailable-data sentinel.

Coverage uses the declared episode count or, if unknown, the highest observed position. Unknown totals remain explicitly labeled unknown. Duplicate positions count once. Limited data means fewer than six rated episodes (or the declared shorter length), coverage below 60%, unknown positions, or a known median below ten votes. Airing titles are labeled provisional; missing completion status stays unknown.

These thresholds are heuristics, not statistically calibrated confidence intervals. Sparse scores near 50 indicate insufficient evidence, not proven average quality. Episode poll participants may differ from all viewers, including viewers who stopped watching.

`src/features/discovery/stats.ts` and `tools/build_catalogs.py` implement the same calculation. The real-catalog contract test compares both implementations for every title. Regression tests cover sparse samples, actual opening positions, duplicates, vote evidence, and gradual penalty behavior.

## Discovery suggestions

Viewing goals use catalog genres and themes, independently of episode poll patterns. Unwind favors Slice of Life or Iyashikei unless Horror, Gore, Psychological, or Suspense tags are present. Energy favors Action or Sports; emotional favors Drama, Romance, Music, or Performing Arts; immersive favors Fantasy, Adventure, Sci-Fi, Isekai, Mythology, or Space. These are suggestions rather than promises about a viewer's experience. Unknown tags produce no mood cues.

Cards label positive net taste matches as personalized, active viewing goals as session picks, and remaining picks as general. Reasons use matched explicit preferences or positive watchlist evidence, the matching goal signal, catalog watch-order eligibility, or the selected rating mode. Negative net taste evidence never generates a positive personalized label.

Known franchises contribute at most one title to recommendations. Entry titles are eligible immediately. Later main entries require every earlier recorded main entry to be completed; side stories require their recorded anchor to be completed. Unresolved external prerequisites block continuations. Missing franchise metadata leaves eligibility unknown; titles are not classified by guessing from their names. This policy is conservative for branched franchises.
