# UX hierarchy review

Date: 2026-10-07. Source baseline: `8c1b3bf`.
Status: all three interview rounds accepted. Design exploration complete; app implementation has not started.

## Framework and scope

Stephen P. Anderson's [original UX hierarchy](https://poetpainter.com/thoughts/files/UX-Hierarchy-Model-StephenPAnderson.pdf) describes six levels: functional, reliable, usable, convenient, pleasurable, and meaningful. Here they organize questions about Rekonime's experience. They are not a numerical maturity score or evidence that users feel a particular emotion.

Current-source inspection is the main evidence. A local development browser loaded onboarding and rendered recommendations after selecting Help me unwind. Page-text inspection worked; screenshot capture repeatedly failed. Desktop visual quality, mobile layout, accessibility, production behavior, and user outcomes remain unverified. No test suite was run for this review.

Existing capabilities include Viewing Intent, recommendation fit reasons, rating coverage and explanations, franchise eligibility, watch-order details, Continue watching, Taste Profile feedback, backup export/restore, and reviewed MAL import. These should not be proposed as missing features.

## Agreed implementation brief

Help an occasional viewer new to Rekonime choose one anime and explain why it suits them. The first pass covers first-visit discovery. The user accepted the recommendations in all three interview rounds below.

### Intended journey

1. Use the existing optional Viewing Intent entry point.
2. Present up to three compact picks initially, with more available on request. Lead with supported fit information and available episode-count information. Keep numeric ratings secondary and deeper explanations available on demand.
3. Use the existing documented genre/theme rules to distinguish suggestions for the selected goal from separately labelled general alternatives. State when no close match is available. Do not fill the matching group with general picks to reach three cards.
4. Keep Skip for now easy to find. Put lasting Taste Profile adjustments behind a secondary control, with Not for me explicitly indicating lasting feedback. Both kinds of feedback support Undo.
5. Want to watch saves the chosen title as Planned only after successful persistence. Keep the chosen title visible with confirmation, Undo, and a Watchlist link. Selecting it does not mark it Watching.
6. Session Dismissals survive same-tab reloads and changes of Viewing Intent. They expire with the four-hour inactivity window. Provide a way to review and restore titles skipped during the session. Verify browser session-restoration behavior before promising that closing a tab always clears dismissals.

Retaining a just-chosen title as confirmation is a narrow exception to the current saved-title exclusion. It does not introduce recommendation ranking over the existing Watchlist, which remains deferred.

### Acceptance criteria

| Area | Required behavior | Validation evidence |
| --- | --- | --- |
| Initial choice set | Up to three initial picks, more on request, goal suggestions distinct from alternatives. | Desktop/mobile browser checks, including fewer than three matches and no matches. |
| Honest information | Supported fit and known episode information; no invented duration, final series length, or emotional effects. | Missing, observed-only, and provisional data cases. |
| Rating hierarchy | Ratings secondary, with explanations on demand. | Rendered inspection and user comprehension observation. |
| Goal matching | Existing genre/theme evidence determines match grouping. General alternatives cannot appear as close matches. | Matching, nonmatching, and absent-signal cases. |
| Saving | Persist Planned, retain the chosen title with confirmation and a Watchlist link, no automatic Watching transition. | Browser save/reload and lifecycle checks. |
| Failed saving | No saved confirmation or false successful Watchlist state when persistence fails. | Forced storage-failure and recovery checks. |
| Undo selection | Reverse the selection change without removing unrelated Watchlist information. | Existing-entry and newly-saved-entry cases. |
| Temporary feedback | Skip for now changes session recommendations without changing Taste Profile or Watchlist data. | State isolation, reload, goal-change, and expiry checks. |
| Dismissal recovery | Undo and review/restore of skipped titles work during the session. | Browser interaction and keyboard checks. |
| Lasting feedback | Not for me intentionally changes lasting taste; Undo preserves unrelated preferences. | Focused feedback and persistence checks. |
| Usability | A new occasional viewer chooses a title, explains its appeal, interprets the evidence, and recovers from mistaken feedback. | Observed task sessions comparing current and revised flows. |

Three initial choices is an accepted design hypothesis, not a measured optimum. Automated checks cannot establish confidence or enjoyment. No user-test sessions have been run or scheduled, and no numerical improvement target has been agreed.

### Suggested implementation order

1. Correct save-failure handling so selection confirmation can be trusted.
2. Implement the three-pick presentation, information hierarchy, and distinction between matching suggestions and alternatives.
3. Add Session Dismissal, feedback Undo, and retained selection confirmation.
4. Verify the implemented flows and render desktop/mobile states, then evaluate confidence and comprehension with occasional viewers.

### Boundaries

