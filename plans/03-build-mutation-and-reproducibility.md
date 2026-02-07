# Plan 03 - Build Mutation And Reproducibility

Severity: High  
Priority: P0

## Objective

Stop mutating source files during build and make artifacts reproducible across environments.

## Risks Addressed

1. `tools/generate-version.js` rewrites `sw.js` in-place.
2. Dirty worktree after build and CI inconsistency risk.

## Implementation Plan

1. Remove in-place `sw.js` edits from build flow.
2. Inject build version at bundle time using Vite define/env replacement.
3. Use immutable source + generated dist artifacts only.
4. Keep `version.json` generation, but treat it as output artifact.
5. Add a CI check that `npm run build` leaves source tree unchanged.

## Validation

1. Run clean build twice and diff `dist/`.
2. Verify service worker gets correct cache version from build-time token.
3. Confirm `git status` has no source mutations after build.

## Exit Criteria

1. No source rewrite in build scripts.
2. Repeated builds are deterministic for identical inputs.
