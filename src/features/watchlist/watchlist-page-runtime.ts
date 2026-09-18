// @ts-nocheck
const normalizeActionId = (value) => String(value || '').trim();

const createWatchlistPageRuntime = ({
  getEpisodeCountFromCard,
  getWatchlistRuntime,
  renderWatchlist,
  showFeedback = () => {},
  updateWatchlistUi
}) => {
  const applyWatchlistTransition = (card, result) => {
    const transition = result?.transition;
    if (!transition?.changed) return false;
    if (transition.render?.controls?.shouldUpdate) {
      updateWatchlistUi(card, transition.render.controls.entry);
    }
    if (transition.render?.watchlist?.shouldRender) {
      renderWatchlist();
    }
    if (transition.feedback) {
      showFeedback(transition.feedback);
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
      applyWatchlistTransition(card, getWatchlistRuntime().setStatus(animeId, target.value, { episodeCount }));
      return true;
    }

    if (action === 'watch-progress') {
      applyWatchlistTransition(card, getWatchlistRuntime().setProgress(animeId, target.value, { episodeCount }));
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
      applyWatchlistTransition(card, getWatchlistRuntime().adjustProgress(animeId, 1, { episodeCount }));
      return true;
    }

    if (action === 'watch-progress-dec') {
      applyWatchlistTransition(card, getWatchlistRuntime().adjustProgress(animeId, -1, { episodeCount }));
      return true;
    }

    return true;
  };

  return {
    applyWatchlistTransition,
    handleWatchlistChange,
    handleWatchlistClick
  };
};

export { createWatchlistPageRuntime };
