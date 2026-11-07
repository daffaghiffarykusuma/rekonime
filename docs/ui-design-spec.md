---
title: Make mobile Discovery easier to scan and act on
tracker: local-markdown
label: ready-for-agent
status: open
seam_confirmation: approved-by-user
source: ui-design-direction-2026-11-07.md
---

## Problem Statement

A visitor comes to Rekonime to choose their next anime, but the homepage offers several competing entry points before making the main journey clear. On a narrow screen, tall covers and stacked secondary sections increase the amount of scrolling between useful choices. Returning viewers also need a compact way to resume tracking a Watching entry without displacing the discovery journey.

Catalog sorting is available in the desktop header but hidden on mobile without a direct replacement in the menu or filter dialog. Community Score has inconsistent labels across surfaces, and users must distinguish its /10 scale from Episode Rating Strength on a /100 scale. On the Watchlist, data-management controls precede the status tabs and entries, competing with the everyday task of updating progress.

These observations are source-grounded. Their effect on comprehension and confidence has not been measured, and the current design has not received a rendered desktop/mobile audit in this discussion.

## Solution

Make next-anime selection the homepage's primary task while preserving Rekonime's pink/lavender identity, typography, and existing three-pick Discovery journey. Use a compact introduction and Viewing Intent choices, shorter mobile recommendation covers, and a quieter Browse anime area below the main picks for supporting catalog exploration.

Give mobile users a combined Filter & sort sheet for catalog browsing. Promote one recently updated Watching entry with an appropriate Start watching or Continue watching label and a View all link. Standardize score names and scales while retaining explanations and evidence limitations. Group Watchlist export, Personal Data Restore, and Watchlist Import under a Manage data disclosure, keeping the browser-local storage reminder visible.

## User Stories

1. As a new visitor, I want a short introduction to Rekonime, so that I can reach useful anime choices quickly.
2. As a new visitor, I want compact Viewing Intent choices near the start of Discovery, so that I can guide suggestions without learning the full filtering system.
3. As a viewer without a specific goal, I want to explore recommendations without selecting a Viewing Intent, so that I can browse freely.
4. As a viewer choosing a Viewing Intent, I want it to apply immediately and become a compact, changeable summary, so that I can focus on the resulting picks.
5. As a viewer, I want temporary Viewing Intent to remain distinct from my Taste Profile and manual filters, so that I understand what a choice changes.
6. As a mobile viewer, I want shorter recommendation covers, so that artwork leaves room for the information needed to choose.
7. As a viewer comparing picks, I want readable titles, supported fit explanations, and episode information, so that I can assess appeal and commitment.
8. As a viewer considering an unfamiliar title, I want a clear route to its Detail Experience, so that I can investigate before deciding.
9. As a viewer, I want the existing small initial choice set and Show more picks action preserved, so that I can choose at my own pace.
10. As a viewer, I want goal suggestions to remain distinguishable from general alternatives, so that I understand the evidence for each recommendation.
11. As a viewer, I want Want to watch and Skip for now to remain easy to reach, so that I can act without opening secondary controls.
12. As a viewer who makes a mistake, I want existing selection and feedback Undo behavior preserved, so that a denser presentation does not reduce recoverability.
13. As a viewer who saves a pick, I want its existing Planned confirmation and Watchlist link preserved, so that I know where the title went without accidentally marking it Watching.
14. As a mobile catalog browser, I want direct sorting alongside filters, so that I can change result order without switching devices or relying on presets.
15. As a catalog browser, I want to see my current sorting choice when reopening controls, so that I can understand the displayed order.
16. As a catalog browser, I want existing filter application, reset, active summaries, and URL behavior preserved, so that familiar controls remain predictable.
17. As a viewer using both catalog and personalized picks, I want catalog sorting clearly scoped, so that I do not mistake it for a change to personalized ranking.
18. As a keyboard user, I want to open, operate, and close Filter & sort with understandable focus movement, so that all catalog controls remain usable.
19. As a returning viewer, I want one recently updated Watching entry promoted on the homepage, so that I can resume tracking without a long stacked section.
20. As a viewer with several Watching entries, I want a View all link to the Watchlist, so that the compact homepage does not hide access to the rest.
21. As a viewer with a Watching entry at zero recorded episodes, I want Start watching wording, so that the interface does not imply recorded progress already exists.
22. As a viewer with recorded progress, I want Continue watching wording and accurate progress, so that I can recognize the title I was tracking.
23. As a viewer without Watching entries, I want the promoted return-to-viewing section omitted, so that it does not occupy empty space.
24. As a viewer exploring beyond recommendations, I want seasonal picks, trending, genre exploration, and the catalog available in Browse anime below the main picks, so that those routes remain accessible.
25. As a viewer who knows a title, I want readily accessible search, so that I can bypass exploratory browsing.
26. As a viewer reading ratings, I want Community score with MAL attribution and /10 shown consistently, so that I understand its source and scale.
27. As a viewer reading episode evidence, I want Episode rating strength shown with /100, so that I can distinguish the index from the community rating.
28. As a viewer evaluating uncertain information, I want missing values, limited evidence, and provisional status represented honestly, so that I do not confuse sparse evidence with a measured result.
29. As a viewer who wants more detail, I want expandable rating explanations, so that evidence stays available without dominating the initial card.
30. As a Watchlist user, I want status tabs, entries, and progress actions to take priority over administration, so that routine tracking requires less scanning.
31. As a Watchlist user, I want export, Personal Data Restore, and MAL Watchlist Import grouped under Manage data, so that I can find them when needed.
32. As a Watchlist user, I want the browser-local storage reminder visible while Manage data is closed, so that I understand the need to protect my progress.
33. As a user managing saved data, I want restore and MAL import to remain distinguishable and retain their existing review and recovery behavior, so that moving their controls does not change what they do.
34. As a desktop viewer, I want the additional width used for readable comparison and browsing, so that mobile-first changes also work well on a larger screen.
35. As a viewer using either existing theme or increased text size, I want essential content and controls to remain readable and operable, so that the compact layout remains usable.

