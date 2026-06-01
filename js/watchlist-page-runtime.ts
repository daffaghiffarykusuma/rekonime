// @ts-nocheck
import { buildWatchlistTransitionEnvelope } from './watchlist-state.js';

const normalizeActionId = (value) => String(value || '').trim();

const createWatchlistPageRuntime = ({
  getEpisodeCountFromCard,
  getWatchlistLifecycle,
  renderWatchlist,
  updateWatchlistUi
}) => {
  const setWatchStatus = (animeId, status, episodeCount) => {
    const key = normalizeActionId(animeId);
    if (!key) return null;
    const lifecycle = getWatchlistLifecycle();
    lifecycle.load();
    const current = lifecycle.getEntry(key);
    const result = lifecycle.setStatus(key, status, {
      episodeCount,
      snapshot: current?.snapshot || null
    });
    return buildWatchlistTransitionEnvelope(result);
  };

  const setWatchProgress = (animeId, progress, episodeCount) => {
    const key = normalizeActionId(animeId);
    if (!key) return null;
    const lifecycle = getWatchlistLifecycle();
    lifecycle.load();
    const current = lifecycle.getEntry(key);
    const result = lifecycle.setProgress(key, progress, {
      episodeCount,
      snapshot: current?.snapshot || null
    });
    return buildWatchlistTransitionEnvelope(result, { renderMode: 'controls' });
  };

  const adjustWatchProgress = (animeId, delta, episodeCount) => {
    const key = normalizeActionId(animeId);
    if (!key) return null;
    const lifecycle = getWatchlistLifecycle();
    lifecycle.load();
    const current = lifecycle.getEntry(key);
    const result = lifecycle.adjustProgress(key, delta, {
      episodeCount,
      snapshot: current?.snapshot || null
    });
    return buildWatchlistTransitionEnvelope(result, { renderMode: 'controls' });
  };

  const applyWatchlistTransition = (card, transition) => {
    if (!transition?.changed) return false;
    if (transition.render?.controls?.shouldUpdate) {
      updateWatchlistUi(card, transition.render.controls.entry);
    }
    if (transition.render?.watchlist?.shouldRender) {
      renderWatchlist();
    }
    return true;
  };

  const handleWatchlistChange = (target) => {
    if (!target || !target.dataset) return false;
    const action = target.dataset.action;
    if (!action) return false;
    const card = target.closest?.('.anime-card');
    if (!card) return true;
    const animeId = normalizeActionId(target.dataset.animeId || card.dataset.animeId);
    if (!animeId) return true;
    const episodeCount = getEpisodeCountFromCard(card);

    if (action === 'watch-status') {
      const transition = setWatchStatus(animeId, target.value, episodeCount);
      applyWatchlistTransition(card, transition);
      return true;
    }

    if (action === 'watch-progress') {
      const transition = setWatchProgress(animeId, target.value, episodeCount);
      applyWatchlistTransition(card, transition);
      return true;
    }

    return false;
  };

  const handleWatchlistClick = (target) => {
    const wrapper = target.closest?.('.watchlist-controls');
    if (!wrapper) return false;
    const actionEl = target.closest?.('[data-action]');
    if (!actionEl) return true;
    const action = actionEl.dataset.action;
    if (!action) return true;

    const card = target.closest?.('.anime-card');
    if (!card) return true;
    const animeId = normalizeActionId(actionEl.dataset.animeId || card.dataset.animeId);
    if (!animeId) return true;
    const episodeCount = getEpisodeCountFromCard(card);

    if (action === 'watch-progress-inc') {
      const transition = adjustWatchProgress(animeId, 1, episodeCount);
      applyWatchlistTransition(card, transition);
      return true;
    }

    if (action === 'watch-progress-dec') {
      const transition = adjustWatchProgress(animeId, -1, episodeCount);
      applyWatchlistTransition(card, transition);
      return true;
    }

    return true;
  };

  return {
    adjustWatchProgress,
    applyWatchlistTransition,
    handleWatchlistChange,
    handleWatchlistClick,
    setWatchProgress,
    setWatchStatus
  };
};

export { createWatchlistPageRuntime };
