# Release Security Checklist

## Headers
- Verify `Content-Security-Policy` is present and aligns with current remote dependencies.
- Verify `X-Content-Type-Options: nosniff` is present.
- Verify `Referrer-Policy` is set (`strict-origin-when-cross-origin` or stricter).
- Verify `X-Frame-Options` or CSP `frame-ancestors` is set.
- Verify `Strict-Transport-Security` is enabled on production HTTPS responses.

## Runtime Controls
- JSON backups and MAL XML imports accept at most 10 MiB and 5,000 rows. XML fields are limited to 8,192 characters, imported labels to 2,048 characters, profile arrays to 5,000 items, and snapshot tag arrays to 128 items.
- Keep `rekonime-parser` private to inert HTML/XML parsing. `rekonime-html` sanitizes HTML with DOMPurify, admits only the fixed catalog/worker script URLs, and accepts script text only as JSON-LD data.
- Confirm `sw.js` host allowlists are unchanged or intentionally updated.
- Confirm trailer URL policy still enforces strict HTTPS + trusted hosts.
- Confirm no wildcard `postMessage` target origins exist.

## Supply Chain and Tooling
- CI grants only `contents: read`, disables persisted checkout credentials, and pins actions to commit hashes. Preserve these controls when updating actions.
- CI audits `tools/scraper/requirements.txt` including transitive dependencies with `pip-audit==2.10.1`. To reproduce in a virtual environment, install that version and run `python -m pip_audit --strict --requirement tools/scraper/requirements.txt`.
- Run `bun run check:security` and confirm success.
- Run `bun run check:security-headers` after any `vercel.json` header changes.
- Run `bun run test:golden` and review any fixture diff before accepting Python/data-tool changes.
- Review `tools/outdated-exceptions.json` for expired or stale entries.
- Confirm no generated artifacts are tracked with `bun run check:repo-hygiene`.

## Data and Validation
- Run `bun run data:validate` and confirm no baseline regressions.
- Run `bun run data:validate:strict` before major catalog/pipeline releases.
- Run `bun run data:regenerate` after preview catalog changes and confirm `public/js/data.js` is expected.
- For backup or rollback changes, run `bun test test/unit/deploy-data.test.js test/unit/python-data-ops-migration.test.js`.

## Sign-off
- Security reviewer sign-off recorded in PR.
- Runtime owner sign-off recorded in PR.
