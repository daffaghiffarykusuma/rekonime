import { prepareDiscoveryCandidates } from './recommendation-eligibility.ts';
import { createDiscoverySession } from './discovery-session.ts';

/**
 * Discovery Shortlist: the "few picks, act on one" decision on the home page.
 *
 * Owns the decision context (how many picks are shown, the chosen-title receipt, and the
 * Session Dismissals), assembles candidates the same way for the shortlist and Surprise Me,
 * and runs the shortlist actions. Each action returns an outcome the page renders:
 *   { changed, announcement, focus, error? }
 * where `focus` names what should receive focus next (never a DOM node):
 *   { target: 'chosen-undo' }            the chosen title's Undo
 *   { target: 'save', id }               a pick's "Want to watch" button
 *   { target: 'pick', index }            the title of the pick at `index`
 *   { target: 'latest-dismissal-undo' }  the most recent skip's Undo
 *   { target: 'dismissal-review' }       the skipped-titles summary
 *   { target: 'taste', id }              a pick's Taste preferences summary
 * A page falls back to the first pick, then the shortlist heading, when a target is gone.
 *
 * Lasting preference changes go to the Taste Profile and Watchlist changes go to the
 * Watchlist Lifecycle Runtime, whose host redraws the shortlist.
 */

type Anime = { id: string | number; title?: string; [key: string]: any };
type FocusIntent = { target: string; id?: string; index?: number } | null;
type Outcome = { changed: boolean; announcement: string; focus: FocusIntent; error?: string; [key: string]: any };

const PAGE_SIZE = 3;

