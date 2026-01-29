# Rekonime User Journey

## Purpose
- Map the end-to-end experience for a user from entry to exit.
- Align UX steps with the app's data flows and UI surfaces.

## Entry points
- `/` or `index.html`: primary catalog experience.
- `/home` or `home/index.html`: alias entry point using the same JS/CSS stack.
- `/bookmarks` or `bookmarks.html`: saved list.
- Deep links via URL query params (filters or `?anime=...`).

## Journey overview (high level)
1. Land on catalog and see loading state.
2. First-time users see onboarding tour; returning users skip it.
3. Preview data loads and the grid renders.
4. Full catalog loads and the grid updates.
5. User discovers anime via scroll, search, filters, Surprise Me, or seasonal chips.
6. User opens detail modal to evaluate a title.
7. User bookmarks or returns to browsing.
8. Personalized recommendations appear based on bookmarks.
9. URL state updates for sharing and navigation.
10. Session ends with bookmarks, theme preference, and cached synopsis preserved.

## Step-by-step: first-time visitor (catalog)
- Landing + loading: `App.init()` shows a loading state and reads bookmarks.
- Onboarding: `Onboarding.startTour()` presents a 4-step guided tour (welcome, retention, satisfaction, discovery) if not previously completed/skipped.
- Initial content: `data/anime.preview.json` renders cards and filter options.
- Discover: user scrolls, sorts, opens filters, uses header search, or clicks Surprise Me.
- Result set: `App.applyFilters()` updates `activeFilters`, resets pagination, and re-renders.
- Detail: selecting a card opens the modal and updates the URL.
- Evaluation: synopsis, trailer, reviews, and similar anime are presented.
- Decision: user bookmarks or closes the modal.
- Continuation: user loads more results when available.

## Search flow
- User types into `#header-search`.
- App matches against `anime.searchText`.
- Selecting a result triggers `data-action="open-anime"` and opens the modal.

## Filter and sort flow
- User opens the filter modal and toggles filters.
- Filters live in `App.activeFilters` and options in `App.filterOptions`.
- Active filters are shown and synced to URL query params for shareable state.
- Sorting uses `Recommendations.getSortOptions()` and metric-based sorting.

## Detail modal experience
- Modal shows title, metadata, synopsis, and key stats.
- Trailer embed uses sanitized YouTube URLs.
- Reviews load from MyAnimeList (via Jikan) and render in tabs.
- Similar anime uses shared genres/themes plus score alignment.
- URL updates with `?anime=...` and SEO metadata refreshes.

## Bookmarks flow
- User toggles bookmark on a card or in the modal.
- App stores `rekonime.bookmarks` in localStorage.
- `bookmarks.html` renders saved items using the same card layout.

## Returning visitor
- Bookmarks load from localStorage during init.
- Theme preference (dark/light/auto) applies automatically from `rekonime.theme`.
- Onboarding skipped if previously completed (`rekonime.onboarding`).
- Keyboard hint suppressed if previously acknowledged (`rekonime.shortcutsAcknowledged`).
- Deep links restore filter state or open an anime modal.
- Cached synopsis/reviews reduce repeat fetches for 30 days.
- "Because You Watched" section personalized based on bookmark history.

## Trailer autoplay behavior
- Trailer section initializes with sanitized URLs.
- Autoplay uses `IntersectionObserver` with a scroll fallback.
- Settings allow disabling autoplay and hiding embeds (data saver).

## Error states and fallbacks
- If `file://` or fetch fails, app uses embedded `ANIME_DATA`.
- Preview data loads first; full data swaps in when available.
- Image fallbacks use `data-fallback-src`.
- Review failures fall back to local synopsis when needed.

## Discovery flows
- Surprise Me: user clicks "Surprise Me" button to get a weighted random anime recommendation.
  - `Discovery.getSurpriseMe()` filters by quality thresholds and bookmark preferences.
  - Selection opens detail modal automatically.
- Seasonal Discovery: automatic "This Season", "Last Season", "Next Season" chips appear if data exists.
  - `Discovery.getSeasonalFilters()` generates season chips based on current date.
  - Clicking applies season+year filters instantly.
- Trending: "Trending Now" section shows anime ranked by recency, MAL scores, and quality metrics.
  - `Discovery.getTrending()` calculates trending scores for live display.
- Because You Watched: personalized recommendations appear when user has bookmarks.
  - `Discovery.getBecauseYouWatched()` matches bookmark genres/themes to similar unwatched anime.

## Filter preset flow
- Filter modal shows "Quick Picks" section with curated presets (Binge-Worthy, Critical Darlings, Hidden Gems, etc.).
- `FilterPresets.applyPreset()` applies pre-configured filter combinations.
- Presets can also be rendered as chips in the UI for quick access.

## Keyboard shortcuts flow
- First-time hint appears after 2 seconds: "Press ? for keyboard shortcuts".
- `?` opens keyboard shortcuts help modal with all available shortcuts.
- `/` focuses the search input from anywhere.
- `b` navigates to bookmarks page.
- `f` opens filter panel.
- `s` opens settings modal.
- `r` triggers Surprise Me random selection.
- `h` goes home and clears all filters.
- `Escape` closes any open modal.
- Arrow keys navigate to previous/next anime when detail modal is open.

## Theme management flow
- Settings modal includes theme selector with Dark, Light, and Auto options.
- `ThemeManager.applyTheme()` switches theme immediately.
- Auto mode respects OS `prefers-color-scheme` preference.
- Theme preference stored in `rekonime.theme` localStorage.

## Service Worker / PWA flow
- `ServiceWorkerManager.register()` registers `sw.js` on page load.
- First visit: static assets cached for offline use.
- Update available: banner prompts user to refresh for latest version.
- Offline mode: offline indicator appears, cached data continues to work.
- Data JSON uses "Cache First with Background Update" strategy.

## Exit and re-entry
- Closing the modal restores list view and URL state.
- Back/forward navigation syncs with modal open and close.
- Sharing links preserves filters and deep links to anime details.
- Onboarding can be restarted from help menu even after completion.
