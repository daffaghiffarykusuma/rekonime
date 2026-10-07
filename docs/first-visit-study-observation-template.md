# First-visit Discovery observation record

Blank template. Duplicate for one anonymous participant only after a session is arranged. Empty fields mean not recorded, not success. Follow the [comparison protocol](first-visit-study-protocol.md).

## Session context

| Field | Record |
| --- | --- |
| Anonymous participant ID | |
| Date and facilitator | |
| Consent for notes, recording, and quotations | |
| Participant's description of anime viewing frequency | |
| Usual way of choosing and genre familiarity | |
| Prior Rekonime and scoring knowledge | |
| Device, browser, viewport, input method | |
| Assigned and actual build order; reason for any departure | |
| Baseline full commit ID, starting from 8c1b3bf | |
| Revised full integration commit ID | |
| Catalog revision and any cross-build differences | |
| Isolated origins/profiles and clean starting state verified | |
| Interruptions, adaptations, or session stopped early | |

## Main task comparison

| Item | Baseline | Revised |
| --- | --- | --- |
| Offered title IDs and prior title familiarity | | |
| Onboarding choice / Viewing Intent / skipped onboarding | | |
| Actions and information consulted before deciding | | |
| Chosen title or explicit no-choice outcome | | |
| Personal reason in participant's words | | |
| Independent / assisted / incomplete; help supplied | | |
| Elapsed time if measured; timing definition | | |
| Spontaneous understanding of episode information | | |
| Response after episode-information probe | | |
| Spontaneous understanding of ratings and their limits | | |
| Response after ratings probe | | |
| Understanding of goal support versus general alternatives | | |
| Confidence in participant's words, before any explanation | | |
| Hesitation, confusion, unsupported interpretations | | |
| Saving action, if any; keep separate from choice outcome | | |

## Controlled tasks

Record independent completion, assisted completion, incomplete, unavailable capability, or not attempted, with the reason. Include fixture/title IDs, actual state, and whether the facilitator staged the action. Do not infer understanding from a click alone.

| Scenario | Build and test data | Observed action / permitted quote | Outcome and assistance | Evaluator interpretation |
| --- | --- | --- | --- | --- |
| Known / observed-only / unknown episode count and provisional rating | | | | |
| Few / no close goal matches with general alternatives | | | | |
| Temporary action and immediate Undo | | | | |
| Temporary review/restore after reload and goal change | | | | |
| Lasting feedback and reversal | | | | |
| Save, find in Watchlist, and reverse | | | | |
| Controlled failed save and retry | | | | |

Add rows for the second build and repeated attempts. Record expectations about later visits before explaining the actual behavior.

## Observation log

| Build, task, and time or sequence | Direct observation / permitted quote | Help or prompt given | Interpretation and uncertainty |
| --- | --- | --- | --- |
| | | | |

## Debrief and limitations

- Which experience the participant preferred, and their stated reason:
- Remaining questions, pressure, or uncertainty in their words:
- Contradicting observations:
- Order effects, repeated-title familiarity, and learning carryover:
- Missing or unavailable scenarios, technical interruptions, or incomplete tasks:
- What this session supports:
- What this session cannot establish:

## Engineering evidence, recorded separately

Reference a separate verification log for build checks, storage isolation, unrelated-data preservation, conflicting Undo, four-hour expiry, and keyboard/mobile results. Do not enter automated checks as participant outcomes.

- Engineering log and build IDs:
- Known technical limitations relevant to this session:

## Cross-session comparison, complete only after observations

Keep the aggregate report separate from individual records. Include actual participant count, build order and device mix, task denominators, assistance and incomplete cases, supported findings with record references, contrary evidence, and limitations. No numeric target or confidence-improvement claim is prefilled by this template.