const createDiscoveryShortlist = ({
  session = createDiscoverySession(),
  findAnime,
  getTasteProfile,
  getWatchlistEntries,
  getWatchlistRuntime,
  getEpisodeCount = () => null,
  recommendations,
  discovery,
  pageSize = PAGE_SIZE
}: {
  session?: ReturnType<typeof createDiscoverySession>;
  findAnime: (id: string) => Anime | null;
  getTasteProfile: () => any;
  getWatchlistEntries: () => any[];
  getWatchlistRuntime: () => any;
  getEpisodeCount?: (anime: Anime) => number | null;
  recommendations: any;
  discovery: any;
  pageSize?: number;
}) => {
  let displayLimit = pageSize;
  let chosen: { id: string; title: string; undoToken: object } | null = null;
  let shownCount = 0;

  // One exclusion rule: saved Watchlist titles and this session's skips never reappear.
  const getExcludedIds = () => [
    ...getWatchlistEntries().map(entry => String(entry.id)),
    ...session.getDismissed().map(item => item.id)
  ];

  const getChosen = () => {
    if (!chosen) return null;
    const entry = getWatchlistEntries().find(item => String(item.id) === chosen!.id);
    return entry ? { id: chosen.id, title: chosen.title, status: entry.status } : null;
  };

  const getModel = (browseList: Anime[] = []) => {
    const source = getTasteProfile().prepareRecommendationSource(browseList, { excludedIds: getExcludedIds() });
    const decision = recommendations.getRecommendationDecision(source, {
      limit: displayLimit,
      watchlistEntries: getWatchlistEntries()
    });
    shownCount = decision.items.length;
    return {
      items: decision.items,
      hasMore: decision.hasMore,
      context: decision.context,
      heading: decision.items.some((anime: Anime) => anime.tasteReason) ? 'Picks for your taste' : 'Explore something new',
      chosen: getChosen(),
      dismissed: session.getDismissed()
    };
  };

  const pickSurprise = (catalog: Anime[] = []) => {
    const source = getTasteProfile().prepareDiscoverySource(catalog, { excludedIds: getExcludedIds() });
    const eligible = new Set(prepareDiscoveryCandidates(source.map((entry: any) => entry.anime), getWatchlistEntries())
      .map((anime: Anime) => anime.id));
    const surprise = discovery.getSurpriseMe(source.filter((entry: any) => eligible.has(entry.anime.id)));
    if (!surprise) return null;
    discovery.recordSurprise(surprise.id);
    return surprise;
  };

  const showMore = (): Outcome => {
    displayLimit += pageSize;
    return { changed: true, announcement: 'More picks shown.', focus: { target: 'pick', index: shownCount } };
  };

  const save = (animeId: string): Outcome => {
    const anime = findAnime(String(animeId));
    if (!anime) return { changed: false, announcement: '', focus: null };
    const result = getWatchlistRuntime().selectForLater(anime.id, { episodeCount: getEpisodeCount(anime) });
    if (!result?.changed) return { changed: false, announcement: '', focus: null };
    chosen = { id: String(anime.id), title: anime.title || 'Title', undoToken: result.undoToken };
    return {
      changed: true,
      announcement: `Saved ${anime.title} to Want to watch. You can undo this selection or view your Watchlist.`,
      focus: { target: 'chosen-undo' }
    };
  };

  const undoSave = (): Outcome => {
    const selection = chosen;
    if (!selection) return { changed: false, announcement: '', focus: null };
    const result = getWatchlistRuntime().undoSelection(selection.undoToken);
    if (result?.changed) {
      chosen = null;
      return {
        changed: true,
        announcement: `Undid saving ${selection.title}. Your other Watchlist entries are unchanged.`,
        focus: { target: 'save', id: selection.id }
      };
    }
    if (result?.compatibilityResult?.reason === 'stale-selection') {
      return {
        changed: false,
        announcement: `Couldn't undo saving ${selection.title} because its Watchlist entry changed. Your newer changes are preserved.`,
        error: "Couldn't undo this selection because its Watchlist entry changed. Your newer changes are preserved.",
        focus: null
      };
    }
    return { changed: false, announcement: '', focus: null };
  };

  const titleFor = (animeId: string) => findAnime(String(animeId))?.title
    || session.getDismissed().find(item => item.id === String(animeId))?.title
    || 'Title';

  const SESSION_FAILURE = 'Could not update this session. It may have expired or browser storage may be unavailable. Try again.';

  const skip = (animeId: string): Outcome => {
    const title = titleFor(animeId);
    const { changed } = session.dismiss({ id: animeId, title });
    return changed
      ? { changed, announcement: `Skipped for now: ${title}. Your taste and Watchlist are unchanged.`, focus: { target: 'latest-dismissal-undo' } }
      : { changed, announcement: SESSION_FAILURE, focus: { target: 'dismissal-review' } };
  };

  const restore = (animeId: string): Outcome => {
    const title = titleFor(animeId);
    const { changed } = session.restore(animeId);
    return {
      changed,
      announcement: changed ? `Restored: ${title}. This title can appear in recommendations again.` : SESSION_FAILURE,
      focus: { target: 'dismissal-review' }
    };
  };

  // Lasting feedback. "Already seen" is a Watchlist change; the rest change the Taste Profile
  // and return an undo token for the page's Undo control.
  const giveFeedback = (action: string, animeId: string, { genre = '', theme = '' } = {}): Outcome => {
    const anime = findAnime(String(animeId));
    if (!anime) return { changed: false, announcement: '', focus: null };
    if (action === 'rec-already-seen') {
      const result = getWatchlistRuntime().setStatus(anime.id, 'completed', { episodeCount: getEpisodeCount(anime) });
      return { changed: Boolean(result?.changed), announcement: '', focus: null };
    }
    const result = getTasteProfile().applyRecommendationFeedback(action, anime, { genre, theme });
    if (!result.changed) return { changed: false, announcement: '', error: result.message, focus: null };
    return { changed: true, announcement: result.message, focus: null, undoToken: result.undoToken };
  };

  const undoFeedback = (undoToken: object, animeId: string): Outcome => {
    const result = getTasteProfile().undoRecommendationFeedback(undoToken);
    return result.changed
      ? { changed: true, announcement: result.message, focus: { target: 'taste', id: String(animeId) } }
      : { changed: false, announcement: '', error: result.message, focus: null };
  };

  return {
    getModel,
    pickSurprise,
    recordActivity: () => session.recordActivity(),
    showMore,
    save,
    undoSave,
    skip,
    restore,
    giveFeedback,
    undoFeedback
  };
};

export { createDiscoveryShortlist };
