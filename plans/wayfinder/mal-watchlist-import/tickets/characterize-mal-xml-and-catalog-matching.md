---
title: Characterize MAL XML compatibility and catalog matching
label: wayfinder:research
parent: ../map.md
status: closed
assignee: codex
blocked_by: []
closed_at: 2026-07-14
resolution_comment: ../resolutions/characterize-mal-xml-and-catalog-matching.md
---

## Question

Which fields and variants in the supplied MyAnimeList XML export must Rekonime accept, how reliably can `series_animedb_id` match the current Catalog Payload's `malId`, and what deterministic fallback or unmatched-row result should the implementation plan require?

## Resolution requirements

- Produce a linked Markdown research summary with observed XML fields, encodings, status values, malformed-input cases, sample row counts, catalog match coverage, and unmatched examples.
- Distinguish facts observed in the supplied file from assumptions about other MAL exports.
- Recommend the smallest supported input contract; do not design provider-general abstractions.
