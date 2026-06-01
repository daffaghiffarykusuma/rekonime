# Python Golden Fixture Harness

The Python migration uses `tools/python_golden_harness.py` to compare migrated internal-tool outputs against checked-in fixtures.

Run:

```powershell
bun run test:golden
```

The Bun command delegates to `tools/python_golden_harness.py` when a Python interpreter is available. In environments without Python on `PATH`, it runs a Bun fallback against the same fixture set through `tools/pipeline-parity-contract.js` so local parity checks still work; Python availability remains required before replacing JavaScript tools with Python implementations.

The harness covers:
- Representative catalog input, full catalog output, and preview catalog output.
- Embedded data output compatible with `js/data.js`.
- Quality report output from the catalog build path.
- Validation success and validation failure reports.

Issue 10 adds Python validation and quality-reporting internals:
- `tools/validate_data.py`
- `tools/quality_reporter.py`
- `tools/run-validate-data.js`

When Python is available, `tools/python_golden_harness.py` exercises Python validation internals and the Python catalog build path against the checked-in golden outputs. On this Windows workspace, Python is not currently installed, so `bun run test:golden` uses the Bun fallback and reports that limitation.

Issue 11 starts catalog regeneration migration with Python-compatible embedded fallback generation:
- `tools/build_catalogs.py`
- `tools/run-build-catalogs.js`
- `tools/embedded_data.py`
- `tools/regenerate_data.py`
- `tools/run-regenerate-data.js`

The existing catalog refresh flow now uses `bun run data:build` and `bun run data:regenerate`. The Python build path owns normalization, score-profile derivation, build stats, preview selection, and quality-report handoff; `tools/python_golden_harness.py` calls `tools/build_catalogs.py` directly when Python is available. TypeScript `Stats` remains the browser/runtime scoring contract.

Issue 12 moves selected scraper-adjacent/data-operation commands behind Bun launchers:
- `bun run test:scraper` now runs `tools/run-scraper-tests.js` through Bun.
- `bun run data:backup` and `bun run data:rollback` now run `tools/run-deploy-data.js`.
- `tools/deploy_data.py` owns the Python backup/rollback implementation when Python is available.

Golden files live in `test/fixtures/python-golden/`.

Volatile fields are normalized before comparison:
- catalog `generatedAt`
- quality report `buildId`
- quality report `duration`
- temporary fixture paths

Only update fixtures for reviewed, intentional output changes:

```powershell
python tools/python_golden_harness.py --update
```

If Python is unavailable locally, use:

```powershell
bun tools/run-python-golden-harness.js --update
```
