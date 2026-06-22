# Python Golden Fixture Harness

`tools/python_golden_harness.py` compares Python data-tool outputs against checked-in fixtures.

Run:

```powershell
bun run test:golden
```

The Bun command uses `tools/run-python.js` to find the local virtual environment or an installed Python 3 interpreter. Python is required.

The harness covers:
- Representative catalog input, full catalog output, and preview catalog output.
- Embedded data output compatible with `js/data.js`.
- Quality report output from the catalog build path.
- Validation success and validation failure reports.

Validation and quality reporting:
- `tools/validate_data.py`
- `tools/quality_reporter.py`

Catalog generation:
- `tools/build_catalogs.py`
- `tools/embedded_data.py`
- `tools/regenerate_data.py`

The catalog refresh flow uses `bun run data:build` and `bun run data:regenerate`.

Data operations:
- `bun run test:scraper` now runs `tools/run-scraper-tests.js` through Bun.
- `bun run data:backup` and `bun run data:rollback` run `tools/deploy_data.py`.

Golden files live in `test/fixtures/python-golden/`.

Volatile fields are normalized before comparison:
- catalog `generatedAt`
- quality report `buildId`
- quality report `duration`
- temporary fixture paths

Only update fixtures for reviewed, intentional output changes:

```powershell
bun tools/run-python.js tools/python_golden_harness.py --update
```
