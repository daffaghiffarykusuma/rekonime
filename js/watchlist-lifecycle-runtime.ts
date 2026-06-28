// @ts-nocheck
import {
  buildWatchlistTransitionEnvelope,
  normalizeWatchId
} from './watchlist-state.js';

const createWatchlistLifecycleRuntime = ({
  buildSnapshot,
  dashboardTimeout = 500,
  getAnime,
  getEpisodeLimit,
  getLifecycle,
  isLastRecommendation = () => false,
  loadBeforeTransition = false,
  renderMode = 'controls',
  normalizeId = normalizeWatchId
}) => {
  const getReadyLifecycle = () => {
    const lifecycle = getLifecycle();
    if (loadBeforeTransition) lifecycle.load();
    return lifecycle;
  };

  const resolveAnimeContext = (lifecycle, animeId, { episodeCount } = {}) => {
    const key = normalizeId(animeId);
    if (!key) return null;
    const anime = getAnime(key);
    const resolvedEpisodeCount = Number.isFinite(episodeCount) && episodeCount > 0
      ? episodeCount
      : getEpisodeLimit(key);
    return {
      key,
      anime,
      episodeCount: resolvedEpisodeCount,
      snapshot: buildSnapshot(anime) || lifecycle.getEntry(key)?.snapshot || null
    };
  };

  const buildChangedResult = (result, effectOptions = {}) => {
    if (!result?.changed) {
      return {
        changed: false,
        compatibilityResult: result,
        effects: {},
        transition: null
      };
    }

    const transition = buildWatchlistTransitionEnvelope(result, {
      ...(renderMode ? { renderMode } : {}),
      dashboardTimeout
    });

    return {
      changed: true,
      compatibilityResult: transition.compatibilityResult,
      effects: {
        clearViewingIntent: Boolean(effectOptions.clearViewingIntent),
        refreshTasteProfile: Boolean(effectOptions.refreshTasteProfile),
        renderRecommendations: Boolean(effectOptions.renderRecommendations)
      },
      transition
    };
  };

  const setStatus = (animeId, status, options = {}) => {
    const lifecycle = getReadyLifecycle();
    const context = resolveAnimeContext(lifecycle, animeId, options);
    if (!context) return null;
    const result = lifecycle.setStatus(context.key, status, {
      episodeCount: context.episodeCount,
      snapshot: context.snapshot
    });
    return buildChangedResult(result, {
      clearViewingIntent: status === 'watching' && isLastRecommendation(context.key),
      refreshTasteProfile: true,
      renderRecommendations: true
    });
  };

  const setProgress = (animeId, progress, options = {}) => {
    const lifecycle = getReadyLifecycle();
    const context = resolveAnimeContext(lifecycle, animeId, options);
    if (!context) return null;
    const result = lifecycle.setProgress(context.key, progress, {
      episodeCount: context.episodeCount,
      snapshot: context.snapshot
    });
    return buildChangedResult(result, { refreshTasteProfile: true });
  };

  const setLoved = (animeId, loved) => {
    const lifecycle = getReadyLifecycle();
    const context = resolveAnimeContext(lifecycle, animeId);
    if (!context) return null;
    const result = lifecycle.setLoved(context.key, loved, {
      snapshot: context.snapshot
    });
    return buildChangedResult(result, {
      refreshTasteProfile: true,
      renderRecommendations: true
    });
  };

  const adjustProgress = (animeId, delta, options = {}) => {
    const lifecycle = getReadyLifecycle();
    const context = resolveAnimeContext(lifecycle, animeId, options);
    if (!context) return null;
    const result = lifecycle.adjustProgress(context.key, delta, {
      episodeCount: context.episodeCount,
      snapshot: context.snapshot
    });
    return buildChangedResult(result, { refreshTasteProfile: true });
  };

  return {
    adjustProgress,
    setLoved,
    setProgress,
    setStatus
  };
};

export { createWatchlistLifecycleRuntime };
