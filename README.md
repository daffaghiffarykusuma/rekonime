# Rekonime

Rekonime is a static anime scoring dashboard that highlights retention and community satisfaction, with a detailed modal for each title.

## Quick Start
- Open `index.html` in a browser.
- Optional: run a local server for the cleanest fetch behavior.
  - Example: `python -m http.server`

## Data
- Primary data lives in `data/anime.json`.
- A fallback dataset is embedded for file-based browsing.

## Development Notes
- `js/app.js` orchestrates rendering and modal behavior.
- `js/recommendations.js` contains recommendation and similarity scoring logic.
- `js/reviews.js` fetches AniList reviews for the modal.
