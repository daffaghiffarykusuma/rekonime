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
  now = Date.now,
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
      ...(effectOptions.renderMode || renderMode ? { renderMode: effectOptions.renderMode || renderMode } : {}),
      dashboardTimeout
    });

    const effects = {
      clearViewingIntent: Boolean(effectOptions.clearViewingIntent),
      refreshTasteProfile: Boolean(effectOptions.refreshTasteProfile),
      renderRecommendations: Boolean(effectOptions.renderRecommendations)
    };
    if (effectOptions.updateTasteProfileUi !== undefined) {
      effects.updateTasteProfileUi = Boolean(effectOptions.updateTasteProfileUi);
    }
    return {
      changed: true,
      compatibilityResult: transition.compatibilityResult,
      effects,
      transition
    };
  };

  const applyImport = (plan) => {
    if (!plan?.ok || plan.catalogScope !== 'full' || !Array.isArray(plan.proposedEntries)) {
      return { changed: false, compatibilityResult: { status: 'rejected', reason: 'invalid-plan' }, effects: {}, transition: null };
    }
    if (plan.proposedEntries.length === 0) {
      return { changed: false, compatibilityResult: { status: 'no-changes', summary: plan.summary }, effects: {}, transition: null };
    }

    const lifecycle = getReadyLifecycle();
    const appliedAt = now();
    const nextEntries = new Map(lifecycle.getEntries().map((entry) => [entry.id, entry]));
    const changedIds = [];
    for (const proposed of plan.proposedEntries) {
      const id = normalizeId(proposed?.id);
      if (!id || nextEntries.has(id)) {
        return { changed: false, compatibilityResult: { status: 'rejected', reason: 'invalid-plan' }, effects: {}, transition: null };
      }
      const resolveTime = (value) => value === 'apply-time' ? appliedAt : value;
      nextEntries.set(id, {
        ...proposed,
        id,
        updatedAt: resolveTime(proposed.updatedAt),
        ...(proposed.startedAt ? { startedAt: resolveTime(proposed.startedAt) } : {}),
        ...(proposed.completedAt ? { completedAt: resolveTime(proposed.completedAt) } : {})
      });
      changedIds.push(id);
    }
    if (!lifecycle.commitEntries(nextEntries)) {
      return { changed: false, compatibilityResult: { status: 'rejected', reason: 'storage-failed' }, effects: {}, transition: null };
    }

    const entries = lifecycle.getEntries();
    return buildChangedResult({
      changed: true,
      id: changedIds[0] || '',
      entry: lifecycle.getEntry(changedIds[0]),
      operation: 'import',
      previousEntry: null,
      statusChanged: true,
      progressChanged: entries.some((entry) => changedIds.includes(entry.id) && entry.progress > 0),
      changedIds,
      summary: plan.summary,
      entries
    }, {
      refreshTasteProfile: true,
      renderRecommendations: true,
      renderMode: 'watchlist',
      updateTasteProfileUi: true
    });
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
    applyImport,
    setLoved,
    setProgress,
    setStatus
  };
};

export { createWatchlistLifecycleRuntime };
