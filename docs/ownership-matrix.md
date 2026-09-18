# Ownership Matrix

Canonical reviewer mapping is codified in `.github/CODEOWNERS`.

## Runtime Domains
- `src/app/app.ts`, `src/app/main.ts`, `src/app/watchlist-main.ts`, `src/shared/runtime/serviceWorker.ts`, `src/features/detail/reviews.js`:
  - Owner group: Runtime team
  - Required review focus: user-facing regressions, accessibility, state transitions

## Security-Sensitive Surface
- `vercel.json`, `sw.js`, `src/shared/security/urlSanitizer.ts`, `src/shared/security/trailer-url-policy.ts`, `tools/validate_data.py`:
  - Owner group: Security + Runtime joint review
  - Required review focus: URL policy, host allowlists, CSP, network/cache behavior

## Data Pipeline
- `tools/*_data.py`, `tools/build_catalogs.py`, `tools/quality_reporter.py`, `tools/python_golden_harness.py`, `tools/run-python.js`, `tools/scraper/*`, `data/*`:
  - Owner group: Data pipeline team
  - Required review focus: schema compatibility, validation gates, rollback safety

## CI and Developer Tooling
- `.github/workflows/*`, `.githooks/*`, `tools/check-*`:
  - Owner group: Platform/DX team
  - Required review focus: deterministic checks, developer friction, CI reliability
