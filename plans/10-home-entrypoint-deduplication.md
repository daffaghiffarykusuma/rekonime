# Plan 10 - Home Entrypoint Deduplication

Severity: Medium  
Priority: P1

## Objective

Eliminate drift between `index.html` and `home/index.html`.

## Risks Addressed

1. Regex sync script can miss cases and create divergence.
2. Maintenance burden for parallel HTML entry files.

## Implementation Plan

1. Choose single canonical HTML source.
2. Serve `/home` via rewrite/redirect only, without duplicated file content.
3. Remove brittle sync transformations in `tools/sync-home-index.ps1`.
4. Add automated check to assert no duplicate entry template copies.

## Validation

1. Verify `/` and `/home` render same experience.
2. Confirm links/canonical logic remain correct.

## Exit Criteria

1. One authoritative entry template for home page content.
