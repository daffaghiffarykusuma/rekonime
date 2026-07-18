# App Shell Migration Decision

Date: 2026-05-31

## Decision

Convert the app orchestration shell and browser boot modules to TypeScript entrypoints in this slice and retire the temporary JavaScript compatibility wrappers.

Converted surfaces:
- `js/app.ts`
- `js/main.ts`
- `js/watchlist-main.ts`
- `js/serviceWorker.ts`

## Rationale

The extracted Catalog Runtime, Watchlist Lifecycle, URL policy, calculations, catalog services, Detail Experience, Airing Schedule, Runtime Capabilities, and keyboard modules now have TypeScript entrypoints and contract tests. That makes a mechanical app-shell conversion lower risk because the large shell can keep calling stable module boundaries.

The HTML script URLs now point directly at `/js/main.ts` and `/js/watchlist-main.ts`; Vite emits production JavaScript assets during build.

## Scope Limits

This slice does not rewrite the large shell internals into fully typed implementation code. The converted shell files use `// @ts-nocheck` as a migration bridge so runtime behavior remains the controlling acceptance criterion.

Remaining JavaScript runtime surfaces:
- `js/reviews.js`, `js/themeManager.js`, `js/discovery.js`, `js/onboarding.js`, `js/image-proxy*.js`, and small bootstrap helpers remain JavaScript.
- Owner: Runtime team.
- Removal condition: convert after the app shell is stable on direct TypeScript entrypoints and after each module has focused behavior tests or is proven to be pure side-effect bootstrap code.

## Regression Budget

Migration PRs keep the existing 5% budget for measured critical paths. This slice relies on existing unit/integration coverage, production build output, post-build runtime preview validation, and size budget checks. Browser smoke checks should be used before merge for boot, render, filtering, detail modal, watchlist, PWA update prompt, and theme behavior.
