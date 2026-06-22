# Data Quality Incident Playbook

## Trigger Conditions
- `bun run data:validate` fails on default branch.
- `tools/build_catalogs.py` strict mode fails quality gates unexpectedly.
- Production shows broken anime detail cards or malformed score data.

## Triage Steps
1. Identify failing gate and exact error label from validator output.
2. Confirm whether failure is new regression or known baseline item.
3. Scope blast radius:
   - `data/anime.full.json`
   - `data/anime.preview.json`
   - `js/data.js` embedded payload
4. Classify severity:
   - `SEV-1`: broken user flows or invalid JSON shipped
   - `SEV-2`: degraded metadata quality, app still functional
   - `SEV-3`: warning-only drift

## Immediate Mitigation
1. Revert to last known-good data snapshot using:
   - `bun run data:rollback`
2. Redeploy data bundle.
3. Confirm `bun run data:validate` passes on rollback snapshot.

## Root Cause Isolation
1. Compare changed inputs and pipeline scripts in the failing PR.
2. Re-run targeted tooling tests:
   - `bun run test:tools`
3. Re-run strict validation:
   - `bun run data:validate:strict`

## Recovery and Closure
1. Patch source data or pipeline transformation.
2. Add or update tests for the exact failure mode.
3. Update `tools/validation-baseline.json` only for intentionally accepted debt.
4. Document incident summary in the PR:
   - trigger
   - impact
   - rollback decision
   - permanent fix
