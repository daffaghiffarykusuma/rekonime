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
2. Preview data loads and the grid renders.
3. Full catalog loads and the grid updates.
4. User discovers anime via scroll, search, filters, or sort.
5. User opens detail modal to evaluate a title.
6. User bookmarks or returns to browsing.
7. URL state updates for sharing and navigation.
8. Session ends with bookmarks and cached synopsis preserved.

## Step-by-step: first-time visitor (catalog)
- Landing + loading: `App.init()` shows a loading state and reads bookmarks.
- Initial content: `data/anime.preview.json` renders cards and filter options.
- Discover: user scrolls, sorts, opens filters, or uses header search.
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
- Deep links restore filter state or open an anime modal.
- Cached synopsis/reviews reduce repeat fetches for 30 days.

## Trailer autoplay behavior
- Trailer section initializes with sanitized URLs.
- Autoplay uses `IntersectionObserver` with a scroll fallback.
- Settings allow disabling autoplay and hiding embeds (data saver).

## Error states and fallbacks
- If `file://` or fetch fails, app uses embedded `ANIME_DATA`.
- Preview data loads first; full data swaps in when available.
- Image fallbacks use `data-fallback-src`.
- Review failures fall back to local synopsis when needed.

## Exit and re-entry
- Closing the modal restores list view and URL state.
- Back/forward navigation syncs with modal open and close.
- Sharing links preserves filters and deep links to anime details.
