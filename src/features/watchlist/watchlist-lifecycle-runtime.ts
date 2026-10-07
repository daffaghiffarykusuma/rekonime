// @ts-nocheck
import {
  buildWatchlistTransitionEnvelope,
  normalizeWatchId
} from './watchlist-state.js';
import { fingerprintWatchlist, validateMalImportPlan } from './mal-import-plan.ts';

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
  const selections = new WeakMap();

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
    if (!validateMalImportPlan(plan)) {
      return { changed: false, compatibilityResult: { status: 'rejected', reason: 'invalid-plan' }, effects: {}, transition: null };
    }
    const lifecycle = getReadyLifecycle();
    // Imports review persisted evidence; another tab may have changed it since review.
    if (!loadBeforeTransition) lifecycle.load();
    if (fingerprintWatchlist(lifecycle.getEntries()) !== plan.fingerprint) {
      return { changed: false, compatibilityResult: { status: 'rejected', reason: 'stale-plan' }, effects: {}, transition: null };
    }
    if (plan.proposedEntries.length === 0) {
      return { changed: false, compatibilityResult: { status: 'no-changes', summary: plan.summary }, effects: {}, transition: null };
    }

    const appliedAt = now();
    const nextEntries = new Map(lifecycle.getEntries().map((entry) => [entry.id, entry]));
    const changedIds = [];
    for (const proposed of plan.proposedEntries) {
      const id = normalizeId(proposed?.id);
      const conflict = plan.conflicts.find(item => item.id === id && item.useMal);
      if (!id || (nextEntries.has(id) && !conflict) || (!nextEntries.has(id) && conflict)) {
        return { changed: false, compatibilityResult: { status: 'rejected', reason: 'invalid-plan' }, effects: {}, transition: null };
      }
      const resolveTime = (value) => value === 'apply-time' ? appliedAt : value;
      const previous = nextEntries.get(id);
      nextEntries.set(id, {
        ...proposed,
        id,
        updatedAt: resolveTime(proposed.updatedAt),
        ...(proposed.startedAt ? { startedAt: resolveTime(proposed.startedAt) } : {}),
        ...(proposed.completedAt ? { completedAt: resolveTime(proposed.completedAt) } : {})
      });
      if (previous && (proposed.loved !== previous.loved || proposed.lovedAt !== previous.lovedAt
        || (previous.startedAt && proposed.startedAt !== previous.startedAt)
        || (previous.completedAt && proposed.completedAt !== previous.completedAt))) {
        return { changed: false, compatibilityResult: { status: 'rejected', reason: 'invalid-plan' }, effects: {}, transition: null };
      }
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

  const selectForLater = (animeId, options = {}) => {
    const lifecycle = getReadyLifecycle();
    lifecycle.load();
    const previousEntry = lifecycle.getEntry(animeId);
    const result = setStatus(animeId, 'planned', options);
    if (!result?.changed) return result;
    const undoToken = {};
    selections.set(undoToken, {
      id: normalizeId(animeId),
      previousEntry: previousEntry ? structuredClone(previousEntry) : null,
      savedEntry: structuredClone(result.transition.entry)
    });
    return { ...result, undoToken };
  };

  const undoSelection = (undoToken) => {
    const receipt = selections.get(undoToken);
    const reject = (reason) => buildChangedResult({ changed: false, id: receipt?.id, reason });
    if (!receipt) return reject('stale-selection');
    const lifecycle = getReadyLifecycle();
    lifecycle.load();
    const current = lifecycle.getEntry(receipt.id);
    // Catalog enrichment can refresh the Snapshot without changing the user's selection.
    const selectionState = (entry) => {
      if (!entry) return null;
      const { snapshot, ...state } = entry;
      return state;
    };
    if (JSON.stringify(selectionState(current)) !== JSON.stringify(selectionState(receipt.savedEntry))) return reject('stale-selection');
    const candidate = new Map(lifecycle.getEntries().map(entry => [entry.id, entry]));
    if (receipt.previousEntry) candidate.set(receipt.id, { ...receipt.previousEntry, snapshot: current.snapshot });
    else candidate.delete(receipt.id);
    if (!lifecycle.commitEntries(candidate)) return reject('storage-failed');
    selections.delete(undoToken);
    const result = buildChangedResult({
      changed: true, id: receipt.id, entry: lifecycle.getEntry(receipt.id),
      removed: !receipt.previousEntry, previousEntry: current, operation: 'selection-undo'
    }, { refreshTasteProfile: true, renderRecommendations: true });
    result.transition.feedback = { message: 'Undid Watchlist selection' };
    return result;
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
    selectForLater,
    undoSelection,
    adjustProgress,
    applyImport,
    setLoved,
    setProgress,
    setStatus
  };
};

export { createWatchlistLifecycleRuntime };
