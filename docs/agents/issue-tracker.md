# Issue tracker

This project uses local Markdown for feature specifications and implementation tickets, following its established local planning convention.

## Feature specifications

- [Mobile Discovery and UI hierarchy](../ui-design-spec.md): open, `ready-for-agent`. Browser-level Discovery, catalog filtering/sorting, and Watchlist is the primary test seam; focused existing Continue watching model tests are approved for deterministic ordering and eligibility. No new application-wide test interface.
- [First-visit Discovery](../first-visit-discovery-spec-draft.md): retains its existing status and participant-evidence prerequisite.

## Mobile Discovery UI tickets

- Ticket directory: `.scratch/ui-design/issues/`, one numbered file per approved slice, numbered 01-05.
- All five tickets have no blockers and can be claimed independently. Shared-file overlap requires merge coordination, not fabricated dependency edges.
- Apply the same claim, closure, resolution, and evidence conventions below. The primary browser seam and focused Continue watching model coverage are explicitly approved in the parent specification.

## Lifecycle conventions and first-visit context

- Feature specification: `docs/first-visit-discovery-spec-draft.md`.
- Ticket directory: `.scratch/first-visit-discovery/issues/`, one numbered file per ticket.
- Triage status: `ready-for-agent`. Implementation claims use `in-progress`.
- Blocking edges are listed in each ticket's **Blocked by** field. Start only when the listed tickets are closed.
- Close completed work by marking **Status** as `closed`, checking only verified acceptance criteria, and appending a resolution with the implementation commit and validation evidence.
- Use `blocked` for a ticket requiring unavailable external evidence, and record the missing prerequisite. Preparing a study protocol does not complete observed user validation.
- Keep a parent specification open while any required ticket remains unresolved.

The approved test boundaries are the browser Discovery-to-Watchlist journey and focused existing Watchlist Lifecycle, Taste Profile, and discovery/session public interfaces for deterministic persistence, Undo, isolation, matching, and expiry checks. These were included in the approved ticket breakdown. No new application-wide test interface is required.
