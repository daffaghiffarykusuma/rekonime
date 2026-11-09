# UI design direction

Date: 2026-11-07.
Status: implemented and verified on feat/mobile-discovery-ui. All three design rounds were accepted; see the [implementation report](ui-design-implementation.md) for results and limits.

The [implementation specification](ui-design-spec.md) and its five local tracker tickets are closed after final validation. Their test boundaries were explicitly approved by the user.

## Accepted direction

- Prioritize helping a visitor choose their next anime. Promote a compact return-to-viewing entry when a Watching entry exists, including entries with zero recorded episodes.
- Preserve the current pink/lavender visual identity and typography. Refine hierarchy, spacing, text density, and emphasis before considering a new identity.
- Design mobile first. Use additional desktop space for comparison and browsing.

## Accepted layout choices

- Initial landing: use a short heading and compact Viewing Intent choices before useful recommendations. Reduce introductory space. Preserve immediate intent selection and the existing active-intent summary.
- Mobile recommendation cards: shorten covers while preserving readable titles, supported fit explanations, episode information, and primary actions. Keep ratings expandable. Determine exact proportions through rendered inspection rather than treating the current source dimensions as visual evidence.
- Mobile catalog controls: combine filtering and direct sorting in a Filter & sort sheet. Explain that these controls affect catalog browsing, while personalized recommendations retain their own ranking. Preserve the distinction between Viewing Intent and Browse View Filtering.
- Return to viewing: show one most recently updated Watching entry with a View all link to the Watchlist. Include zero-progress entries, using Start watching for those and Continue watching when recorded progress exists. These labels do not introduce playback or streaming availability.
- Supporting discovery: retain seasonal picks, trending, genre exploration, and the catalog on the homepage below the main picks, grouped under a quieter Browse anime area. Keep search readily accessible.
- Score naming: use Community score with MAL attribution and an explicit /10 scale, and Episode rating strength with an explicit /100 scale. Keep explanations expandable and retain limited-data and provisional notices. Do not call the rating index a finish rate.
- Watchlist data management: place export, restore, and MAL import inside a Manage data disclosure. Keep the browser-local storage reminder visible and preserve existing progress controls and data-operation behavior.

## Design tree

- Main job: next-anime discovery, accepted.
  - Initial introduction and goal entry: compact, accepted.
  - Supporting catalog sections: same page, quieter Browse anime area below main picks, accepted.
- Visual identity: preserve current palette and typography, accepted.
  - Recommendation card hierarchy: preserve existing fit-first decisions.
  - Mobile cover proportions: shorten, accepted; exact dimensions require visual inspection.
  - Score naming: Community score with MAL attribution /10 and Episode rating strength /100, accepted.
- Primary viewport: mobile first, accepted.
  - Catalog filter and sort access: combined sheet, accepted.
  - Return-to-viewing section: one Watching entry, accepted.
- Scope beyond discovery: compact Watchlist data-management disclosure, accepted.

## Existing decisions carried forward

The [earlier hierarchy review](ux-hierarchy-review-2026-10-07.md), [first-visit specification](first-visit-discovery-spec-draft.md), and [implementation report](first-visit-discovery-implementation.md) remain the baseline. This interview does not reopen their accepted three-pick presentation, supported fit explanations, secondary ratings, temporary versus lasting feedback, or Planned selection confirmation.

Keep the glossary distinction between temporary Viewing Intent, lasting Taste Profile, and Browse View Filtering. Record the agreed Community Score and Episode Rating Strength terms in the glossary; sentence-case labels remain appropriate in the interface.

## Acceptance checks

| Area | Required result | Verification |
| --- | --- | --- |
| Initial landing | Compact introduction and goal choices lead into the existing up-to-three-pick journey; search remains easy to reach. | Render fresh and returning desktop/mobile states, with and without an active goal. |
| Mobile cards | Shorter covers reduce vertical space without truncating essential title, fit, episode, or action information. Ratings remain expandable. | Inspect long titles, missing metadata, limited evidence, and narrow viewports; check keyboard access. |
| Filter and sort | Mobile users can directly select catalog sorting in the combined sheet. Applying catalog controls preserves the separation from personalized ranking and saved taste. | Exercise selection, apply/reset, result order, reopening, and existing URL behavior; verify focus and scroll handling. |
| Return to viewing | At most one most recently updated Watching entry appears in the promoted section, with a Watchlist link. Zero progress uses Start watching; positive progress uses Continue watching. No section appears without Watching entries. | Check zero, one, and multiple Watching entries, zero and positive progress, and existing progress updates. |
| Supporting browsing | Seasonal, trending, genre, and catalog access remains available below main picks in Browse anime. | Inspect the whole page on mobile and desktop; verify search, section links, filters, and sorting. |
| Scores | Community score uses MAL attribution and /10; Episode rating strength uses /100. Missing values stay unavailable, and evidence notices remain accessible. | Inspect recommendation cards, catalog cards, detail views, sorting labels, and score help, including absent and provisional data. |
| Manage data | Disclosure groups existing operations while the local-storage reminder stays visible. | Check open/close and keyboard behavior; verify existing export, restore, and reviewed MAL import flows remain reachable. |

These are acceptance criteria, not completed checks. Layout inspection cannot demonstrate improved user confidence; that still requires observation.

## Suggested implementation order

1. Add direct mobile sorting through the combined catalog sheet and standardize score labels and scales.
2. Refine the landing hierarchy, shorten recommendation covers, and group supporting browsing below the main picks.
3. Compact the promoted Watching section and Watchlist data-management controls.
4. Verify affected behavior and rendered desktop/mobile states against the acceptance checks above. Run relevant existing automated checks without treating them as evidence of user preference.

## Scope boundaries

Preserve the current palette, typography, recommendation rules, three-pick journey, saving and feedback behavior, and existing data operations. This pass does not add a backend, streaming availability, playback, a separate Browse route, a new scoring formula, or a general Taste Profile redesign. Exact spacing and cover dimensions are implementation details to resolve through visual inspection within the accepted direction.

## Evidence and limits

Initial findings come from current source inspection. Existing returning-user styling already reduces the hero, and Watchlist rows already include progress prompts. Treat further prominence changes as refinements to those capabilities.

Additional source inspection found no direct replacement for the mobile-hidden header sort select in the menu or filter dialog. This supports the accepted combined control; interaction behavior still needs browser verification.

At interview time, no screenshots or browser interaction checks had been performed for this design direction. Subsequent rendered and interaction verification is recorded in the implementation report; it does not establish accessibility compliance or measured user outcomes. Prior first-visit evidence belongs to its original report.

No ADR is needed for these reversible presentation choices. All current design-tree branches are settled; no further interview question is pending.