Choosing from saved Watchlist titles, finding streaming availability, new title-level emotional curation, and inferred viewing hours are outside this pass. The broader audit also identified granular Taste Profile editing, an explicit Clear viewing goal control, and diagnosis of all empty-result causes. Those remain follow-up opportunities, except for the no-close-match explanation and feedback recovery explicitly included above.

Existing onboarding, browse access, score disclosures, franchise eligibility, watch-order details, and other established product flows remain the baseline. No ADR is needed for these reversible presentation and interaction choices.

## Audit findings

The findings below describe the inspected baseline and include opportunities beyond the agreed first pass. The implementation brief above defines the selected scope.

### 1. Reliable: make saved mean persisted

`save()` returns false when storage cannot persist a Watchlist change. Ordinary `setStatus()` ignores the result, updates memory, and returns `changed: true`. The app can subsequently show success. This is a source-confirmed defect, not a reproduced browser incident.

Evidence: `src/features/watchlist/watchlist-state.js:483`, `src/features/watchlist/watchlist-state.js:739`, `src/app/app.ts:850`. Import already checks persistence through `commitEntries()` in `src/features/watchlist/watchlist-lifecycle-runtime.ts:111`.

Candidate change: apply checked persistence to ordinary Watchlist changes, retain the previous state on failure, and offer an actionable retry message. Verification should force storage failure and establish that neither the displayed status nor the saved data falsely reports success.

### 2. Usable and meaningful: let people correct their taste

Not for me stores a lasting title exclusion. Its toast has no Undo. Preferences renders noninteractive genre/theme chips, reports hidden titles only as a count, and offers a whole-profile reset. The glossary calls Taste Profile editable, but selective correction is missing from this interface.

Evidence: `src/features/preferences/taste-profile.ts:258`, `src/features/preferences/taste-profile.ts:293`, `src/app/app.ts:727`, `src/app/app.ts:3909`, `src/app/app.ts:4005`, `src/app/app.ts:4012`.

Candidate changes identified during the audit: Undo for recent feedback, individual preference removal, and a hidden-title list with Unhide. The interview subsequently selected Skip for now as temporary feedback and Not for me as lasting feedback, both with Undo. Existing More like this logic can remove a title exclusion, but the Preferences interface does not expose a hidden-title recovery workflow.

Validation scenario: a person accidentally hides a title, then restores it without losing unrelated preferences.

### 3. Usable: provide exits and recovery

An active Viewing Intent exposes Change but no explicit clear control. The expanded chooser contains only the five intents. The runtime supports clearing, and currently clears on some lifecycle transitions or expiry. Separately, all zero-recommendation cases show the same No recommendations available message despite several possible causes.

Evidence: `src/app/app.ts:2926`, `src/app/app.ts:2938`, `src/features/discovery/viewing-intent.ts:122`, `src/features/watchlist/watchlist-lifecycle-runtime.ts:144`, `src/app/app.ts:4118`, `src/app/app.ts:4137`.

Candidate changes: Clear viewing goal, plus empty-state explanations that identify the actual constraint and offer a narrow recovery action. Do not claim the cause is known until the recommendation decision exposes it.

Validation scenarios: return to unconstrained discovery without waiting for expiry; recover from an empty result without resetting the entire Taste Profile.

### 4. Convenient: help choose from the backlog

Recommendations exclude Planned entries along with Watching, Completed, and Dropped entries. Continue watching only covers Watching. Saving a recommendation therefore removes it from the candidate set used for Viewing Intent recommendations.

Evidence: `src/app/app.ts:4119`, `src/app/app.ts:4688`, `src/features/watchlist/continue-watching.ts:4`.

Candidate change: an explicit Choose from my Watchlist route that applies the current Viewing Intent to saved-for-later titles. This is a product hypothesis. Excluding saved titles is reasonable if Discovery primarily means finding unfamiliar anime.

Validation scenario: a returning user has twelve Planned titles and wants something suitable for tonight. Observe whether they can choose without reopening each title. Do not equate saving another title with making a viewing decision.

### 5. Pleasurable: make recommendations easier to distinguish

In the inspected Help me unwind session, all six recommendation cards repeated the same slice-of-life/iyashikei fit explanation. That explains inclusion but gives little assistance choosing between them. Recommendation code prepares Experience Cues, but the template assigns them to an unused variable.

Evidence: browser page text at 1280 x 800; `src/app/app.ts:4149`; `src/features/discovery/recommendations.ts:123`.

Candidate change: test a compact, supported distinction between titles, such as viewing commitment or a curated Experience Cue, replacing repetitive copy where possible. More labels alone may increase reading effort. No assumption is made that this improves enjoyment until people try it.

Intent is also a ranking bonus, not a hard eligibility rule. A nonmatching title can appear as General pick. Consider separating close matches and general alternatives if the chosen product promise warrants it. Avoid promising emotional outcomes from genre tags.

