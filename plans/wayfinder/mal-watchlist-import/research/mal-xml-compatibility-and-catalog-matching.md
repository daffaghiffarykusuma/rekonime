# MAL XML compatibility and catalog matching

## Answer

Support the privately reviewed MyAnimeList export shape directly and match rows only by numeric `series_animedb_id === malId` after the full Catalog Payload is available. In that export, **339 of 415 rows (81.69%)** matched. Do not use title fallback: the current catalog omitted every non-TV row in the reviewed export, and normalization incorrectly mapped at least two distinct MAL entries to a base series. Unmatched rows should remain explicit import results and must not create Watchlist Entries.

## Sources and method

Primary local sources:

- Original private MAL export: reviewed locally for this audit, then removed from version control. Only aggregate, non-identifying findings are retained below.
- Privacy-safe regression fixture: `test/helpers/mal-watchlist-fixture.js` preserves the 415-row, 339-match, 76-unmatched acceptance case without user data.
- Current full catalog: `data/anime.full.json:1`, generated `2026-07-13T07:03:08.000Z` with 3,578 anime records.
- Catalog normalization: `js/services/catalog-payload.ts` normalizes source `malId`/`mal_id` into runtime `malId` and validates Catalog Payloads as `anime` arrays.
- Existing repository MAL parser precedent: `tools/scraper/convert_mal_export.py:24-51` parses direct `anime` children and reads `series_animedb_id`, title, type, episode count, status, and score.
- Watchlist contract: `js/contracts/watchlist-lifecycle.ts:1-5` permits `planned`, `watching`, `completed`, and `dropped`; `js/contracts/watchlist-lifecycle.ts:37-40` stores status and numeric progress. It has no `on-hold` status.

The aggregate counts below were computed from the original private export with Python's standard-library `xml.etree.ElementTree` and `json` modules; no fuzzy matcher or external dataset was used. The original file is no longer retained, so only the privacy-safe 339/415 regression case remains reproducible in this repository.

## Observed export facts

### File and document shape

- The file was 401,169 bytes, had no UTF-8 BOM, used LF newlines, declared XML 1.0 with UTF-8 encoding, and decoded strictly as UTF-8.
- The root was `myanimelist`, with one direct `myinfo` child and 415 direct `anime` children. Its comment identified MAL XML Export version `1.1.0`.
- `myinfo` declared 415 total anime: 13 watching, 338 completed, 1 on hold, 2 dropped, and 61 planned. These categories summed to 415 and matched the row-level counts.
- All 415 `anime` elements had the same 23-child MAL export structure. Titles, comments, and tags used CDATA in the reviewed sample.

### Values relevant to import

| Field | Observed values |
|---|---|
| `series_animedb_id` | 415 present positive integers, range 1,735-63,337; all unique |
| `series_title` | 415 present non-empty strings; all unique |
| `series_type` | TV 346; Movie 37; OVA 12; Special 9; ONA 8; TV Special 3 |
| `series_episodes` | Integer range 0-500; three rows use `0` for unknown/not-yet-known totals |
| `my_watched_episodes` | Integer range 0-500; no row exceeds a positive `series_episodes` total |
| `my_status` | Completed 338; Plan to Watch 61; Watching 13; Dropped 2; On-Hold 1 |
| `my_score` | Integer 0-10; 76 rows are `0` (unscored) |
| dates | `0000-00-00` is the missing-value sentinel: 394 start dates and 290 finish dates use it |

The reviewed sample demonstrated all five statuses: `Completed`, `Plan to Watch`, `On-Hold`, `Watching`, and `Dropped`. It also demonstrated that `TV Special` is a distinct source type and that zero episode totals are valid source data rather than malformed rows.

Fields not needed to create/update progress are uniform or empty in this sample: `my_priority=LOW`, `my_sns=default`, `update_on_import=0`, `my_rewatching=0`, `my_times_watched=0`, `my_discuss=1`; all comments, tags, rating labels, storage labels, and rewatch values are empty. They should not expand the initial product contract.

## Catalog match results

The source catalog `data/anime.json` and generated full payload `data/anime.full.json` each contain 3,578 unique numeric MAL IDs and produce the same result: **339 matched, 76 unmatched**. The 200-row preview payload matches only 25 export rows, so matching against whichever preview happens to be loaded would incorrectly report 314 full-catalog titles as absent.

| MAL status | Rows | Full-catalog matches | Unmatched | Coverage |
|---|---:|---:|---:|---:|
| Completed | 338 | 277 | 61 | 81.95% |
| Plan to Watch | 61 | 46 | 15 | 75.41% |
| Watching | 13 | 13 | 0 | 100.00% |
| Dropped | 2 | 2 | 0 | 100.00% |
| On-Hold | 1 | 1 | 0 | 100.00% |
| **Total** | **415** | **339** | **76** | **81.69%** |

The coverage gap is structural. Every one of the 3,578 full-catalog records has `type: "TV"`. Consequently, all 69 non-TV source rows are unmatched: 37 Movies, 12 OVAs, 9 Specials, 8 ONAs, and 3 TV Specials. Seven TV rows are also absent.

Representative unmatched rows:

