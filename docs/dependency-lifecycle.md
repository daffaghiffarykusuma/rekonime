# Dependency Lifecycle Policy

## Cadence
- Review dependencies monthly.
- Apply patch updates continuously when checks pass.
- Evaluate minor updates bi-weekly.
- Evaluate major updates with explicit migration notes and risk review.

## Required Checks Before Merge
- `npm run test:unit`
- `npm run test:integration`
- `npm run data:validate`
- `npm run check:security`

## Outdated Budget and Exceptions
- `tools/check-outdated-budget.js` enforces budget thresholds.
- Exceptions live in `tools/outdated-exceptions.json`.
- Every exception must include:
  - `reason`
  - `until` date in `YYYY-MM-DD`
  - `maxLevel`

## Exception Governance
- Expired exceptions fail CI and must be renewed or removed.
- Security-sensitive package exceptions require Security + Runtime review.
- Major-version exceptions should include an issue link or migration note in PR.
