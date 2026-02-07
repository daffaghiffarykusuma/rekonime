# Plan 08 - Validate Data Script Alignment

Severity: Medium  
Priority: P1

## Objective

Make `tools/validate-data.js` validate the current architecture correctly.

## Risks Addressed

1. Script still expects inline `ANIME_DATA` in `index.html`.
2. False positives/negatives in data validation pipeline.

## Implementation Plan

1. Update validation source from inline HTML parsing to `js/data.js`.
2. Parse `js/data.js` constant payload safely and validate schema.
3. Keep optional checks for `index.html` references only (not payload).
4. Add tests for both success and malformed `js/data.js`.

## Validation

1. Run script against current repo and ensure accurate results.
2. Intentionally inject malformed fallback data and verify failure.

## Exit Criteria

1. Validator reflects real runtime data loading path.
