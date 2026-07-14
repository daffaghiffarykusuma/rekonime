---
title: Define the Watchlist Lifecycle import contract
label: wayfinder:grilling
parent: ../map.md
status: closed
assignee: codex
blocked_by:
  - "[Characterize MAL XML compatibility and catalog matching](characterize-mal-xml-and-catalog-matching.md)"
  - "[Decide Watchlist merge and conflict semantics](decide-merge-and-conflict-semantics.md)"
closed_at: 2026-07-14
resolution_comment: ../resolutions/define-watchlist-import-contract.md
---

## Question

What pure parse/plan result and single Watchlist Lifecycle mutation boundary should represent an MAL import so validation, conflict preview, persistence, snapshot creation, and the subsequent Taste Profile refresh happen once and cannot leave contradictory local state?

## Resolution requirements

- Name the minimum existing modules and contracts to change; reuse Watchlist Lifecycle and Taste Profile seams.
- Define how the import obtains or waits for the full Catalog Payload before exact `series_animedb_id` to `malId` matching; preview-only matching is invalid.
- Define parse errors, warnings, matched/unmatched/conflicting rows, proposed Watchlist Entries, summary counts, and the apply result.
- Define the exact order of persistence, Watchlist events/render intent, snapshot refresh, and Taste Profile evidence refresh.
- Specify rollback or pre-mutation validation behavior for storage failures and partial application.
- Avoid a provider framework, background service, server upload, or new dependency unless evidence makes one necessary.
