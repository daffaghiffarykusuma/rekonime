# Plan 02 - Embedded Fallback Data Integrity

Severity: High  
Priority: P0

## Objective

Guarantee `js/data.js` preserves correct JSON structure and stays schema-compatible with `data/anime.full.json`.

## Risks Addressed

1. PowerShell `ConvertTo-Json` depth truncation converts nested objects/arrays into strings.
2. Fallback mode (`file://` or fetch failure) can silently degrade or fail.

## Implementation Plan

1. Replace `tools/regenerate-data.ps1` JSON serialization with a depth-safe strategy:
   1. Either `ConvertTo-Json -Depth 100`.
   2. Or call Node to serialize (`JSON.stringify`) from `data/anime.full.json`.
2. Add shape validation after generation:
   1. Parse `js/data.js`.
   2. Assert `anime[].genres` is array, `trailer` is object/null, `episodes` is array, `stats` is object.
3. Add CI/test check to fail if generated fallback is structurally invalid.

## Validation

1. Run generation script and parse output programmatically.
2. Run `npm test` plus a new test for fallback data shape.
3. Manual check: disable network and confirm app uses fallback correctly.

## Exit Criteria

1. `js/data.js` fully matches expected structure.
2. Automated test guards against future truncation regressions.
