---
title: Help new viewers choose an anime confidently
tracker: local-markdown
status: blocked
blocked_on: participant-observations
seam_confirmation: approved-with-ticket-breakdown
---

## Problem Statement

An occasional anime viewer arriving at Rekonime wants to choose something to watch without learning a scoring system first. The current recommendation cards emphasize scores, repeat similar fit explanations, and omit readily available episode-count information. Viewing Intent influences ranking, but general recommendations can remain mixed with goal-specific suggestions.

Exploring also has consequences that are difficult to reverse. Not for me creates a lasting Taste Profile exclusion, even when the viewer may only mean not now. Saving a title removes it from recommendation candidates, interrupting the moment of choice. Ordinary Watchlist changes can report success even when persistence fails.

The desired outcome is one chosen title with a personally relevant reason. A saved shortlist alone does not establish that the viewer made a confident choice.

## Solution

Keep the existing optional Onboarding Journey and Viewing Intent entry point. Initially offer up to three compact picks, with more available on request. Lead with supported fit information and known episode information. Keep ratings secondary, with deeper explanations available on demand.

Distinguish suggestions supported by the selected Viewing Intent's existing genre/theme rules from separately labelled general alternatives. State when no close match is available. Do not promise emotional outcomes or infer viewing hours from missing data.

Offer an easy-to-find Skip for now action that creates a reversible Session Dismissal. Keep explicit lasting Taste Profile adjustments, including Not for me, behind a secondary control and provide Undo. Let viewers review and restore titles skipped during the session.

Want to watch saves the chosen title as Planned. Confirm success only after persistence succeeds, keep the chosen title visible, and provide Undo and a Watchlist link. Do not automatically mark the title Watching. Evaluate the revised experience with occasional viewers using the same task as the current experience.

## User Stories

1. As an occasional viewer new to Rekonime, I want to choose one anime without learning specialist scores, so that I can decide what to watch confidently.
2. As a first-time viewer, I want to choose a Viewing Intent or skip the welcome step, so that I can begin with as much guidance as I need.
3. As an undecided viewer, I want up to three initial picks, so that I have a manageable starting point.
4. As a viewer who dislikes the initial options, I want to request more recommendations, so that the initial shortlist does not limit exploration.
5. As a viewer comparing titles, I want a supported plain-language reason for each suggestion, so that I understand why it was shown.
6. As a viewer assessing commitment, I want available episode-count information, so that I can compare titles without opening every detail view.
7. As a viewer facing incomplete catalog data, I want unknown or partial episode information to be presented honestly, so that I do not mistake observed episodes for a guaranteed final series length.
8. As a viewer assessing commitment, I want the app to avoid invented runtimes, so that I do not choose based on an unsupported estimate of hours.
9. As a viewer interested in ratings, I want ratings and their explanations to remain available, so that I can inspect the evidence without making it the starting point for every choice.
10. As a viewer reading provisional scores, I want the existing coverage and uncertainty disclosures preserved, so that I understand their limits.
11. As a viewer with a selected Viewing Intent, I want supported suggestions distinguished from general alternatives, so that I can recognize their different reasons for appearing.
12. As a viewer whose goal has few matches, I want the available matches shown without unrelated titles being presented as matches, so that the app remains trustworthy.
13. As a viewer whose goal has no close matches, I want an explicit explanation and separately labelled alternatives when available, so that I can make an informed next choice.
14. As a viewer exploring without a goal, I want usable general recommendations without a false goal-match claim, so that skipping onboarding remains useful.
15. As a viewer who is not interested in a title right now, I want Skip for now, so that I can set it aside without changing my lasting taste.
16. As a viewer using Skip for now, I want my Watchlist Entry and Taste Profile to remain unchanged, so that temporary exploration does not alter my saved history or preferences.
17. As a viewer who skips accidentally, I want Undo, so that I can immediately restore the title.
18. As a viewer reconsidering earlier choices, I want to review and restore titles skipped during the session, so that recovery does not depend on noticing a brief notification.
19. As a viewer reloading the same tab, I want active Session Dismissals preserved, so that I do not immediately see the same skipped titles again.
20. As a viewer changing Viewing Intent, I want my Session Dismissals preserved, so that changing the goal does not undo my deliberate skips.
21. As a viewer returning after the session's inactivity window, I want temporary dismissals to expire, so that not now does not become a permanent exclusion.
22. As a viewer expressing a lasting dislike, I want Not for me to communicate its lasting effect, so that I can intentionally change my Taste Profile.
23. As a viewer who gives mistaken lasting feedback, I want to undo that feedback without resetting unrelated preferences, so that I retain the rest of my Taste Profile.
24. As a viewer concentrating on choosing a title, I want lasting taste adjustments available through a secondary control, so that they do not crowd the primary decision.
25. As a viewer who has chosen a title, I want Want to watch to save it as Planned, so that it is available in my Watchlist without claiming I have started it.
26. As a viewer who saves a title, I want the chosen title to remain visible with confirmation, so that I can finish my decision without losing sight of it.
27. As a viewer who saves a title accidentally, I want Undo to reverse that change without damaging unrelated Watchlist information, so that correction is safe.
28. As a viewer who has saved successfully, I want a Watchlist link, so that I can find the title again.
29. As a viewer whose browser cannot save, I want an actionable failure instead of a success message, so that I know my choice has not been persisted.
30. As a viewer retrying a failed save, I want the previous Watchlist state preserved, so that recovery does not compound a failed operation.
31. As a keyboard or assistive-technology user, I want the choice, feedback, secondary controls, and recovery actions to be operable and understandable, so that I can complete the same journey.
32. As a mobile viewer, I want the shortlist and feedback controls to remain readable and usable, so that I can choose on a small screen.
33. As a viewer checking a recommendation, I want existing Detail Experience and watch-order information to remain accessible, so that I can inspect a title before committing to it.
34. As a viewer using Undo after other changes, I want unrelated or newer saved information protected, so that recovering one action does not silently reverse another.

