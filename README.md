# Rekonime

Rekonime is a static, browser-based anime dashboard that highlights how likely a show is to keep viewers watching, paired with community satisfaction. Each title has a detailed modal with scores, synopsis, trailers, and reviews.

## Quick start
- Open `index.html` in a browser.
- Optional (recommended): run a local server for reliable fetch behavior.
  - Example: `python -m http.server`

## What you can do
- Browse and filter a large anime catalog.
- See retention-style metrics (hook, drop risk, flow, finale strength).
- Get recommendations and similar-anime matches.
- Save favorites to bookmarks (stored locally in your browser).
- **Surprise Me**: Get a random quality anime recommendation.
- **Seasonal Discovery**: Quick filters for This Season, Last Season, Next Season.
- **Trending**: See what's popular right now.
- **Because You Watched**: Personalized recommendations based on your bookmarks.
- **Filter Presets**: One-click curated filters (Binge-Worthy, Critical Darlings, Hidden Gems, etc.).
- **Keyboard Shortcuts**: `?` for help, `/` for search, arrow keys for navigation.
- **Themes**: Switch between Dark, Light, or Auto (OS preference) modes.
- **Offline Support**: Works offline with cached data via Service Worker.

## Data and updates (human view)
- Source data lives in `data/anime.json`.
- The app loads a fast preview first (`data/anime.preview.json`), then swaps to the full catalog (`data/anime.full.json`).
- A fallback dataset is embedded in `js/data.js` for `file://` browsing.

If you want to refresh data:
1) Update or merge source data in `data/anime.json`.
2) Build the preview/full catalogs:
   - `node tools/build-catalogs.js`
3) Regenerate the embedded fallback:
   - `powershell -File tools/regenerate-data.ps1`

## Project map (high level)
- `index.html`, `bookmarks.html`: pages and static markup.
- `css/styles.css`: styles, layout, and responsive rules.
- `css/themes.css`: theme system with light/dark modes and accessibility features.
- `js/app.js`: app state, rendering, filters, modal, bookmarks, SEO.
- `js/stats.js`: retention and scoring metrics.
- `js/recommendations.js`: recommendation + similarity scoring logic.
- `js/reviews.js`: MyAnimeList (via Jikan API) review fetching and rendering.
- `js/discovery.js`: Surprise Me, seasonal discovery, trending, and personalized recommendations.
- `js/filterPresets.js`: quick filter presets (Binge-Worthy, Critical Darlings, etc.).
- `js/keyboardShortcuts.js`: keyboard navigation system.
- `js/metricGlossary.js`: metric definitions and educational tooltips.
- `js/onboarding.js`: first-time user guided tour.
- `js/themeManager.js`: light/dark/auto theme switching.
- `js/serviceWorker.js`: PWA service worker registration.
- `sw.js`: service worker for offline caching.
- `data/`: JSON catalogs (source, preview, full).
- `tools/`: data pipeline scripts and scrapers.

## Architecture diagram (short)
```mermaid
flowchart TD
  index[index.html] --> app[js/app.js]
  bookmarks[bookmarks.html] --> app
  app --> stats[js/stats.js]
  app --> recs[js/recommendations.js]
  app --> reviews[js/reviews.js]
  app --> discovery[js/discovery.js]
  app --> filterPresets[js/filterPresets.js]
  app --> metricGlossary[js/metricGlossary.js]
  app --> onboarding[js/onboarding.js]
  app --> themeManager[js/themeManager.js]
  app --> keyboardShortcuts[js/keyboardShortcuts.js]
  app --> serviceWorkerManager[js/serviceWorker.js]
  app --> css[css/styles.css]
  app --> themes[css/themes.css]
  app --> preview[data/anime.preview.json]
  app --> full[data/anime.full.json]
  full --> embed[js/data.js]
  reviews --> jikan[Jikan API (MyAnimeList)]
  serviceWorkerManager --> sw[sw.js]
```

## FAQ
- Why do fetches fail on `file://`?
  - Some browsers restrict local file fetches. Use a local server instead.
- Why do some titles show limited data?
  - Not every anime has complete metadata or episode scores available.
- Where are bookmarks stored?
  - In browser `localStorage` under `rekonime.bookmarks`.
- How do keyboard shortcuts work?
  - Press `?` anywhere to see all available shortcuts.
- Can I use the app offline?
  - Yes, the Service Worker caches data for offline use.
- How do I change the theme?
  - Click the settings button (⚙️) and choose Dark, Light, or Auto.
