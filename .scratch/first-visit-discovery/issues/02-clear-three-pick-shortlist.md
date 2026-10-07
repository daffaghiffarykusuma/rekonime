# 02: Offer three understandable Discovery picks

**What to build:** A new viewer sees up to three compact recommendations with understandable fit and episode information, can distinguish Viewing Intent suggestions from general alternatives, and can request more choices.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Keep optional onboarding and general Discovery available when no Viewing Intent is selected.
- [x] Initially show no more than three picks in total; additional recommendations require an explicit action.
- [x] Use existing genre/theme rules to classify supported suggestions and separately labelled general alternatives; a ranking bonus alone does not establish a match.
- [x] Prioritize available matches, never disguise general alternatives as matches, and explain when no close match exists.
- [x] Handle fewer than three matches, alternatives without matches, and no eligible candidates without inventing a match.
- [x] Lead with supported fit and known episode information; keep numeric ratings secondary with existing score coverage, provisional disclosures, and on-demand explanations.
- [x] Do not invent viewing hours, final series length, completed-series status, or emotional effects; preserve honest unknown and observed-only episode states.
- [x] Preserve franchise eligibility, watch-order access, and Detail Experience access without introducing a new Watchlist recommendation pool.
- [x] Verify the user-visible journey and recommendation decision outcomes using existing browser and runtime test boundaries.
- [x] Inspect desktop/mobile rendering and keyboard use, including more choices, score explanations, and missing-data states.

## Resolution (2026-10-07)

Merged at c961ed1; evidence and explanation fixes at 7407fdd and 1ddbcf0. Verified three initial picks, explicit more, goal/alternative grouping, no-match states, known/unknown/observed episode evidence, score disclosures, detail access, and desktop/mobile rendering.

Final implementation: `1ddbcf0`. See the [combined verification report](../../../docs/first-visit-discovery-implementation.md) for full-suite results and visual evidence. Actual participant validation is tracked separately by ticket 06.
