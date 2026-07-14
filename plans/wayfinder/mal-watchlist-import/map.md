---
title: Import MyAnimeList progress into the Watchlist Lifecycle
label: wayfinder:map
tracker: local-markdown
status: closed
---

## Destination

Reach a decision-complete implementation plan for importing a MyAnimeList XML export into Rekonime: matched titles create or update Watchlist Entries, then the Taste Profile refreshes from the resulting Watchlist Lifecycle evidence.

## Notes

- Planning only. Implementation starts after the map has no unresolved decisions.
- Use `CONTEXT.md` and `docs/module-contracts.md` as the domain boundary: progress belongs to the Watchlist Lifecycle; the Taste Profile interprets the resulting evidence.
- Ground compatibility decisions in `plans/animelist_1784001772_-_10574948.xml` and the current Catalog Payload.
- Preserve existing local Watchlist Entries unless an explicitly resolved merge rule says otherwise.
- Keep parsing local in the browser unless a ticket establishes a necessary alternative.
- Use Bun for repository checks.
- The repo has no configured tracker-specific Wayfinding operations guide, so child issues are local Markdown files in `tickets/`. Frontmatter records labels, claims, and blocking edges.

## Decisions so far

<!-- Closed ticket decisions are appended here as one-line linked gists. -->

- [Decide Watchlist merge and conflict semantics](tickets/decide-merge-and-conflict-semantics.md) — preview an atomic partial merge, preserve local conflicts and affinity by default, and make repeated imports idempotent without history state.

- [Characterize MAL XML compatibility and catalog matching](tickets/characterize-mal-xml-and-catalog-matching.md) — accept the supplied MAL-specific XML shape, match exact MAL IDs only against the full Catalog Payload (339/415), and report 76 unmatched rows without mutation.

- [Define the Watchlist Lifecycle import contract](tickets/define-watchlist-import-contract.md) — plan against the full catalog, commit one detached Watchlist batch atomically, then refresh derived Taste Profile evidence once.

- [Prototype the MAL import review flow](tickets/prototype-import-review-flow.md) — use the selected summary-first settings flow: totals first, conflicts in the main review column, safe skips in a side rail, then one explicit confirmation.

- [Define import acceptance and recovery criteria](tickets/define-acceptance-and-recovery.md) — accept the evidenced 415-row local-only flow, atomic storage recovery, accessible review states, and retry-only derived Taste Profile recovery without inventing scale limits.

## Not yet specified

## Out of scope

- Continuous MyAnimeList account synchronization or OAuth/API integration.
- Exporting Rekonime changes back to MyAnimeList.
- Importing manga lists.
- Expanding Rekonime's catalog solely to make every MAL export row match.
- Provider-general parsing and unobserved MAL XML layouts; add support only when another real fixture establishes a required variant.