Evidence: `src/features/discovery/recommendations.ts:72`, `src/features/discovery/recommendations.ts:85`, `src/features/discovery/recommendations.ts:123`, `src/features/discovery/experience-cues.ts:1`.

## Initial recommendation

Address the persistence defect first. Then prioritize reversible feedback and clear recovery controls. The accepted design scope is first-visit discovery, so choosing from saved Watchlist titles is deferred. Meaningful use should be tested through whether people recognize and can correct their own preferences, rather than inferred from engagement counts.

## Accepted design decisions

Round 1 decisions accepted by the user:

1. Primary outcome: choose an anime confidently.
2. Primary audience: an occasional viewer new to Rekonime who recognizes genres but does not understand Rekonime's scoring system.

Round 2 recommendations accepted together by the user:

3. Successful endpoint: select one title and explain its fit. Saving is supporting evidence, not proof of confidence. Finding where to watch is outside this endpoint.
4. Information hierarchy: plain-language fit and viewing commitment first, ratings as secondary evidence with deeper explanations on demand. Only display supported facts; unknown commitment remains unknown.
5. Viewing Intent strength: distinguish close matches from separately labelled alternatives and state when no close match is available. Genre-based evidence does not guarantee an emotional effect.
6. Negative feedback meaning: a session-only Skip for now action plus an explicit lasting Not for me action, with Undo. Session Dismissal is the canonical domain term for the temporary choice.
7. First-pass scope: first-visit discovery. Retain choosing from saved Watchlist titles for a later pass.

Round 3 recommendations accepted together by the user. The recommendations below are agreed design requirements, not implemented behavior:

8. Initial choice set and card presentation. Agreed: three compact picks, with more available on request. Lead with supported fit information and known episode count, show ratings as secondary evidence, and put lasting taste adjustments behind a secondary control. Keep Skip for now easy to find. Three is a design hypothesis, not a proven optimum.
9. Evidence for goal matching. Agreed: keep the documented genre/theme rules for this pass, describe suggestions honestly, and separate general alternatives. Title-level emotional curation would be additional content work and is not silently assumed.
10. Selection behavior. Agreed: Want to watch saves the title as Planned, keeps the chosen title visible with confirmation and Undo, and offers a Watchlist link. Do not automatically mark it Watching. Confirmation requires successful persistence. Retaining the chosen card is an agreed change to the current saved-title exclusion behavior.
11. Session Dismissal lifetime. Agreed: survive reloads in the same tab and use the existing four-hour inactivity boundary; a new tab session starts fresh. Changing Viewing Intent alone does not restore dismissed titles. Offer Undo and a way to review/restore titles skipped in the session. Session-restore browser behavior needs verification before making stronger tab-close promises.
12. Validation. Agreed: observe occasional viewers attempting the same choose-a-title task on the current and revised experience. Look for a chosen title with a personally relevant reason, correct understanding of the available commitment/ratings, and successful recovery from accidental feedback. Engineering checks can verify behavior but cannot establish confidence or enjoyment. No numerical improvement claim or threshold is set without a baseline.

All questions in the selected design scope are settled. User acceptance of Round 3 completes the interview. Implementation details and validation results remain future work, not unanswered product decisions.

## Additional source facts for Round 3

The runtime index includes episode counts and genre/theme arrays at `tools/copy-static.js:54` and `:58`. The catalog has no duration field, so exact viewing hours cannot be shown as facts. The episode-count resolver can use observed episodes when the declared count is missing, `src/features/catalog/catalog-payload.ts:115`; do not present such a count as a guaranteed final series length. Completion evidence is mostly unknown. Avoid complete-series claims without evidence.

Existing synopsis data lives in detail chunks after the full-index upgrade, `tools/copy-static.js:63`. A reliable synopsis snippet on all cards would require additional detail loading or a payload change. Details already provide the synopsis, episode count, and tags at `src/features/detail/detail-presentation.ts:152`, `:228`, and `:249`.

Viewing Intent uses sessionStorage at `src/features/discovery/viewing-intent.ts:37`. Expiry is checked on read, and each successful read renews its activity timestamp at `:50` and `:61`. The four-hour window is not an absolute duration from initial selection, and this module does not schedule a timed UI refresh. The Session Dismissal lifetime above is agreed design; no dismissal runtime exists yet.

## Documentation decisions

Reuse the existing terms Viewing Intent, Taste Profile, Watchlist Entry, Discovery, and Experience Cue. Added Session Dismissal to the glossary after the user accepted separate temporary and lasting feedback. This records agreed product language; the behavior is not implemented yet. No hard-to-reverse trade-off has been accepted, so no ADR is warranted yet. Capture further resolved terms and qualifying decisions as the interview proceeds.