| MAL ID | Title | Status | Type | Why exact matching fails |
|---:|---|---|---|---|
| 48548 | 5-toubun no Hanayome Movie | Plan to Watch | Movie | No catalog record with MAL ID 48548 |
| 36214 | Asagao to Kase-san. | Completed | OVA | No catalog record with MAL ID 36214 |
| 38002 | Asobi Asobase Specials | Completed | Special | No catalog record with MAL ID 38002 |
| 60489 | Takopii no Genzai | Completed | ONA | No catalog record with MAL ID 60489 |
| 61324 | BanG Dream! It's MyGO!!!!! / Ave Mujica | Plan to Watch | TV | No catalog record with MAL ID 61324; source episode total is 0 |
| 40738 | Natsunagu! | Completed | TV | No catalog record with MAL ID 40738 |

### Why title fallback is unsupported

Applying the repository's broad search-style normalization (case folding, Unicode normalization, punctuation removal, and whitespace collapse; see `js/services/catalog-payload.ts:42-99`) to the 76 unmatched titles finds two apparent unique matches, but both are wrong:

- MAL 58755, `5-toubun no Hanayome*` (TV Special), collapsed to catalog MAL 38101, `5-toubun no Hanayome` (TV) in the reviewed sample.
- MAL 37773, `Yuru Yuri,` (OVA), collapsed to catalog MAL 10495, `Yuru Yuri` (TV) in the reviewed sample.

Thus title normalization adds **zero verified matches** and two demonstrated false positives. Exact MAL ID is the only supported deterministic key.

## Malformed-input and variant concerns

These are **validation concerns**, not defects observed in the privately reviewed file:

- Reject a document that cannot be decoded as UTF-8 or parsed as well-formed XML, has a root other than `myanimelist`, or has no direct `anime` rows. Do not try to recover with regex.
- Reject `DOCTYPE`/entity declarations. They are absent from the sample and unnecessary for this contract.
- Treat a row as invalid when a required field is missing, duplicated within the row, or outside its domain: non-positive/non-integer MAL ID; empty title; negative/non-integer progress; negative/non-integer episode total; or an unknown status.
- Treat duplicate `series_animedb_id` rows as an explicit validation error rather than silently choosing the first or last row. The sample has none.
- Preserve `series_episodes=0` as "unknown total" and `0000-00-00` as "unknown date"; neither is an error in the sample.
- Report, rather than silently clamp, watched progress greater than a positive episode total. The sample has no such inconsistency.
- Ignore additional root, `myinfo`, or `anime` fields after validating the required fields. Future MAL variants are an assumption until another real export fixture demonstrates them.

The existing scraper parser is useful precedent but not sufficient as the product boundary: it skips rows missing ID/title and calls `int(...)` directly (`tools/scraper/convert_mal_export.py:31-49`), so it does not return reviewable row-level validation results.

## Smallest supported contract recommendation

### Accepted file

1. UTF-8, well-formed XML without `DOCTYPE` or entity declarations.
2. Root `myanimelist` with one or more direct `anime` children.
3. Per row, require exactly one non-empty `series_animedb_id`, `series_title`, `my_status`, and `my_watched_episodes`.
4. Accept `my_status` only as the five values observed here: `Watching`, `Completed`, `On-Hold`, `Dropped`, `Plan to Watch`.
5. Accept optional `series_episodes` as a non-negative integer; `0` means unknown. Ignore all other fields for the first import version.

This is deliberately MAL-specific. Do not add a provider interface, title matcher, date parser, score ingestion, or support for unobserved XML layouts.

### Matching and result

1. Wait for the full Catalog Payload, then build a lookup by numeric `malId`.
2. Match only exact numeric MAL IDs. Catalog `malId` is the external identity; Watchlist Entries continue to use the matched catalog `id` and snapshot (`js/contracts/watchlist-lifecycle.ts:17-40`).
3. A valid row with no exact catalog match yields an unmatched result such as `{ row, malId, title, sourceStatus, watchedEpisodes, reason: "catalog-not-found" }`; it creates or updates nothing.
4. An invalid row yields a distinct validation result, not `catalog-not-found`. Whether any invalid row blocks the whole import belongs to the acceptance/recovery decision ticket.
5. Keep `On-Hold` distinct in the parsed result. Mapping it into Rekonime's four statuses belongs to the watchlist import contract/merge decision; this research does not silently collapse it.

## Facts, assumptions, and open decisions

**Facts:** the privately reviewed file was a consistent MAL XML Export v1.1.0 sample; exact full-catalog MAL ID coverage was 339/415; preview-only coverage was 25/415; the current full catalog was TV-only; title normalization created two demonstrated cross-entry false positives; the Watchlist contract has no on-hold status.

**Assumptions:** other MAL exports may omit, add, reorder, or vary fields; may contain duplicate IDs or malformed values; and may use the same five statuses and UTF-8 document shape. None of those variants is proven by this single fixture.

**Open for later tickets:** mapping `On-Hold`; merge precedence for existing progress/status; whole-file versus partial acceptance; review/confirmation UI; and when Taste Profile refresh occurs after applied Watchlist mutations.

## Reproduction

Run from the repository root. This verifies the privacy-safe 415-row, 339-match, 76-unmatched regression case without retaining personal export data:

```powershell
bun test test/unit/mal-watchlist-import.test.ts
```
