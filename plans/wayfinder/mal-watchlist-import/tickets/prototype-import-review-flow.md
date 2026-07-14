---
title: Prototype the MAL import review flow
label: wayfinder:prototype
parent: ../map.md
status: closed
assignee: codex
blocked_by:
  - "[Characterize MAL XML compatibility and catalog matching](characterize-mal-xml-and-catalog-matching.md)"
  - "[Decide Watchlist merge and conflict semantics](decide-merge-and-conflict-semantics.md)"
closed_at: 2026-07-14
resolution_comment: ../resolutions/prototype-import-review-flow.md
---

## Question

What is the smallest understandable settings flow for choosing an MAL XML file, previewing matched, conflicting, skipped, and unmatched rows, confirming mutation, and seeing the final Watchlist and Taste Profile result?

## Resolution requirements

- Create a cheap linked prototype using existing settings styles and native file input/dialog behavior.
- Cover keyboard operation, focus movement, screen-reader status announcements, destructive-action wording, cancel, and retry.
- Test the flow with the supplied XML's realistic scale; do not require rendering every row at once if summary plus exceptions is sufficient.
- Resolve where the existing Rekonime profile JSON import remains distinct from MAL import.

## Prototype asset

- [MAL import review prototype notes](../prototypes/mal-import-review.md)
- Run `bun run dev`, then open `/?prototype=mal-import-review`.
- Human verdict: keep Variant B's summary-first split; variants A and C and the switcher were removed.