## Implementation Decisions

- Refine the existing application rather than introducing a new app, route system, or visual identity. Preserve the established palette and typography in both existing themes.
- Keep App Shell as the composition point for homepage hierarchy, search access, catalog controls, and the promoted Watching entry. Use existing feature owners for their domain behavior rather than moving rules into presentation code.
- Compact the no-intent landing introduction and Viewing Intent choices. Preserve the Onboarding Journey, optional entry to Discovery, immediate goal application, and the changeable active-goal summary.
- Preserve the accepted first-visit behavior: up to three initial picks, more on request, supported fit explanations, honest episode information, separately identified general alternatives, secondary ratings, Session Dismissal, lasting Taste Profile feedback, Undo, and retained Planned confirmation.
- Shorten covers on mobile recommendation cards while keeping titles, supported fit explanations, episode information, and primary actions readable. Resolve exact dimensions and spacing through rendered comparison rather than prescribing unverified pixel values.
- Keep rating evidence in its existing disclosure. Do not remove limited-data or provisional notices to make cards smaller, or replace missing values with invented information.
- Extend the existing catalog filter presentation with direct sorting in a Filter & sort sheet. Reuse the current sort options and sort state; synchronize any retained desktop sorting control with that same state rather than creating competing state.
- Preserve existing filter application, reset, presets, active summaries, result pagination, and URL contracts. This presentation change does not introduce a new URL schema or redefine reset semantics.
- Explain that catalog sorting controls catalog order, while personalized Discovery retains its own ranking. Preserve existing candidate eligibility and filter interactions; do not change the recommendation algorithm to enforce visual separation.
- Keep temporary Viewing Intent, lasting Taste Profile, and Browse View Filtering distinct. Selecting a catalog sort must not rewrite saved taste or the active Viewing Intent.
- Use Runtime Capabilities for existing focus management, scroll locking, and modal behavior. Keep the combined sheet keyboard operable and programmatically named.
- Present at most one most recently updated Watching entry in the promoted homepage section. Include zero-progress Watching entries; omit the section when none exist. Scope the one-entry limit to this presentation, not unrelated Watchlist or Airing Schedule views.
- Use Start watching for zero recorded progress and Continue watching for positive progress. Retain access to existing tracking controls and a View all link to the Watchlist. These labels do not create playback, imply a streaming provider, or automatically alter lifecycle state.
- Preserve Catalog Runtime and Snapshot fallback behavior so a saved entry can render before the full catalog is available. Keep unknown episode totals explicitly unknown.
- Retain seasonal picks, trending, genre exploration, and the full catalog on the homepage below the main picks in a quieter Browse anime area. Keep search readily accessible and existing navigation targets functional.
- Standardize user-facing names across recommendation, catalog, detail, sorting, and help surfaces. Display Community score with MAL attribution and /10, and Episode rating strength with /100. Use the agreed glossary meanings without changing formulas, refresh logic, or storage keys.
- Retain unavailable, limited-data, and provisional states. Episode Rating Strength is a rating index, not a finish rate, retention rate, or completion probability. An internal unavailable-data sentinel must not become a displayed measured zero.
- Group Watchlist export, Personal Data Restore, and Watchlist Import inside a Manage data disclosure. Keep the browser-local storage reminder outside the collapsed content and leave everyday status/progress controls prominent.
- Reuse the existing data-operation workflows, validation, confirmation, failure handling, privacy boundaries, and lazy loading. Relocating entry controls must not perform an import, restore, export, or progress mutation by itself.
- No API, Catalog Payload schema, Watchlist storage format, or new application-wide test interface is required. These reversible presentation choices do not warrant an ADR.

