# Plan 05 - postMessage Target Origin Lockdown

Severity: Medium  
Priority: P1

## Objective

Restrict trailer iframe messaging to explicit trusted origins.

## Risks Addressed

1. Wildcard target origin in `postMessage` is overly permissive.

## Implementation Plan

1. Parse iframe `src`/`data-embed-src` and derive allowed origin.
2. Replace `'*'` target with exact origin for YouTube or YouTube-nocookie.
3. Add guard that skips message if origin cannot be resolved safely.
4. Add unit tests for both embed host variants.

## Validation

1. Confirm trailer controls still work.
2. Confirm messaging is only sent to allowed origins.

## Exit Criteria

1. No wildcard `postMessage` target in app code.
