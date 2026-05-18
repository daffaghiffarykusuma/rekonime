# CI to Local Command Matrix

| CI Job Step | Local Repro Command | Required |
| --- | --- | --- |
| Repo hygiene | `bun run check:repo-hygiene` | Yes |
| Unit tests | `bun run test:unit` | Yes |
| Integration tests | `bun run test:integration` | Yes |
| Data validation | `bun run data:validate` | Yes |
| Coverage | `bun run test:coverage` | Yes |
| Coverage thresholds | `bun run check:coverage-thresholds` | Yes |
| Entrypoint dedup | `bun run check:entrypoints` | Yes |
| Distribution asset allowlist | `bun run check:dist-assets` | Yes |
| Distribution size budget | `bun run check:dist-size` | Yes |
| Security audit and policy checks | `bun run check:security` | Yes |

## Optional Local Loops
- Runtime-only checks: `bun run test:runtime`
- Services-only checks: `bun run test:services`
- Tools-only checks: `bun run test:tools`
- Production build smoke: `bun run test:e2e:prod`
- Fast pre-PR sweep: `bun run check:quick`
