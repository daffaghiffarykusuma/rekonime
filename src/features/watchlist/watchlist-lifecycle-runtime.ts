// @ts-nocheck
import {
  buildWatchlistTransitionEnvelope,
  normalizeWatchId
} from './watchlist-state.js';
import { fingerprintWatchlist, validateMalImportPlan } from './mal-import-plan.ts';
import { CatalogPayload } from '../catalog/catalog-payload.ts';

const positiveTotal = (value) => (Number.isSafeInteger(value) && value > 0 ? value : null);

// One episode-total rule for every Watchlist surface: the catalog total when the title is
// loaded, otherwise the total recorded on the entry's Snapshot.
const resolveEpisodeTotal = (anime, snapshot) => (
  positiveTotal(CatalogPayload.getEpisodeCount(anime)) || positiveTotal(CatalogPayload.getEpisodeCount(snapshot))
);

const STORAGE_FAILURE_MESSAGE = "Couldn't save your Watchlist change. Nothing changed. Try again; if it keeps failing, check browser storage.";

/**
 * Watchlist Lifecycle Runtime: the one place that turns a Watchlist command into a persisted
 * transition and applies its effects.
 *
 * `host` holds the ports a page provides; every port is optional, and a page leaves out what it
 * cannot do (the dedicated Watchlist page has no Discovery shortlist, for example):
 *   updateControls(id, entry)   redraw one title's Watchlist controls
 *   renderWatchlist()           redraw the Watchlist list
 *   renderContinueWatching()    redraw the promoted Watching entry
 *   emit(name, payload)         dispatch the Watchlist Lifecycle event
 *   scheduleDashboard(options)  schedule an Airing Schedule dashboard update
 *   announce(feedback)          confirm a change ({ message, action? })
 *   announceFailure(failure)    report a change that could not be saved ({ id, message })
 *   refreshTasteProfile()       recompute Taste Profile evidence from the Watchlist
 *   updateTasteProfileUi()      redraw Taste Profile settings
 *   renderRecommendations()     redraw the Discovery shortlist
 */
const createWatchlistLifecycleRuntime = ({
  buildSnapshot = () => null,
  dashboardTimeout = 500,
  getAnime = () => null,
  getEpisodeLimit = null,
  getLifecycle,
  host = null,
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
    const storedSnapshot = lifecycle.getEntry(key)?.snapshot || null;
    const resolvedEpisodeCount = Number.isFinite(episodeCount) && episodeCount > 0
      ? episodeCount
      : (getEpisodeLimit?.(key) || resolveEpisodeTotal(anime, storedSnapshot));
    return {
      key,
      anime,
      episodeCount: resolvedEpisodeCount,
      snapshot: buildSnapshot(anime) || storedSnapshot
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

  const applyEffects = (result) => {
    if (!host || !result) return result;
    if (!result.changed) {
      if (result.compatibilityResult?.reason === 'storage-failed') {
        const id = normalizeId(result.compatibilityResult.id);
        if (id) host.updateControls?.(id, getReadyLifecycle().getEntry(id));
        host.announceFailure?.({ id, message: STORAGE_FAILURE_MESSAGE });
      }
      return result;
    }
    const { transition, effects } = result;
    const isImport = transition.operation === 'import';
    if (transition.render?.controls?.shouldUpdate) {
      host.updateControls?.(transition.render.controls.id, transition.render.controls.entry);
    }
    if (transition.event) host.emit?.(transition.event.name, transition.event.payload);
    if (transition.dashboard?.shouldSchedule) {
      host.scheduleDashboard?.({ timeout: transition.dashboard.timeout, ...(isImport ? { cacheOnly: true } : {}) });
    }
    if (transition.feedback && !isImport) host.announce?.(transition.feedback);
    host.renderContinueWatching?.();
    if (transition.render?.watchlist?.shouldRender) host.renderWatchlist?.();
    if (effects?.refreshTasteProfile) host.refreshTasteProfile?.();
    if (effects?.updateTasteProfileUi) host.updateTasteProfileUi?.();
    if (effects?.renderRecommendations) host.renderRecommendations?.();
    return result;
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

  const toggleLoved = (animeId) => {
    const lifecycle = getReadyLifecycle();
    const key = normalizeId(animeId);
    if (!key) return null;
    return setLoved(key, !lifecycle.getEntry(key)?.loved);
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

  // Continue watching: count the next episode, or finish the title once progress reaches its total.
  const advanceProgress = (animeId, options = {}) => {
    const lifecycle = getReadyLifecycle();
    const context = resolveAnimeContext(lifecycle, animeId, options);
    if (!context) return null;
    const entry = lifecycle.getEntry(context.key);
    if (!entry) return null;
    if (context.episodeCount && entry.progress >= context.episodeCount) {
      return setStatus(context.key, 'completed', { episodeCount: context.episodeCount });
    }
    return adjustProgress(context.key, 1, { episodeCount: context.episodeCount });
  };

  // Read the persisted Watchlist for display: migrate legacy bookmarks and give every entry a
  // Snapshot so it can render before catalog data is available.
  const prepareEntries = ({ buildFallbackSnapshot = null } = {}) => {
    const lifecycle = getLifecycle();
    lifecycle.load();
    lifecycle.migrateLegacy?.();
    if (buildFallbackSnapshot) {
      const map = lifecycle.entries;
      let changed = false;
      map.forEach((entry, id) => {
        if (entry?.snapshot) return;
        const fallback = buildFallbackSnapshot(entry);
        if (!fallback?.id) return;
        map.set(id, { ...entry, snapshot: { ...fallback } });
        changed = true;
      });
      if (changed) lifecycle.save();
    }
    return lifecycle.getEntries();
  };

  const withEffects = (command) => (...args) => applyEffects(command(...args));

  return {
    // Ordinary transitions apply their effects through the host before returning.
    selectForLater: withEffects(selectForLater),
    undoSelection: withEffects(undoSelection),
    adjustProgress: withEffects(adjustProgress),
    advanceProgress: withEffects(advanceProgress),
    setLoved: withEffects(setLoved),
    toggleLoved: withEffects(toggleLoved),
    setProgress: withEffects(setProgress),
    setStatus: withEffects(setStatus),
    // Imports return before applying effects so the Watchlist Import can commit its stage first.
    applyImport,
    applyEffects,
    prepareEntries
  };
};

export { createWatchlistLifecycleRuntime, resolveEpisodeTotal };