## Implementation Decisions

- Preserve the existing App Shell and feature-runtime architecture. Do not introduce a replacement application framework, global mutable orchestration object, or compatibility wrappers for this work.
- The App Shell remains responsible for rendering and applying transition effects. Discovery and its recommendation decision interface own candidate selection, fit classification, and recommendation presentation data. Taste Profile continues to interpret preferences and Watchlist Lifecycle evidence.
- Extend the recommendation decision result as needed to distinguish supported Viewing Intent suggestions, general alternatives, and the absence of close matches. Use the existing documented genre/theme rules, franchise eligibility, and rating evidence. A ranking bonus alone must not establish match-group membership.
- Initially display no more than three picks in total. When a Viewing Intent is active, give supported matches priority and identify any general alternatives separately. More recommendations require an explicit user action. With no Viewing Intent, preserve general discovery behavior without claiming goal fit.
- Lead compact cards with supported fit information and available episode information. Keep numeric ratings secondary and preserve score coverage, provisional disclosures, and on-demand explanations. Preserve title-detail access.
- Consume existing Catalog Payload and Experience Cue evidence. Do not infer duration, completed-series status, final episode totals, or emotional effects when the catalog does not support them. Do not expand catalog payloads merely to add an unagreed synopsis feature.
- Session Dismissal belongs to the discovery session, not Taste Profile or Watchlist Lifecycle. Prefer extending the existing session-runtime boundary around Viewing Intent over introducing another application-wide test facade. Dismissals must also work when the user skipped selecting a Viewing Intent.
- Keep Session Dismissal state within the existing tab-session model, surviving same-tab reloads and goal changes. Reuse the four-hour sliding inactivity semantics rather than an absolute four-hour duration from goal selection. Expired state must be rejected when the session is next used. A genuinely fresh tab session starts without dismissals; browser session restoration requires explicit verification.
- Provide operations to dismiss a title, undo a dismissal, and review/restore session-dismissed titles. Session feedback must not write to the enduring Taste Profile, create Watchlist Entries, or alter progress.
- Keep Not for me and the other existing lasting taste adjustments behind a secondary control. Explicit lasting feedback remains owned by Taste Profile. Add reversible action outcomes so the App Shell can offer Undo without resetting the whole profile.
- Want to watch uses Watchlist Lifecycle to persist Planned. Keep the chosen title visible in the current decision context after successful persistence, with confirmation, Undo, and a Watchlist link. This is a narrow presentation exception to saved-title exclusion, not a new recommendation pool drawn from the Watchlist.
- Correct the ordinary Watchlist transition path used by selection to honor persistence failure. Reuse the established checked-commit approach: prepare a valid candidate, persist it successfully, then expose the successful state and effects. A rejected write must preserve prior persisted and live entries and must not trigger saved confirmation or success-derived effects.
- Selection and feedback Undo must reverse the relevant action without overwriting unrelated information. Reuse the existing owning runtime boundaries rather than letting the UI restore whole stores from stale snapshots. When intervening changes prevent a safe reversal, preserve those changes and report that the reversal could not be applied.
- Preserve existing Watchlist Entry statuses and persisted data compatibility. Session Dismissals are not part of personal-data backups or enduring preference inference. No backend service, new external API, or catalog-data collection is required.
- Implement in the order of trustworthy persistence, recommendation presentation and grouping, then session feedback and retained selection confirmation. Preserve existing onboarding, browse access, Detail Experience, score explanations, franchise checks, and watch-order behavior.

## Testing Decisions

