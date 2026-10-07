# First-visit Discovery comparison protocol

Status: prepared, not conducted. No participants are available yet. Ticket 06 remains blocked by participant access and the completed revised flow. This protocol does not establish that the redesign improves confidence, comprehension, or enjoyment.

Use this protocol with the [blank observation template](first-visit-study-observation-template.md) and the [agreed spec](first-visit-discovery-spec-draft.md).

## Question and participants

Can an occasional anime viewer unfamiliar with Rekonime choose one title, explain its personal appeal, understand the available evidence, and recover from an accidental action?

Recruitment is not part of this preparation. When participants become available, ask how often they watch anime, how they usually choose, whether they recognize genres, and whether they have used Rekonime or understand its scores. Record their own description rather than inventing a frequency threshold. Use anonymous IDs such as P01. Keep contact details outside these documents. Obtain permission before recording a session or quoting it; otherwise take anonymous notes. A participant may stop or skip any task.

Three initial picks is a design hypothesis. Save counts alone are not evidence of confident choice. Do not set an improvement percentage before observations exist.

## Prepare both experiences

1. Use application baseline commit `8c1b3bf`. Record its full commit ID and the exact completed integration commit used for the revised experience when the study runs. Do not use a moving branch name as the only build identifier.
2. Serve each build from a separate local origin or isolated browser profile. Use disposable study data, with no personal Watchlist or Taste Profile. Start each main task with empty Watchlist, Taste Profile, and session storage, and the normal first-visit Onboarding Journey visible. Do not copy the participant's first-run choices into the second build.
3. Keep the device, viewport, catalog revision, network conditions, and task wording equivalent. Freeze and record the catalog used. Record any unavoidable data or title-order differences, including prior familiarity with offered titles. Do not attribute their effects to the three-pick layout.
4. Check that both builds load, title details work, and the revised tickets 02 through 05 are integrated. Confirm storage, recovery controls, and the controlled scenarios below work before inviting participants. Record failures in the engineering log separately. A baseline feature that does not exist is an unavailable capability, not a participant error.
5. Assign the first participant baseline then revised, the next revised then baseline, and alternate where practical. Keep each participant on their usual input method and the same device for both builds. Record departures from the order and why. Report learning and title-familiarity carryover even with counterbalancing.
6. Create a fresh copy of the observation template for each participant. Record the study date, facilitator, environment, order, build IDs, and catalog revision. Leave outcomes blank until observed.

## Main task, once per build

Read the same prompt without naming controls or recommending a goal:

> Imagine you have time to start an anime but do not know what to watch. Use this app to choose one you would want to try. Tell me when you have decided, and explain what makes it a good choice for you. You may also decide that none of these is suitable.

Ask the participant to say what they are thinking. Let them choose or skip the Onboarding Journey and explore normally. Do not explain scores, point at a card, require a save, or tell them to stop after three picks. Record the titles shown, actions, visible information consulted, hesitations, requests for more options, and the chosen title or reason for no choice. Record elapsed time descriptively if timed, without a pass/fail threshold.

If they ask for help, first ask what they expected to happen. Record any help before giving it, and distinguish independent completion from assisted completion. End when they decide, decline to choose, or ask to stop. Record interruptions rather than silently excluding them.

After the choice, ask these neutral probes and preserve the participant's wording:

- What made this title appealing to you? Which information did you use?
- What does the episode information tell you? What does it leave unknown?
- What do the displayed ratings tell you? What would they not tell you?
- Why do you think this title was suggested? If a goal was selected, how does it relate to that goal?
- How certain do you feel about trying it, and what would make the decision easier?

Keep spontaneous understanding separate from understanding after these prompts or facilitator explanations. A saved title without a reason remains a save, not an established confident choice.

## Controlled comprehension and recovery tasks

Run these after the main task so training does not affect first-visit choice. Reset disposable study state between scenarios. Show equivalent catalog examples in both builds where supported, and record the exact title IDs and evidence used. Use existing browser-test fixtures or verified catalog records; fixture titles are test data, not participant findings. Have the facilitator verify the facts privately before the session.

