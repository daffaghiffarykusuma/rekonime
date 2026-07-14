---
title: Define import acceptance and recovery criteria
label: wayfinder:grilling
parent: ../map.md
status: closed
assignee: codex
blocked_by:
  - "[Define the Watchlist Lifecycle import contract](define-watchlist-import-contract.md)"
  - "[Prototype the MAL import review flow](prototype-import-review-flow.md)"
closed_at: 2026-07-14
resolution_comment: ../resolutions/define-acceptance-and-recovery.md
---

## Question

Which functional, privacy, accessibility, performance, and failure-recovery checks are sufficient to hand this plan to implementation with no remaining product or technical decisions?

## Resolution requirements

- Define acceptance examples for first import, repeated import, conflicts, unmatched titles, malformed/oversized XML, storage failure, and Taste Profile refresh.
- Require local-only handling and no telemetry of list contents unless a separate explicit decision changes that boundary.
- Identify focused Bun tests plus the existing repository verification gates needed for implementation handoff.
- State measurable limits for supported file size or row count only if evidence supports them; otherwise require graceful behavior without inventing thresholds.
