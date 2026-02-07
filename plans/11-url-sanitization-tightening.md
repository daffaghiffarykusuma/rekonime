# Plan 11 - URL Sanitization Tightening

Severity: Low  
Priority: P2

## Objective

Harden URL sanitization behavior to reject ambiguous relative/scheme-less inputs where not required.

## Risks Addressed

1. Relative or protocol-relative inputs can bypass intent of strict URL policies.

## Implementation Plan

1. Review all `sanitizeUrl` and `sanitizeImageUrl` call sites.
2. Default to `allowRelative: false` in security-sensitive sinks.
3. Keep relative URL support only where clearly needed for internal assets.
4. Centralize sanitizer behavior to avoid drift across modules.

## Validation

1. Add tests for:
   1. `//host/...` inputs
   2. `javascript:` inputs
   3. relative path inputs
2. Confirm no UI regressions for legitimate internal URLs.

## Exit Criteria

1. Sanitizers have explicit trust model and consistent behavior.
