# Plan 09 - Quality Gates Strict By Default

Severity: Medium  
Priority: P1

## Objective

Make data-quality gates blocking by default for CI/release paths.

## Risks Addressed

1. Non-strict runs can ship with degraded quality states.

## Implementation Plan

1. Change build script defaults to strict mode for CI/release.
2. Add explicit opt-out flag for local experimentation only.
3. Document gate thresholds and reason for each gate.
4. Add CI step that fails on warnings/errors outside approved exceptions.

## Validation

1. Run build with known-bad fixture and confirm failure.
2. Run build with production dataset and confirm pass.

## Exit Criteria

1. Quality gates protect release branch by default.
