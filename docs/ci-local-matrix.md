# CI to Local Command Matrix

| CI Job Step | Local Repro Command | Required |
| --- | --- | --- |
| Repo hygiene | `npm run check:repo-hygiene` | Yes |
| Unit tests | `npm run test:unit` | Yes |
| Integration tests | `npm run test:integration` | Yes |
| Data validation | `npm run data:validate` | Yes |
| Coverage | `npm run test:coverage` | Yes |
| Coverage thresholds | `npm run check:coverage-thresholds` | Yes |
| Entrypoint dedup | `npm run check:entrypoints` | Yes |
| Security audit and policy checks | `npm run check:security` | Yes |

## Optional Local Loops
- Runtime-only checks: `npm run test:runtime`
- Services-only checks: `npm run test:services`
- Tools-only checks: `npm run test:tools`
- Fast pre-PR sweep: `npm run check:quick`
