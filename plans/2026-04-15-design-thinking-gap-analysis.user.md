# Rekonime User Report: Design Thinking Gap Analysis

Date: April 15, 2026

## Purpose

This report identifies where Rekonime is currently strong, where it falls short in users' best interest, and which feature opportunities are worth pursuing without requiring login, accounts, or a heavier database footprint.

The goal is not to copy MyAnimeList, AniList, or SeriesGraph feature-for-feature. The goal is to sharpen Rekonime into a faster, more privacy-friendly anime decision tool that helps users:

- find something worth watching faster,
- avoid wasting time on the wrong show,
- keep lightweight personal progress locally,
- stay oriented across seasons, sequels, and airing schedules,
- and keep ownership of their data without signup friction.

## Method

This analysis combines:

- a local audit of Rekonime's current product surface,
- competitor review across SeriesGraph, MyAnimeList, AniList, LiveChart, and Anime-Planet-adjacent patterns,
- public user-signal review from recent community discussions and product updates,
- a hard product constraint: no account required for core value.

## Current Rekonime Strengths

Rekonime already does several things that are genuinely in users' best interest:

- It is fast and local-first. Preview-first loading, offline support, and browser-stored watchlist data reduce friction.
- It helps users judge quality beyond a single aggregate score. The episode-shape and retention framing is more decision-useful than generic ratings alone.
- It avoids unnecessary sign-in complexity. This is a real product advantage, not a missing enterprise feature.
- It already supports practical discovery patterns: search, filters, seasonal chips, trending, surprise picks, similar anime, and watch-status tracking.
- It is more privacy-friendly than account-centric competitors by default.

In short: Rekonime already has a strong foundation for "pick smarter, faster, without joining another platform."

## Core User Jobs

Based on the current app and outside market signals, the most important user jobs are:

1. Help me decide what to start quickly.
2. Help me know whether a show stays good, falls off, or is worth finishing.
3. Help me keep up with what I am currently watching.
4. Help me avoid shows that are a bad fit for my mood, limits, or tastes.
5. Help me understand sequels, seasons, and viewing order without confusion.
6. Help me keep my list and preferences without forcing account creation.

Rekonime is strongest on jobs 1 and 2.

It is weaker on jobs 3, 4, 5, and 6.

## Main Gaps

### 1. Rekonime helps users choose a show, but not strongly enough to help them continue watching it

Competitor pattern: users increasingly expect airing schedules, countdowns, and "what is next" awareness. LiveChart centers release schedules and countdown behavior, including a no-account baseline for best-match schedules. Recent anime-tracker user feedback also highlights next-episode countdowns and release reminders as a headline feature, not a niche extra.

Current Rekonime gap:

- The app helps users discover and evaluate titles.
- It does not strongly support the follow-through moment: "When is my next episode?" or "What should I watch tonight from the things I already follow?"
- The current watchlist is status-based, but not schedule-aware.

Why this matters in users' best interest:

- Users do not just want better picks. They want less cognitive overhead after the pick.
- A tracker that cannot tell users what is newly available still forces them to leave the product.

### 2. Rekonime lacks strong franchise orientation

User signal: recent public feedback on anime discovery apps explicitly calls out season grouping as a heavily requested improvement. This is consistent with a long-standing anime-specific pain point: users do not think in isolated entries when franchises have many seasons, OVAs, prequels, and side stories.

Current Rekonime gap:

- Titles are mostly treated as individual entries.
- Users can open details and see similar anime, but there is no strong "franchise hub" or "watch order / related order" mental model.
- The app does not visibly reduce sequel confusion.

Why this matters in users' best interest:

- Users waste time figuring out where to start.
- Franchise confusion causes avoidable drop-off and bad first impressions.

### 3. Rekonime's personalization is positive-only and not expressive enough

Competitor and user pattern: anime users want richer filters, more tags, and better ways to narrow by mood, pacing, and fit. Public app updates and AniList ecosystem tools repeatedly emphasize advanced filters, custom list controls, and stronger discovery constraints.

Current Rekonime gap:

- Users can include genres, themes, studios, sources, demographics, and seasonal filters.
- Users have weak support for negative preference signals and real-life browsing constraints.
- Common missing controls include "not in the mood for tragedy," "hide ecchi," "exclude long commitments," "don't show me franchises I dropped," "finished shows only," "low-stress comfort anime," and "12-episode weekend pick."

Why this matters in users' best interest:

- The cost of a bad recommendation is wasted time.
- Negative filters often matter more than positive ones when a user is tired, overloaded, or browsing casually.

### 4. Rekonime explains quality well, but could explain fit and timing much better

SeriesGraph's appeal is not just charts. It is the promise of immediate clarity: where a show peaks, dips, and whether it is worth your time. Rekonime already overlaps with that value, but it still leaves several user questions under-served:

- Why is this recommended for me right now?
- Is this a good weeknight show or a weekend binge?
- Is this a comfort pick, a slow-burn, or emotionally draining?
- Is this good for newcomers to the franchise?
- How much commitment am I signing up for?

Current Rekonime gap:

- Recommendation logic exists and some explanations exist.
- The decision layer is still too system-centric and not enough life-centric.

Why this matters in users' best interest:

- Users do not choose media in abstract. They choose for a context: available time, mood, energy, tolerance, and intent.

### 5. Rekonime is local-first, but portability and trust are still underdeveloped

No-login can be a product advantage only if users trust that their data is theirs.

Current Rekonime gap:

- Watchlist data is local, but there is no obvious export/import, backup, migration, or portable handoff workflow.
- If a user changes browser, clears storage, or uses multiple devices, confidence drops fast.

Why this matters in users' best interest:

- Users often accept no-account products only when they still feel safe from loss and lock-in.
- Local-first without backup can feel fragile.

### 6. Rekonime still depends on users leaving the app for key decisions

Competitor pattern:

- MyAnimeList pushes seasonal anime, recommendations, reviews, trending signals, friends' scores, and announcements.
- LiveChart helps with release timing and streams.
- Many modern trackers emphasize "airing today," "episodes behind," and "where to watch."

Current Rekonime gap:

- A user can discover a title in Rekonime, then still needs another destination to answer key follow-up questions.
- Those questions usually include where to watch it, when the next episode drops, how it relates to the rest of the franchise, and whether this is the right starting point.

Why this matters in users' best interest:

- Every forced context switch increases dropout and weakens product trust.

## What Users Seem to Want From Similar Services

Across competitor products and public feedback, the repeated needs are:

- clean discovery with strong filtering,
- airing schedules and next-episode countdowns,
- fast progress updates,
- clearer franchise grouping,
- explainable recommendations,
- where-to-watch guidance,
- stronger control over tags and preferences,
- local or privacy-friendly ownership when possible,
- and lower clutter.

There is also an important product lesson here:

Users do not necessarily want more "community." They often want more clarity.

That distinction matters for Rekonime. Chasing social features would increase complexity without clearly serving the product's strongest differentiator.

## Features That Fit Rekonime Best

These are the highest-value opportunities that respect your no-login preference.

### Priority 1: Franchise Hub + Watch Order

Add a related-series layer that groups seasons, sequels, prequels, movies, and side stories into one franchise view.

User value:

- reduces sequel confusion,
- helps users start in the right place,
- makes progress feel coherent across a franchise.

Why it fits Rekonime:

- high user value,
- anime-specific pain point,
- no account required,
- can be metadata-driven rather than database-heavy.

### Priority 2: Airing Dashboard + Next Episode Countdown

Create an "Airing from My Watchlist" view on the home page and watchlist page.

User value:

- tells users what is newly available,
- reduces the need to check other sites,
- makes the watchlist actionable rather than archival.

Good no-login version:

- browser-local watchlist,
- optional local notification permission,
- optional ICS calendar export,
- no cloud sync required.

### Priority 3: Where-to-Watch Surface

Show streaming availability or at minimum outbound links to verified watch destinations where data is available.

User value:

- closes the gap between discovery and action,
- reduces frustration after choosing a title.

Why it fits Rekonime:

- practical,
- high leverage,
- no account required.

### Priority 4: Stronger Mood and Constraint Filters