| Scenario | Prompt or setup | Observe |
| --- | --- | --- |
| Episode and rating uncertainty | Show an example with a known episode count, one with only observed episodes and an unknown final total, and one with missing episode information. Include provisional rating evidence. Ask, "What can you tell about these titles from this information?" | Whether the participant confuses observed episodes with final length, invents viewing hours, treats a provisional score as certain, or understands that a score does not guarantee enjoyment or completion. Record absent information in the baseline. |
| Goal alternatives | Show a controlled goal with few or no close matches and available general alternatives. Ask, "Why are these titles here? What would you do next?" | Whether they distinguish supported goal suggestions from general alternatives and notice missing matches without assuming an emotional guarantee. |
| Temporary action and immediate recovery | "Set this title aside for now without changing what the app thinks you like. Now imagine that was a mistake. Bring it back." | Which action they choose, whether they understand its scope, find Undo, and recognize restoration. Do not name Skip for now or Undo before the attempt. |
| Later temporary recovery | Have the participant set another title aside, reload the same tab, and change the Viewing Intent. Then ask them to find and restore that title. | Whether they understand why it stayed skipped and find the review/restore route. Four-hour inactivity expiry is an engineering check, not a reason to hold a participant for four hours. |
| Lasting feedback and recovery | "Tell the app this title does not suit your taste in future visits. Now imagine you chose the wrong title. Reverse that feedback." Seed one unrelated preference and Watchlist Entry as disclosed disposable test data. | Whether the secondary action's lasting effect is understood, the participant can reverse it, and the app communicates the outcome. Verify preserved unrelated data separately as engineering evidence. |
| Save and reversal | "Keep this title so you can find it later. Where would you look for it? Now imagine you saved it by mistake. Reverse the save." | Whether the title remains recognizable, the participant understands Planned rather than Watching, finds the Watchlist link and Undo, and understands the result. |
| Failed save and retry | In a disposable profile, deliberately refuse the save using the existing controlled browser-test approach. Ask the participant to save, then ask what happened and what they would do next. Restore writes before they retry. | Whether they mistake failure for success, understand the retry action, and can finish. Record the injected failure so it is not mistaken for an ordinary production incident. |

When the baseline lacks a requested action, allow the participant to try, record the unavailable capability, and stop that scenario without coaching an invented substitute. If a facilitator must stage an accidental action, mark the setup as assisted and observe recovery separately. Do not claim unassisted discovery of an action you just demonstrated.

For each recovery, ask what they expect to happen after reload or a later visit before explaining it. Record visible behavior separately from checks of persisted data. Automated conflict, unrelated-data isolation, expiry, keyboard, and mobile checks remain required engineering evidence; this study does not replace them.

## Debrief and interpretation

After both builds, ask which helped them choose and why, what remained confusing, and whether either made them feel pressured or uncertain. Do not describe one build as improved before asking. Separate what they preferred from what they could complete independently.

For each participant and build, summarize choice, personal reason, evidence comprehension, assistance, recovery, confidence in their own words, and concrete obstacles. Link each finding to an observed action or permitted quotation. Put evaluator interpretations in their own column. Record contradicting observations and incomplete tasks.

Report the actual sample and device mix, order, prior title knowledge, any missing scenarios, facilitator assistance, catalog differences, and carryover. Small convenience samples support specific usability findings, not population-wide effect claims. Describe counts only with their actual denominators and missing cases. Do not declare three picks optimal or claim improved confidence from engineering checks.

## Completion and evidence boundary

Store a separate engineering verification log with build IDs, commands or manual scenarios, results, and artifact links. Baseline screenshots and automated tests are engineering evidence. They are not participant observations.

Ticket 06 can close only after actual sessions cover the agreed choice, comprehension, and recovery questions and an evidence-based comparison reports limitations. Until then, keep participant observations, comparison conclusions, and the remaining ticket criteria pending. Protocol preparation alone is complete; no session has been conducted or scheduled by this change.
