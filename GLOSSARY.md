# Rekonime Context

This context records Rekonime product language that should stay stable across runtime modules, tests, and architecture reviews.

## Language

**Watchlist Lifecycle**:
The persisted journey of an anime entry from saved intent through watching progress, completion, removal, and legacy bookmark migration. A watchlist lifecycle has many watchlist entries and one storage format.
_Avoid_: bookmark logic, saved item helper, watch status utility

**Watchlist Entry**:
A single saved anime record with an id, status, progress, timestamps, and optional snapshot used when catalog data is not loaded.
_Avoid_: bookmark, saved card, list item

**Taste Profile**:
The user's editable, cross-title recommendation preferences and exclusions, derived from explicit feedback and supported by Watchlist Lifecycle evidence. Title-specific status, progress, and affinity remain on the Watchlist Entry.
_Avoid_: recommendation settings, preference cache, personalization blob

**Personal Data Restore**:
The user-initiated replacement of saved Taste Profile data and, for a complete compatible export, Watchlist Lifecycle data. A complete restore changes both together or changes neither; a legacy profile-only restore leaves the Watchlist Lifecycle unchanged. Invalid Watchlist Entries and unsupported export versions change nothing.
_Avoid_: JSON merge, import helper, settings upload

**Viewing Intent**:
The user's temporary viewing outcome for the current discovery session, including its definition, four-hour activity window, apply transition, and clear transition. A Viewing Intent guides recommendations without changing Browse View Filtering or the longer-lived Taste Profile.
_Avoid_: mood filter, recommendation mode, session flag

**Discovery**:
The catalog exploration behavior that powers Surprise Me, seasonal choices, trending titles, and weekly popularity. Discovery consumes Taste Profile-prepared candidates for personalized selection; it does not interpret Watchlist Lifecycle evidence itself.
_Avoid_: discovery helper, random picker utility, watchlist preference logic

**Experience Cue**:
A concise, curated label that sets expectations about a title's viewing experience or explains its fit for a viewing outcome. Experience Cues are derived through documented rules rather than displayed directly from raw catalog tags.
_Avoid_: badge, raw theme, recommendation tag

**Snapshot**:
A compact copy of anime display metadata stored inside a watchlist entry so the entry can still render before the full catalog is available.
_Avoid_: cache copy, embedded anime, fallback card data

**Catalog Runtime**:
The runtime path that loads preview catalog data, upgrades to the full catalog, falls back to cached or embedded data, and fetches detail chunks on demand.
_Avoid_: data helper, fetch wrapper, loader utility

**Browse View Filtering**:
The catalog browsing state that turns URL parameters, search text, selected facets, available facet options, active-filter summaries, and Catalog Payload entries into the filtered anime list shown on the browse view.
_Avoid_: filter helper, query utility, chip state

**Catalog Payload**:
A validated anime data package, including supported Experience Cues, loaded from preview, full, cached, embedded, or detail-chunk sources before page rendering decisions are applied.
_Avoid_: JSON blob, response data, raw catalog

**Airing Schedule**:
Live episode release metadata for watchlist entries, including AniList fetch/cache behavior, stale fallback, countdown labels, and local-time formatting.
_Avoid_: airing widget helper, countdown utility, schedule glue

**Detail Experience**:
The lifecycle of opening, refreshing, deep-linking, enriching, and closing an anime detail view, including review refresh and trailer rendering, playback, and cleanup.
_Avoid_: modal helper, details popup, anime page glue

**Runtime Capabilities**:
Browser-level capabilities shared by product flows, including idle scheduling, modal visibility, focus trapping, and page scroll locking.
_Avoid_: browser utilities, app helpers, UI plumbing

**Onboarding Journey**:
The one-step welcome that lets a first-time user choose an initial Viewing Intent or skip into Discovery. The first-paint gate decides whether to reveal the static shell before App Shell boot; the runtime module adopts that same shell and owns intent selection, completion, skip, and reopen behavior.
_Avoid_: onboarding wizard, tour step system, scoring tutorial

## Example Dialogue

Dev: "When progress changes from 0 to 2, should that be handled by the page?"
Domain expert: "No. That is a Watchlist Lifecycle transition. The page only asks to update a Watchlist Entry."

Dev: "Should 'less Romance' be stored on the anime the user dismissed?"
Domain expert: "No. Romance is a cross-title preference in the Taste Profile. The Watchlist Entry only owns the user's relationship with that title."

Dev: "Should choosing 'Help me unwind' change the active filters or the Taste Profile?"
Domain expert: "No. That is a temporary Viewing Intent. It guides the current recommendation session without changing Browse View Filtering or the Taste Profile."

Dev: "Should Surprise Me infer preferred genres directly from the watchlist?"
Domain expert: "No. Taste Profile interprets Watchlist Lifecycle evidence. Discovery only applies quality rules and selects from the prepared candidates."

Dev: "Can we show Psychological directly as an explanation?"
Domain expert: "Not by default. Recommendation cards use Experience Cues with documented meaning; raw catalog tags remain available in details and advanced filters."

Dev: "What renders if the full catalog has not loaded?"
Domain expert: "Use the Snapshot on the Watchlist Entry until catalog data replaces it."

Dev: "Should the page decide whether to use IndexedDB or embedded data?"
Domain expert: "No. The Catalog Runtime chooses the Catalog Payload source; the page applies the result."

Dev: "Should filter chips, query parameters, and search matching each decide the visible catalog separately?"
Domain expert: "No. Browse View Filtering owns the selected facets, search text, URL parameters, and filtered anime list. The page only renders the current state."

Dev: "Does the URL `anime` parameter belong to filtering or the detail modal?"
Domain expert: "It belongs to the Detail Experience. Filters describe the browse view; the Detail Experience owns whether a title is open."

Dev: "Should each page flow decide how modals lock scrolling?"
Domain expert: "No. That belongs to Runtime Capabilities. Page flows only ask for a modal to open or close."

Dev: "Should the dashboard renderer decide when AniList schedule cache is stale?"
Domain expert: "No. That belongs to the Airing Schedule. The dashboard consumes a model."
