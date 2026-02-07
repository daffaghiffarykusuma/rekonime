# Plan 01 - CSP Nonce And Header Hardening

Severity: High  
Priority: P0

## Objective

Replace static nonce usage and enforce CSP via HTTP headers for all served pages.

## Risks Addressed

1. Static nonce (`rekonime-inline`) is predictable.
2. Meta-tag CSP is weaker than response-header CSP.

## Implementation Plan

1. Move CSP from HTML meta tags to deployment headers in `vercel.json`.
2. Keep `object-src 'none'`, `base-uri 'self'`, and strict `connect-src`.
3. Remove nonce dependency from static inline scripts by externalizing them into local JS files.
4. If any inline script must remain, generate per-response nonce at edge middleware (or eliminate inline scripts fully).
5. Add `Strict-Transport-Security` and consider `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` after compatibility check.

## Validation

1. Inspect response headers for `/`, `/home`, `/watchlist.html`, `/health.html`.
2. Confirm CSP header is present and meta CSP is removed.
3. Verify no runtime CSP violations in browser console.

## Exit Criteria

1. No static nonce in HTML.
2. CSP delivered by headers for all entry points.
3. App works without CSP console errors.
