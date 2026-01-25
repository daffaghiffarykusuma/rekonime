# Architecture Overview

Rekonime is a static front-end app that renders anime data, stats, and recommendations in the browser.

## Core Modules
- `index.html`: Base layout and script includes.
- `js/app.js`: Application state, rendering, modal logic, and filters.
- `js/stats.js`: Episode score metrics and retention calculations.
- `js/recommendations.js`: Recommendation and similarity scoring helpers.
- `js/reviews.js`: AniList review fetching and rendering.
- `css/styles.css`: Global styling and component layouts.

## Data Flow
1. `App.loadData()` fetches `data/anime.json` or uses `ANIME_DATA` fallback.
2. `App.calculateAllStats()` enriches each anime with computed stats.
3. Rendering functions update the catalog, recommendations, and modal views.

## Similar Anime Flow
1. `App.renderSimilarAnimeSection()` calls `Recommendations.getSimilarAnime()`.
2. `Recommendations.getSimilarAnime()` filters by shared genre + theme and scores alignment on retention/satisfaction.
3. The modal renders a grid of similar anime cards below community reviews.