## Testing Decisions

- The user approved the existing browser-level Discovery to catalog filtering/sorting to Watchlist journey as the primary testing seam. It covers the real App Shell, visible presentation, user controls, navigation, and persisted outcomes. Add no new cross-application test interface.
- Prefer externally observable behavior: visible choices, catalog order, accessible control names, displayed progress, reachable data tools, and state after navigation or reload. Avoid tests tied to helper call order, private collections, generated markup strings, or a particular CSS declaration.
- Exercise the composed Discovery, Browse View Filtering, Detail Experience, Watchlist presentation, and Runtime Capabilities through that browser seam. Reuse existing first-run intent, three-pick shortlist, selected-title persistence, reversible feedback, advanced filtering, and complete Discovery-to-Watchlist scenarios.
- Use focused tests at the existing Continue watching model interface only where deterministic ordering or eligibility cases are clearer there. Cover the most recently updated Watching entry, zero-progress eligibility, exclusion of other statuses, no entries, and available versus unknown episode totals. Assert the model's public result and scope the presentation limit without constraining unrelated views.
- Reuse existing browser backup roundtrip and progress-editing coverage for Manage data reachability, and reviewed MAL import scenarios for disclosure access. Preserve the existing focused Watchlist Lifecycle, Personal Data Restore, and Watchlist Import suites as regression coverage; do not duplicate their internal failure matrices merely because controls moved.
- Verify fresh and returning visits with no goal and an active Viewing Intent, including the existing no-close-match and absent-data states. Preserve search, detail navigation, Show more picks, saving, feedback recovery, and three-pick grouping.
- On mobile, open Filter & sort, choose an explicit nondefault sort, apply catalog controls, and verify the displayed result order and reopening state. Exercise existing filter application/reset and URL behavior. Check that sorting does not mutate saved taste or Viewing Intent, and that personalized picks retain their ranking rules.
- Check no, one, and multiple Watching entries, including zero and positive progress. Verify one promoted entry, accurate wording, View all navigation, and the existing progress action. Confirm that Planned, Completed, and Dropped entries do not appear as Watching.
- Verify Community Score attribution and /10 and Episode Rating Strength /100 across relevant surfaces, including missing values and limited or provisional evidence. Use controlled catalog fixtures already supported by browser tests; do not assert unstable live provider values or add provider calls for presentation tests.
- Inspect rendered desktop and mobile layouts, including the established 1280 by 720 and 390 by 844 viewports, long titles, expanded evidence, narrow controls, and both themes. Check increased text size, keyboard operation, focus return, logical reading order, overflow, and visible state changes. Screenshots support layout review but do not establish accessibility compliance.
- Run relevant focused tests, type checking, the normal Bun suite, affected development and production browser coverage, and existing build/runtime/asset checks required by repository scripts. Record actual results and unrelated baseline failures separately. Broaden checks only when changes or failures justify it.
- Do not claim improved confidence, faster choice, or better comprehension from source review or automated checks alone. Actual user outcomes require observation; do not invent participants, numerical targets, or a new study prerequisite for this presentation scope.

## Out of Scope

- A new brand identity, typography system, standalone Browse route, application rewrite, or broad architecture refactor.
- Recommendation algorithm changes, new personalization signals, a general Taste Profile editor, or redefining the existing three-pick and feedback journey.
- New rating formulas, score refresh work, catalog collection, inferred viewing hours, unsupported emotional claims, or interpreting Episode Rating Strength as a finish probability.
- Accounts, cloud synchronization, social features, analytics infrastructure, or new backend services.
- Streaming availability, playback, provider launching, or automatically marking a chosen title Watching.
- Watchlist storage migration, altered import/restore/export semantics, replacement data workflows, or a full Watchlist redesign.
- A new study or resolution of the separate first-visit specification's pending participant-observation work.
- UI implementation as part of publishing this specification.

## Further Notes

The user accepted all three design rounds and explicitly approved the proposed test boundaries. This specification synthesizes those decisions without reopening the interview. It is published as an open local Markdown tracker item with the ready-for-agent label.

The accepted [design direction and acceptance checks](ui-design-direction-2026-11-07.md) provide the supporting decision record. The [earlier first-visit specification](first-visit-discovery-spec-draft.md) and [implementation report](first-visit-discovery-implementation.md) remain the baseline for existing behavior. Their participant-evidence status is unchanged by this spec.

Current findings are based on source inspection. No rendered audit, interaction verification, new test execution, or measured user outcome is claimed for this specification. Implementation should begin with mobile sorting access and score consistency, then refine homepage/card hierarchy and supporting browsing, then compact return-to-viewing and data-management presentation, followed by the approved verification.
