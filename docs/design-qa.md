# Rekonime design QA - denser discovery cards

- Source visual truth:
  - `C:\Users\Lenovo\AppData\Local\Temp\codex-clipboard-9cbba4cb-3a2b-4217-8607-82dac4b3119c.png`
  - `C:\Users\Lenovo\AppData\Local\Temp\codex-clipboard-68d7ebba-e34b-4beb-99b8-94ed234c58b5.png`
- Implementation URL: `http://127.0.0.1:4174/`
- Desktop captures:
  - `output/playwright/quiet-library/density-best-bets-after-1920.png`
  - `output/playwright/quiet-library/density-explore-after-1920.png`
- Mobile captures:
  - `output/playwright/quiet-library/density-best-bets-mobile-390.png`
  - `output/playwright/quiet-library/density-explore-mobile-390.png`
- Full-view comparison: `output/playwright/quiet-library/density-comparison.png`
- Focused heading comparison: `output/playwright/quiet-library/density-heading-focus.png`
- Viewports: 1920 x 1018 desktop content; 390 x 844 mobile
- State: dark theme, auto-hide sidebar at rest, initial card batch

## Findings resolved

- [P1] Best Bets rendered one featured card plus only three secondary cards, leaving two wide desktop tracks empty.
  - Fix: desktop recommendation limit increased from four to six, filling the existing five-card secondary row.
  - Evidence: desktop shows six recommendations; mobile remains three.
- [P1] Explore Every Title initially rendered four cards despite space for more.
  - Fix: desktop initial catalog batch increased from four to six; mobile remains three.
  - Evidence: six desktop cards occupy the first row with no horizontal page overflow.
- [P1] The opaque full-height sidebar hover target covered the first 8 px of the Explore heading and subtitle.
  - Fix: the existing 40 px hover target remains interactive but is transparent at rest.
  - Evidence: focused comparison shows the full `E` and `B`; hovering anywhere along the left edge still reveals the sidebar.

## Fidelity review

- Fonts and typography: unchanged; Explore heading and subtitle are no longer masked.
- Spacing and layout rhythm: existing desktop grid tracks are filled; mobile keeps its single-column card layout.
- Colors and tokens: unchanged; the sidebar trigger only loses its opaque resting fill.
- Image quality: all six desktop catalog covers loaded at natural width; crops are unchanged.
- Copy and content: unchanged.

## Comparison history

- Pass 1: source screenshots showed empty desktop tracks and clipped Explore text.
- Pass 2: six-card density passed, but the first implementation still clipped Explore because padding treated the symptom.
- Pass 3: the transparent edge trigger fixed the shared masking root cause; desktop and mobile captures show intact text and responsive card counts.

## Verification

- Desktop initial counts: Best Bets 6; Explore 6.
- Mobile initial counts: Best Bets 3; Explore 3.
- Mobile viewport width=390 and document scroll width=390; no horizontal page overflow.
- Left-edge hover interaction: sidebar transform settled at visible state.
- Browser console: 0 errors on desktop and mobile.
- Targeted integration test: 8 pass, 0 fail.
- TypeScript, production build, distribution asset check, and `git diff --check`: passed.

final result: passed