- The approved primary seam is the existing browser-level discovery-to-Watchlist journey through the real App Shell. Use it to verify visible choices, user actions, saved state after reload, recovery, and keyboard/mobile behavior.
- Existing browser coverage for first-run Viewing Intent, changeable intent summaries, recommendation quick-save, and the complete discovery-to-Watchlist journey provides the acceptance-test starting point. Adapt those scenarios rather than creating a competing test facade.
- Add focused behavioral cases at existing public runtime interfaces only where the browser journey is insufficiently deterministic: Watchlist Lifecycle for persistence failure and Undo, Taste Profile for lasting-feedback reversal and isolation, and the discovery/session boundary for matching results, Session Dismissal, and controlled-clock expiry. Do not add a new cross-application seam.
- Prior art includes the checked MAL import persistence tests, Watchlist Lifecycle transition contracts, Taste Profile candidate-preparation tests, Viewing Intent tests with injected storage and clock, and discovery tests for honest cues and franchise eligibility. Reuse their controlled adapters without copying assertions that merely mirror internal call order or private structures.
- A good test observes external behavior or a public contract: which titles are offered and how they are classified, what state persists, whether a failed operation changes anything, whether Undo preserves unrelated data, and what a user can do next. Avoid asserting incidental HTML strings, helper decomposition, private collection layout, or internal method choreography.
- Cover three-or-fewer initial picks, requesting more, no active goal, fewer than three matches, no matches with alternatives, and no eligible candidates. General alternatives must never be presented as goal matches.
- Cover known, missing, observed-only, and provisional catalog information. Assert the absence of unsupported runtime, final-count, complete-series, and emotional-effect claims while retaining valid rating evidence.
- Force storage refusal and thrown storage errors. Verify no false confirmation, no successful transition effects, unchanged prior state, and recoverable retry. Exercise both newly created and previously existing Watchlist Entries when saving and undoing.
- Verify temporary skipping, immediate Undo, review/restore, same-tab reload, change of Viewing Intent, fresh session, and just-before/after inactivity expiry through an injected clock. Verify Taste Profile and Watchlist data remain unchanged by temporary actions.
- Verify lasting-feedback Undo preserves unrelated preferences and saved history, and selection Undo does not overwrite intervening unrelated or conflicting changes.
- Inspect rendered desktop and mobile flows, including secondary controls, missing-data states, failure feedback, and focus after recovery. Use programmatically named controls and verify keyboard operation and understandable announcements. Preserve existing accessibility capabilities.
- Run focused behavioral tests, type checking, the normal Bun suite, the production build and existing asset/runtime/size checks, and the affected browser flow coverage. Keep existing unrelated failures explicit. This specification does not claim those checks have run.
- Separately observe occasional viewers attempting the same choose-a-title task on the current and revised experience. Record whether they select one title, explain its personal appeal, understand the displayed commitment and rating evidence, and recover from mistaken feedback. Do not substitute saving counts for confidence or invent numerical improvement targets before a baseline exists.

## Out of Scope

- Ranking or choosing from the user's existing saved Watchlist as a separate journey.
- Finding streaming availability, launching playback, or automatically transitioning a selection to Watching.
- New title-level emotional curation, new content collection, inferred viewing hours, or unsupported complete-series claims.
- Adding synopsis snippets to every recommendation card or expanding catalog payloads for that purpose.
- A general Taste Profile editor, a lasting-hidden-title management screen, an explicit Clear viewing goal control, or diagnosis of every possible empty-result cause. The agreed no-close-match explanation and session feedback recovery remain in scope.
- Redesigning Watchlist management, MAL import, Personal Data Restore, catalog maintenance, or the overall application architecture.
- New analytics infrastructure, accounts, social features, backend services, or an engagement-based definition of success.

## Further Notes

The user accepted all three design rounds and the ticket breakdown carrying the proposed test boundaries, then requested implementation. This specification synthesizes those decisions rather than opening another product interview.

Stephen P. Anderson's [UX hierarchy](https://poetpainter.com/thoughts/files/UX-Hierarchy-Model-StephenPAnderson.pdf) provides the review lens. Trustworthy persistence supports reliability; understandable and reversible controls support usability; a compact choice journey supports convenience; the intended pleasure and personal significance require observation rather than claims based on feature presence.

Three initial picks remains an accepted design hypothesis, not a demonstrated optimum. Implementation tests and desktop/mobile visual inspection are recorded in the [implementation report](first-visit-discovery-implementation.md). No participant sessions have been conducted or scheduled for this work. The user confirmed no participants are available and requested the comparison protocol; actual observations remain pending.

The project tracker uses local Markdown. Tickets 01–05 are closed on `feat/first-visit-discovery`; ticket 06 and this parent specification remain blocked on participant evidence. The [comparison protocol](first-visit-study-protocol.md) and [blank observation template](first-visit-study-observation-template.md) are prepared. No ADR is required for the reversible presentation and interaction decisions in this scope.
