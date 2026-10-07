# Issue tracker

This project uses local Markdown for the first-visit Discovery work, following its established local planning convention.

- Feature specification: `docs/first-visit-discovery-spec-draft.md`.
- Ticket directory: `.scratch/first-visit-discovery/issues/`, one numbered file per ticket.
- Triage status: `ready-for-agent`. Implementation claims use `in-progress`.
- Blocking edges are listed in each ticket's **Blocked by** field. Start only when the listed tickets are closed.
- Close completed work by marking **Status** as `closed`, checking only verified acceptance criteria, and appending a resolution with the implementation commit and validation evidence.
- Use `blocked` for a ticket requiring unavailable external evidence, and record the missing prerequisite. Preparing a study protocol does not complete observed user validation.
- Keep a parent specification open while any required ticket remains unresolved.

The approved test boundaries are the browser Discovery-to-Watchlist journey and focused existing Watchlist Lifecycle, Taste Profile, and discovery/session public interfaces for deterministic persistence, Undo, isolation, matching, and expiry checks. These were included in the approved ticket breakdown. No new application-wide test interface is required.
