# Plan 07 - Health Page Security Hardening

Severity: Medium  
Priority: P1

## Objective

Bring `health.html` to same baseline security controls as main entry pages.

## Risks Addressed

1. Missing explicit CSP and weaker inline-script posture on health page.

## Implementation Plan

1. Add response-header CSP coverage for `health.html`.
2. Move inline health-check script into external module (preferred).
3. Restrict `connect-src` on this page to only required endpoints.
4. Ensure same referrer and framing protections apply.

## Validation

1. Response headers show expected protections on `/health.html`.
2. Health checks still run without CSP violations.

## Exit Criteria

1. `health.html` security headers align with app baseline.
