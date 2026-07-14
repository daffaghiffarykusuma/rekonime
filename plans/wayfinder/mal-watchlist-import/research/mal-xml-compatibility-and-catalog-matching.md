# MAL XML compatibility and catalog matching

## Answer

Support the supplied MyAnimeList export shape directly and match rows only by numeric `series_animedb_id === CatalogAnimeBase.malId` after the full Catalog Payload is available. On the supplied export, that matches **339 of 415 rows (81.69%)**. Do not use title fallback: the current catalog omits every non-TV row in this export, and normalization incorrectly maps at least two distinct MAL entries to a base series. Unmatched rows should remain explicit import results and must not create Watchlist Entries.

## Sources and method

Primary local sources:

- Supplied MAL export: `plans/animelist_1784001772_-_10574948.xml:1-46` (XML declaration, export comment, user totals, and first complete row).
- Current full catalog: `data/anime.full.json:1`, generated `2026-07-13T07:03:08.000Z` with 3,578 anime records.
- Catalog contract: `js/contracts/catalog-runtime.ts:97-118` defines the runtime entry and optional numeric `malId`; `js/contracts/catalog-runtime.ts:139-151` defines Catalog Payloads as `anime` arrays.
- Catalog normalization: `js/services/catalog-payload.ts:126-190`, especially `:168`, normalizes source `malId`/`mal_id` into runtime `malId`.
- Existing repository MAL parser precedent: `tools/scraper/convert_mal_export.py:24-51` parses direct `anime` children and reads `series_animedb_id`, title, type, episode count, status, and score.
- Watchlist contract: `js/contracts/watchlist-lifecycle.ts:1-5` permits `planned`, `watching`, `completed`, and `dropped`; `js/contracts/watchlist-lifecycle.ts:37-40` stores status and numeric progress. It has no `on-hold` status.

All counts below were recomputed with Python's standard-library `xml.etree.ElementTree` and `json` modules; no fuzzy matcher or external dataset was used.

## Observed export facts

### File and document shape

- The file is 401,169 bytes, has no UTF-8 BOM, uses LF newlines, declares `<?xml version="1.0" encoding="UTF-8" ?>`, and decodes strictly as UTF-8 (`plans/animelist_1784001772_-_10574948.xml:1`).
- The root is `myanimelist`, with one direct `myinfo` child and 415 direct `anime` children. The comment identifies the producer as MAL's XML Export feature, version `1.1.0` (`plans/animelist_1784001772_-_10574948.xml:2-5`).
- `myinfo` declares 415 total anime: 13 watching, 338 completed, 1 on hold, 2 dropped, and 61 planned. These categories sum to 415 and exactly equal the row-level status counts (`plans/animelist_1784001772_-_10574948.xml:8-18`).
- All 415 `anime` elements have the same 23 children, in this order: `series_animedb_id`, `series_title`, `series_type`, `series_episodes`, `my_id`, `my_watched_episodes`, `my_start_date`, `my_finish_date`, `my_rated`, `my_score`, `my_storage`, `my_storage_value`, `my_status`, `my_comments`, `my_times_watched`, `my_rewatch_value`, `my_priority`, `my_tags`, `my_rewatching`, `my_rewatching_ep`, `my_discuss`, `my_sns`, and `update_on_import` (`plans/animelist_1784001772_-_10574948.xml:22-44`). Titles, comments, and tags use CDATA in the sample (`:23`, `:36`, `:40`).

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

The sample demonstrates all five statuses (`Completed` at `:35`, `Plan to Watch` at `:139`, `On-Hold` at `:529`, `Watching` at `:919`, and `Dropped` at `:1595`). It also demonstrates that `TV Special` is a distinct source type (`:155`) and that zero episode totals are valid source data rather than malformed rows (`:858`, `:2132`, `:8736`).

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

- MAL 58755, `5-toubun no Hanayome*` (TV Special), collapses to catalog MAL 38101, `5-toubun no Hanayome` (TV). The distinct source entry begins at `plans/animelist_1784001772_-_10574948.xml:153`.
- MAL 37773, `Yuru Yuri,` (OVA), collapses to catalog MAL 10495, `Yuru Yuri` (TV). The distinct source entry begins at `plans/animelist_1784001772_-_10574948.xml:10631`.

Thus title normalization adds **zero verified matches** and two demonstrated false positives. Exact MAL ID is the only supported deterministic key.

## Malformed-input and variant concerns

These are **validation concerns**, not defects observed in the supplied file:

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

**Facts:** the supplied file is a consistent MAL XML Export v1.1.0 sample; exact full-catalog MAL ID coverage is 339/415; preview-only coverage is 25/415; the current full catalog is TV-only; title normalization creates two demonstrated cross-entry false positives; the Watchlist contract has no on-hold status.

**Assumptions:** other MAL exports may omit, add, reorder, or vary fields; may contain duplicate IDs or malformed values; and may use the same five statuses and UTF-8 document shape. None of those variants is proven by this single fixture.

**Open for later tickets:** mapping `On-Hold`; merge precedence for existing progress/status; whole-file versus partial acceptance; review/confirmation UI; and when Taste Profile refresh occurs after applied Watchlist mutations.

## Reproduction

Run from the repository root. This command verifies row totals, per-status counts, catalog type scope, and exact full/preview match coverage without creating files:

```powershell
$env:PYTHONIOENCODING='utf-8'
@'
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
import json

rows = ET.parse('plans/animelist_1784001772_-_10574948.xml').getroot().findall('anime')
ids = [int(row.findtext('series_animedb_id')) for row in rows]
statuses = [row.findtext('my_status') for row in rows]
types = [row.findtext('series_type') for row in rows]

print('rows', len(rows), 'unique_ids', len(set(ids)))
print('statuses', Counter(statuses))
print('source_types', Counter(types))

for path in ('data/anime.full.json', 'data/anime.preview.json', 'data/anime.json'):
    anime = json.loads(Path(path).read_text(encoding='utf-8'))['anime']
    mal_ids = {
        int(item.get('malId') or item.get('mal_id') or (item.get('metadata') or {}).get('malId'))
        for item in anime
    }
    print(path, 'rows', len(anime), 'matches', sum(mal_id in mal_ids for mal_id in ids))

full = json.loads(Path('data/anime.full.json').read_text(encoding='utf-8'))['anime']
print('catalog_types', Counter(item.get('type') for item in full))
'@ | python -
```
