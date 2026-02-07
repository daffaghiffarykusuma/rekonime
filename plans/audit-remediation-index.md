# Audit Remediation Index

Date: 2026-02-06
Source: Full audit requested for security, maintenance, DX, and testing.

This index maps each finding to its dedicated implementation plan.

## P0 (Do First)

1. `plans/01-csp-nonce-and-header-hardening.md`
2. `plans/02-embedded-fallback-data-integrity.md`
3. `plans/03-build-mutation-and-reproducibility.md`
4. `plans/04-safe-minification-pipeline.md`

## P1 (Do Next)

5. `plans/05-postmessage-target-origin-lockdown.md`
6. `plans/06-service-worker-json-cache-scope.md`
7. `plans/07-health-page-security-hardening.md`
8. `plans/08-validate-data-script-alignment.md`
9. `plans/09-quality-gates-strict-by-default.md`
10. `plans/10-home-entrypoint-deduplication.md`

## P2 (After Core Hardening)

11. `plans/11-url-sanitization-tightening.md`
12. `plans/12-sw-update-banner-idempotency.md`

## Recommended Execution Order

1. 01 -> 07 (security baseline)
2. 02 -> 08 -> 09 (data integrity and release validation)
3. 03 -> 04 -> 10 (build and maintenance stability)
4. 05 -> 06 -> 11 -> 12 (runtime hardening cleanup)

## Global Completion Criteria

1. All plan-specific acceptance criteria pass.
2. `npm test` and `npm run test:e2e` pass.
3. Lighthouse baseline is re-run and stored in `plans/`.
4. No new CSP violations or console errors in prod build.
