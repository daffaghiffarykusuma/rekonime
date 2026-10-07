# 02: Offer three understandable Discovery picks

**What to build:** A new viewer sees up to three compact recommendations with understandable fit and episode information, can distinguish Viewing Intent suggestions from general alternatives, and can request more choices.

**Blocked by:** None (can start immediately).

**Status:** draft, pending breakdown approval

- [ ] Keep optional onboarding and general Discovery available when no Viewing Intent is selected.
- [ ] Initially show no more than three picks in total; additional recommendations require an explicit action.
- [ ] Use existing genre/theme rules to classify supported suggestions and separately labelled general alternatives; a ranking bonus alone does not establish a match.
- [ ] Prioritize available matches, never disguise general alternatives as matches, and explain when no close match exists.
- [ ] Handle fewer than three matches, alternatives without matches, and no eligible candidates without inventing a match.
- [ ] Lead with supported fit and known episode information; keep numeric ratings secondary with existing score coverage, provisional disclosures, and on-demand explanations.
- [ ] Do not invent viewing hours, final series length, completed-series status, or emotional effects; preserve honest unknown and observed-only episode states.
- [ ] Preserve franchise eligibility, watch-order access, and Detail Experience access without introducing a new Watchlist recommendation pool.
- [ ] Verify the user-visible journey and recommendation decision outcomes using existing browser and runtime test boundaries.
- [ ] Inspect desktop/mobile rendering and keyboard use, including more choices, score explanations, and missing-data states.
