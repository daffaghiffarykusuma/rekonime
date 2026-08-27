# CI to Local Command Matrix

| CI Job Step | Local Repro Command | Required |
| --- | --- | --- |
| Python runtime setup | `python --version` or `python3 --version` | Yes in CI |
| Repo hygiene | `bun run check:repo-hygiene` | Yes |
| TypeScript typecheck | `bun run typecheck` | Yes |
| Unit tests | `bun run test:unit` | Yes |
| Integration tests | `bun run test:integration` | Yes |
| Python golden fixtures | `bun run test:golden` | Yes |
| Catalog build | `bun run data:build -- --incremental` | No |
| Data validation | `bun run data:validate` | Yes |
| Coverage | `bun run test:coverage` | Yes |
| Build verification | `bun run build:verify` | Yes |
| Distribution asset allowlist | `bun run check:dist-assets` | Yes |
| Runtime catalog budget | `bun run check:runtime-preview` | Yes |
| Distribution size budget | `bun run check:dist-size` | Yes |
| Security audit and policy checks | `bun run check:security` | Yes |

## Optional Local Loops
- Runtime-only checks: `bun run test:runtime`
- Services-only checks: `bun run test:services`
- Tools-only checks: `bun run test:tools`
- Golden fixture update for intentional diffs: `bun tools/run-python.js tools/python_golden_harness.py --update`
- Catalog rebuild: `bun run data:build`, then `bun run data:regenerate`
- Production build smoke: `bun run test:e2e:prod`
- Fast pre-PR sweep: `bun run check:quick`
