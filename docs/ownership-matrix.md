# Ownership Matrix

Canonical reviewer mapping is codified in `.github/CODEOWNERS`.

## Runtime Domains
- `js/app.js`, `js/watchlist-main.js`, `js/reviews.js`:
  - Owner group: Runtime team
  - Required review focus: user-facing regressions, accessibility, state transitions

## Security-Sensitive Surface
- `vercel.json`, `sw.js`, `js/urlSanitizer.js`, `tools/validate-data.js`, `tools/lib/schema-validator.js`:
  - Owner group: Security + Runtime joint review
  - Required review focus: URL policy, host allowlists, CSP, network/cache behavior

## Data Pipeline
- `tools/*`, `data/*`:
  - Owner group: Data pipeline team
  - Required review focus: schema compatibility, validation gates, rollback safety

## CI and Developer Tooling
- `.github/workflows/*`, `.githooks/*`, `tools/check-*`:
  - Owner group: Platform/DX team
  - Required review focus: deterministic checks, developer friction, CI reliability
