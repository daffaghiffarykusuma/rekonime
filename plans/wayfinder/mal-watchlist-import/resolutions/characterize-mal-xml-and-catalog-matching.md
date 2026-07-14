---
ticket: ../tickets/characterize-mal-xml-and-catalog-matching.md
resolved_at: 2026-07-14
---

# Resolution: Characterize MAL XML compatibility and catalog matching

Support the supplied UTF-8 MAL XML Export v1.1.0 shape with a deliberately MAL-specific parser. Require direct `anime` rows with one positive integer `series_animedb_id`, non-empty `series_title`, one of the five observed statuses, and non-negative integer `my_watched_episodes`; `series_episodes` is optional and `0` means unknown. Ignore unrelated fields in the first version.

Match only `series_animedb_id` to the full Catalog Payload's numeric `malId`. The supplied export contains 415 unique rows: 339 match the full catalog (81.69%), while only 25 match the preview catalog. The 76 valid unmatched rows stay explicit import results and create or update nothing. Do not use title fallback: normalization produced two false cross-entry matches and zero verified additions.

Reject malformed XML, an unexpected root, `DOCTYPE`/entities, missing or duplicated required fields, invalid numeric domains, unknown statuses, and duplicate MAL IDs with explicit validation results. Preserve `On-Hold`, zero episode totals, and missing-date sentinels as source facts for later mapping decisions.

Evidence and reproducible calculations: [MAL XML compatibility and catalog matching](../research/mal-xml-compatibility-and-catalog-matching.md).
