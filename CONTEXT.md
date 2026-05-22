# Rekonime Context

This context records Rekonime product language that should stay stable across runtime modules, tests, and architecture reviews.

## Language

**Watchlist Lifecycle**:
The persisted journey of an anime entry from saved intent through watching progress, completion, removal, and legacy bookmark migration. A watchlist lifecycle has many watchlist entries and one storage format.
_Avoid_: bookmark logic, saved item helper, watch status utility

**Watchlist Entry**:
A single saved anime record with an id, status, progress, timestamps, and optional snapshot used when catalog data is not loaded.
_Avoid_: bookmark, saved card, list item

**Snapshot**:
A compact copy of anime display metadata stored inside a watchlist entry so the entry can still render before the full catalog is available.
_Avoid_: cache copy, embedded anime, fallback card data

**Catalog Runtime**:
The runtime path that loads preview catalog data, upgrades to the full catalog, falls back to cached or embedded data, and fetches detail chunks on demand.
_Avoid_: data helper, fetch wrapper, loader utility

**Catalog Payload**:
A validated anime data package loaded from preview, full, cached, embedded, or detail-chunk sources before page rendering decisions are applied.
_Avoid_: JSON blob, response data, raw catalog

**Detail Experience**:
The lifecycle of opening, refreshing, deep-linking, enriching, and closing an anime detail view, including review refresh and trailer section replacement.
_Avoid_: modal helper, details popup, anime page glue

**Runtime Capabilities**:
Browser-level capabilities shared by product flows, including idle scheduling, modal visibility, focus trapping, and page scroll locking.
_Avoid_: browser utilities, app helpers, UI plumbing

## Example Dialogue

Dev: "When progress changes from 0 to 2, should that be handled by the page?"
Domain expert: "No. That is a Watchlist Lifecycle transition. The page only asks to update a Watchlist Entry."

Dev: "What renders if the full catalog has not loaded?"
Domain expert: "Use the Snapshot on the Watchlist Entry until catalog data replaces it."

Dev: "Should the page decide whether to use IndexedDB or embedded data?"
Domain expert: "No. The Catalog Runtime chooses the Catalog Payload source; the page applies the result."

Dev: "Does the URL `anime` parameter belong to filtering or the detail modal?"
Domain expert: "It belongs to the Detail Experience. Filters describe the browse view; the Detail Experience owns whether a title is open."

Dev: "Should each page flow decide how modals lock scrolling?"
Domain expert: "No. That belongs to Runtime Capabilities. Page flows only ask for a modal to open or close."
