# 02: Standardize rating names, scales, and evidence

**What to build:** Give viewers consistent rating names, scales, and evidence disclosures across recommendations, catalog cards, details, sorting, and help.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [ ] Community score has MAL attribution and an explicit /10 scale across relevant surfaces.
- [ ] Episode rating strength has an explicit /100 scale; user-facing finish-rate and satisfaction labels for these metrics are replaced consistently.
- [ ] Explanations remain expandable and preserve unavailable, limited-data, unknown-total, and provisional states.
- [ ] An unavailable episode-score sentinel is never presented as a measured zero or completion probability.
- [ ] Score formulas, provider work, storage keys, and recommendation rules remain unchanged.
- [ ] Existing browser fixtures verify supported values and missing/provisional evidence through the approved seam, with a recorded red/green TDD cycle rather than internal markup assertions.
- [ ] Desktop/mobile rendered inspection confirms readable labels, scales, and disclosures in both themes; affected checks and type checking are recorded.

## Context

Parent: [Mobile Discovery UI specification](../../../docs/ui-design-spec.md). Preserve all parent scope boundaries. Record implementation commit and actual validation evidence when closing.
