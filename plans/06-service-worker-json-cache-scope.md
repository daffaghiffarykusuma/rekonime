# Plan 06 - Service Worker JSON Cache Scope

Severity: Medium  
Priority: P1

## Objective

Limit JSON caching to explicit same-origin data endpoints.

## Risks Addressed

1. Current `*.json` matching can cache unintended JSON resources.

## Implementation Plan

1. Replace broad `.json` path check with allowlist:
   1. `/data/anime.preview.json`
   2. `/data/anime.full.json`
   3. `/version.json` (if needed)
2. Require same-origin for cache-first data strategy.
3. Add cache key normalization to avoid duplicate path variants.
4. Add tests for allowed and disallowed JSON requests.

## Validation

1. Verify only allowed JSON endpoints are cached.
2. Confirm offline behavior still works for catalog data.

## Exit Criteria

1. SW JSON caching is explicit and bounded.
