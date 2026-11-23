# Episode rating strength

Scoring version 3 ranks a title's episode poll ratings against the catalog on a 1–100 scale: 80 means the title's raw index is higher than about 80% of catalog titles. It is not a retention rate, completion probability, or a prediction validated against viewing activity. The internal `retentionScore` key remains for compatibility.

## Raw index

The raw index blends three parts. The opening takes its weight first; the rest is split 45:20 between rating weakness and ending hold, which is 45% and 20% of the total when the opening has its full 35%.

- **Opening** – average rating of episodes 1–3 at their actual positions. Its weight starts at 35%, shrinks for series longer than six episodes (a strong finish softens that shrink), and falls when opening episodes are missing.
- **Rating weakness, inverted** – the 45 share of the rest. Consecutive ratings below the catalog baseline add a gradual severity penalty instead of a fixed three-episode cliff, and gaps in episode numbering break consecutive runs. Recent weak ratings and a low average also count.
- **Ending hold** – the 20 share of the rest. Only an ending weaker than the series average costs points (`100 + min(0, momentum)`); a steady or rising ending keeps full credit, so consistently excellent series are not capped.

A title rated 5/5 on every episode scores a raw 100. Version 2's flow term was removed: episode-to-episode changes are small enough that 90% of titles scored 98–100 on it. The second strictness curve on the blend was also removed; component scores keep their own curves.

## Catalog ranking and evidence

Episode ratings cluster high (catalog median about 4.3/5), so raw values bunch together: the middle half of titles falls between about 73 and 92. The build therefore stores `scoreProfile.strengthQuantiles`: raw values at catalog percentiles 0–100 across every title with episode ratings. A title's percentile is read from that table, linearly between breakpoints and at the midpoint across tied breakpoints. The raw value is rounded to two decimals for the lookup, matching the table, so identical titles land on the same point of a tie. When stats must be calculated in the browser and the payload's profile has no valid table (an older payload), the browser first builds one from the loaded titles' episode ratings under that profile's baseline. With fewer than five rated titles there is no table and the raw index is used directly, which is not a percentile.

Evidence pulls the percentile toward the catalog median: `50 + (percentile - 50) * weight`, rounded and clamped to 1–100. The weight combines sample size (up to 12 rated episodes, or the declared length for shorter series), square-root coverage, known episode positions, and median vote count when available. Missing voter counts do not imply a measured confidence level. No ratings produces 0, the existing unavailable-data sentinel, which is why 1 is the lowest shown value.

When the evidence weight is below 0.5, cards lead with the Community Score (MAL) if the title has one, and Surprise Me's episode-rating quality check does not pass the title. That check applies to titles with at least three rated episodes, counted from the stored rating evidence because the runtime catalog index omits episode lists. The strength is mostly the median prior at that point.

Strength bands are shares of the catalog: 85+ high (top 15%), 50+ mid (at or above the median), 20+ low, and below 20 poor. A sparse title pulled to 50 is therefore never marked poor.

Because the score is relative, a title's value can move when the catalog is rebuilt, even if its own ratings did not change.

## Coverage and limits

Coverage uses the declared episode count or, if unknown, the highest observed position. Unknown totals remain explicitly labeled unknown. Duplicate positions count once. Limited data means fewer than six rated episodes (or the declared shorter length), coverage below 60%, unknown positions, or a known median below ten votes. Airing titles are labeled provisional; missing completion status stays unknown.

These thresholds are heuristics, not statistically calibrated confidence intervals. Scores near 50 on sparse titles indicate insufficient evidence, not proven median quality. Episode poll participants may differ from all viewers, including viewers who stopped watching. On the current catalog, version 3's rank agreement with MAL scores (Spearman 0.715) is about the same as version 2's (0.726) and slightly below a plain episode average (0.748), so the index describes rating patterns rather than predicting community scores.

`src/features/discovery/stats.ts` and `tools/build_catalogs.py` implement the same calculation, including the quantile table. The real-catalog contract test compares both implementations for every title. Regression tests cover sparse samples, actual opening positions, duplicates, vote evidence, gradual penalty behavior, the perfect-series ceiling, decline-only ending credit, and percentile lookup. A separate parity test runs the Python ranking against the browser on tied breakpoints, values outside the table, invalid tables, and catalogs below the five-title minimum.

## Discovery suggestions

Viewing goals use catalog genres and themes, independently of episode poll patterns. Unwind favors Slice of Life or Iyashikei unless Horror, Gore, Psychological, or Suspense tags are present. Energy favors Action or Sports; emotional favors Drama, Romance, Music, or Performing Arts; immersive favors Fantasy, Adventure, Sci-Fi, Isekai, Mythology, or Space. These are suggestions rather than promises about a viewer's experience. Unknown tags produce no mood cues.

Cards label positive net taste matches as personalized, active viewing goals as session picks, and remaining picks as general. Reasons use matched explicit preferences or positive watchlist evidence, the matching goal signal, catalog watch-order eligibility, or the selected rating mode. Negative net taste evidence never generates a positive personalized label.

Known franchises contribute at most one title to recommendations. Entry titles are eligible immediately. Later main entries require every earlier recorded main entry to be completed; side stories require their recorded anchor to be completed. Unresolved external prerequisites block continuations. Missing franchise metadata leaves eligibility unknown; titles are not classified by guessing from their names. This policy is conservative for branched franchises.