Add user-first filters that reflect real decision context, not just metadata taxonomy.

Recommended examples:

- episode count bands,
- finished vs airing,
- light vs intense,
- comfort vs stressful,
- slow-burn vs strong early hook,
- low drop-risk,
- weekend binge,
- newcomer-friendly franchise entry,
- hide dropped franchises,
- "not for me" hide control.

User value:

- fewer bad picks,
- faster decisions,
- more trust in recommendations.

### Priority 5: Better Recommendation Explanations

Upgrade the explanation layer from "similar because of tags/scores" to decision-ready guidance.

Recommended explanation labels:

- "Best if you want a strong first three episodes"
- "Good weeknight watch"
- "Safe comfort pick"
- "Worth it despite a slow start"
- "Best entry point for this franchise"
- "High payoff, but uneven middle stretch"

User value:

- turns Rekonime into a smarter advisor,
- reinforces the app's unique retention-based positioning.

### Priority 6: Local-First Portability

Add export/import for watchlist, preferences, hidden titles, and custom settings.

Recommended formats:

- JSON export/import,
- optional CSV export for watchlist,
- one-click local backup download,
- possibly shareable URL state for filters and public recommendation views.

User value:

- users trust local-first products more,
- supports device switching without building accounts.

## Features Worth Considering Later

These are useful, but not as urgent as the priorities above.

- compare mode for 2 to 4 titles side-by-side,
- local notes per anime,
- spoiler-safe content advisories,
- "continue tonight" queue based on progress and available time,
- "episodes behind" indicator for airing shows,
- personal wrapped/stats view generated entirely in-browser,
- browser notifications for new episodes,
- optional installed PWA widget surface where platform support allows it.

## Features I Would Avoid

These do not appear aligned with Rekonime's strongest position:

- public profiles,
- global comments,
- group chats,
- friend feeds,
- heavy social gamification,
- mandatory accounts for list persistence,
- backend-first sync before local portability is solved.

Reason:

These features add maintenance, moderation, privacy, and performance cost without clearly improving Rekonime's core promise: help users choose and follow anime intelligently with low friction.

## Recommended Product Position

The clearest product lane is:

**Rekonime helps anime fans decide what to watch and keep up with it, using retention-aware insights and private local tracking, without making them join another platform.**

That is a sharper and more defensible position than becoming a smaller MyAnimeList clone.

## Suggested Roadmap

### Now

- Franchise hub and watch-order guidance
- Airing dashboard for local watchlist
- Local export/import
- Better recommendation reasons

### Next

- Where-to-watch links
- Negative preference controls and hide actions
- Mood and commitment filters
- Episodes-behind indicator

### Later

- Local notes
- Compare mode
- Calendar export and local reminders
- In-browser personal recap stats

## Key Takeaway

Rekonime does not need more account features to be more useful.

It needs to become more actionable.

Today, Rekonime is already good at helping users judge quality. The biggest opportunities are to help users act on that judgment:

- start in the right place,
- know what to watch next,
- know when new episodes arrive,
- avoid bad-fit recommendations,
- and keep their personal state safely without signup.

If you focus on those gaps, Rekonime will feel more helpful than larger competitors for a specific type of user: someone who wants clarity, speed, and privacy over social overhead.

## Research Links

- Series Graph app listing: https://apps.apple.com/us/app/series-graph-app/id6755393713
- MyAnimeList official app listing: https://apps.apple.com/ie/app/myanimelist-official/id1469330778
- AniList positioning snapshot: https://anilist.co/
- LiveChart release schedule notes: https://www.livechart.me/pages/about-release-schedules
- LiveChart schedule view: https://www.livechart.me/schedule
- Anime-Planet feature request forum: https://www.anime-planet.com/forum/forums/feature-requests-bug-reports-site-questions.43/
- Public user signal on anime tracker expectations: https://www.reddit.com/r/animeapp/comments/1se4b8v/i_built_a_tinderstyle_app_but_for_anime/
- Public user signal on season grouping and richer filters: https://www.reddit.com/r/animexplore/comments/1rauncf/hey_everyone_just_pushed_a_new_update/
