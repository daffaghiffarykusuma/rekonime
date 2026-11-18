// @ts-nocheck
// Translates Watchlist page DOM actions into Watchlist Lifecycle Runtime commands.
// The runtime applies every transition effect through the page's host ports.
const normalizeActionId = (value) => String(value || '').trim();

const CHANGE_COMMANDS = {
  'watch-status': (runtime, animeId, target, options) => runtime.setStatus(animeId, target.value, options),
  'watch-progress': (runtime, animeId, target, options) => runtime.setProgress(animeId, target.value, options)
};

const CLICK_COMMANDS = {
  'watch-progress-inc': (runtime, animeId, options) => runtime.adjustProgress(animeId, 1, options),
  'watch-progress-dec': (runtime, animeId, options) => runtime.adjustProgress(animeId, -1, options)
};

const createWatchlistPageRuntime = ({
  getEpisodeCountFromCard,
  getWatchlistRuntime
}) => {
  const resolveCardTarget = (target, element) => {
    const card = target.closest?.('.anime-card');
    if (!card) return null;
    const animeId = normalizeActionId(element.dataset.animeId || card.dataset.animeId);
    if (!animeId) return null;
    return { animeId, options: { episodeCount: getEpisodeCountFromCard(card) } };
  };

  const handleWatchlistChange = (target) => {
    if (!target || !target.dataset) return false;
    const command = CHANGE_COMMANDS[target.dataset.action];
    if (!target.dataset.action) return false;
    const resolved = resolveCardTarget(target, target);
    if (!resolved) return true;
    if (!command) return false;
    command(getWatchlistRuntime(), resolved.animeId, target, resolved.options);
    return true;
  };

  const handleWatchlistClick = (target) => {
    const wrapper = target.closest?.('.watchlist-controls');
    if (!wrapper) return false;
    const actionEl = target.closest?.('[data-action]');
    const command = CLICK_COMMANDS[actionEl?.dataset?.action];
    if (!command) return true;
    const resolved = resolveCardTarget(target, actionEl);
    if (resolved) command(getWatchlistRuntime(), resolved.animeId, resolved.options);
    return true;
  };

  return {
    handleWatchlistChange,
    handleWatchlistClick
  };
};

export { createWatchlistPageRuntime };
