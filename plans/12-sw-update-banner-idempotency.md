# Plan 12 - Service Worker Update Banner Idempotency

Severity: Low  
Priority: P2

## Objective

Prevent duplicate update banners and listener accumulation.

## Risks Addressed

1. Multiple update events can append duplicate DOM and handlers.

## Implementation Plan

1. Make `showUpdatePrompt()` idempotent:
   1. Reuse existing banner if present.
   2. Avoid duplicate event binding.
2. Track prompt state in manager instance.
3. Add cleanup on update apply/dismiss paths.

## Validation

1. Simulate repeated update events and verify only one banner exists.
2. Confirm update action still triggers `skipWaiting` flow.

## Exit Criteria

1. Single prompt instance regardless of event frequency.
