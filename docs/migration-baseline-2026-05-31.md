# Rekonime Migration Baseline - 2026-05-31

## Purpose

This baseline supports the JavaScript to Python and TypeScript migration. Later migration PRs should compare their command timings and user-facing measurements against this file and must explain any measured critical-path slowdown greater than 5%.

## Regression Budget

The accepted migration regression budget is no more than 5% slowdown on measured critical paths unless a PR explicitly documents the trade-off and the reviewer accepts it.

## Environment

- Workspace: `C:\Users\Lenovo\Documents\VS Code Projetcs\rekonime`
- Date: 2026-05-31
- Shell: PowerShell
- Bun: 1.3.14
- TypeScript gate: `bun run typecheck`
- Browser measurement target: local production preview at `http://127.0.0.1:4174`
- Lighthouse evidence file: `plans/rekonime-migration-lighthouse-2026-05-31.json`

## Internal Tool Baselines

| Critical path | Command | Result | Elapsed |
| --- | --- | --- | --- |
| TypeScript typecheck | `bun --silent run typecheck` | Passed | 10.846s |
| data validation | `bun --silent run data:validate` | Passed | 0.640s |
| catalog build/regenerate | `bun --silent run data:regenerate` | Passed | 0.248s |
| scraper tests | `bun --silent run test:scraper` | Passed after installing Python dependencies and updating `lxml` pin | 1.608s |
| build verification | `bun --silent run build:verify` | Blocked by dirty tracked worktree at `check:build-clean` | 6.887s to failure |
| build | `bun --silent run build` | Passed | 5.471s |
| post-build verification without clean-worktree gate | `bun --silent run check:entrypoints`, `check:dist-assets`, `check:runtime-preview`, `check:dist-size` | Passed | 1.561s |

## User-Facing Baselines

| Critical path | Measurement source | Result |
| --- | --- | --- |
| bundle size | `bun --silent run check:dist-size` | Total `dist`: 24.65 MiB / 27.00 MiB |
| bundle size | `bun --silent run check:dist-size` | Largest JS asset `js/data.js`: 1.14 MiB; `js/app.ts`: 194.9 KiB |
| preview render | `bun --silent run check:runtime-preview` | Full index raw 3.21 MiB / 4.00 MiB; gzip 554.4 KiB |
| initial load | Playwright measurement on production preview | DOM content loaded 70ms; load event 263ms |
| preview render | Playwright measurement on production preview | `rekonime:catalog-content-rendered` at 681ms |
| detail-modal latency | Playwright measurement on production preview | First catalog card click to visible detail modal: 2472ms |
| watchlist interaction latency | Playwright measurement on production preview | Detail select change to settled interaction: 97ms |
| Lighthouse performance | `npx.cmd --yes lighthouse http://127.0.0.1:4174 --only-categories=performance,accessibility` | Score 0.64 |
| Lighthouse accessibility | Same Lighthouse run | Score 0.97 |
| Lighthouse supporting metrics | Same Lighthouse run | FCP 1455.928ms; LCP 5159.374ms; Speed Index 3500.258ms; TBT 604.018ms; CLS 0 |

## Facts

- CI now has a required TypeScript typecheck step using `bun --silent run typecheck`.
- `docs/ci-local-matrix.md` now documents the local typecheck command as required.
- Direct Node package-script exceptions are inventoried in `docs/node-compatibility-exceptions.json` with reason, owner, and removal condition.
- `test:scraper` needed Python packages before it could produce a baseline on this machine.
- The previous `lxml==5.2.1` requirement failed to install on this Python 3.14 environment because it attempted a native build and required Microsoft C++ Build Tools; `lxml==6.1.1` is installed and supports the scraper tests here.
- `build:verify` could not complete because `check:build-clean` requires no tracked source changes outside `dist/` and `coverage/`, while this migration slice intentionally edits tracked files.

## Assumptions

- The Playwright production-preview timings are suitable for before/after comparisons on this same machine when rerun with the same viewport and local preview target.
- The post-build verification timing without `check:build-clean` is a useful partial substitute while the working tree is intentionally dirty.
- Lighthouse scores from a single local run are a baseline snapshot, not a stable trend. Later PRs should prefer at least three runs when making performance claims.

## Unknowns

- Full `build:verify` elapsed time on a clean worktree was not captured in this run.
- The baseline does not prove performance on CI hardware or deployed production infrastructure.
- The browser latency values do not isolate network variance for external APIs beyond the local Playwright route stubs used during the detail-modal measurement.
