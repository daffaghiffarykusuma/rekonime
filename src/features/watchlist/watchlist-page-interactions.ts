// @ts-nocheck

const createWatchlistPageInteractions = ({
  documentRef = typeof document !== 'undefined' ? document : null,
  handleImageError,
  handleWatchlistChange,
  handleWatchlistClick,
  loadFullApp,
  onFilterChange,
  renderWatchlist
}) => {
  const handleCardOpen = async (target) => {
    const card = target.closest?.('.anime-card, .airing-card');
    if (!card) return false;
    const animeId = String(card.dataset.animeId || '').trim();
    if (!animeId) return true;
    const app = await loadFullApp();
    app.showAnimeDetail(animeId);
    return true;
  };

  const attachCardHandlers = (grid, { includeControls = false } = {}) => {
    if (!grid) return;

    grid.addEventListener('click', async (event) => {
      if (includeControls && handleWatchlistClick(event.target)) return;
      await handleCardOpen(event.target);
    });

    if (includeControls) {
      grid.addEventListener('change', (event) => {
        if (handleWatchlistChange(event.target)) return;
      });
    }

    grid.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const isFormControl = event.target?.matches?.('input, select, textarea, button');
      if (isFormControl || event.target?.closest?.('.watchlist-controls')) return;
      const card = event.target.closest?.('.anime-card, .airing-card');
      if (!card) return;
      event.preventDefault();
      const app = await loadFullApp();
      app.showAnimeDetail(String(card.dataset.animeId || '').trim());
    });

    grid.addEventListener('error', (event) => {
      handleImageError(event.target);
    }, true);
  };

  const setupGridHandlers = () => {
    if (!documentRef) return;
    attachCardHandlers(documentRef.getElementById('watchlist-grid'), { includeControls: true });
    attachCardHandlers(documentRef.getElementById('airing-dashboard-grid'));
  };

  const setupFilterHandlers = () => {
    const chips = documentRef?.getElementById('watchlist-filter-chips');
    if (!chips) return;
    chips.addEventListener('click', (event) => {
      const button = event.target.closest?.('[data-filter]');
      if (!button) return;
      const next = String(button.dataset.filter || '').trim();
      onFilterChange(next);
    });
  };

  const setupSettingsHandler = () => {
    const settingsToggle = documentRef?.getElementById('settings-toggle');
    settingsToggle?.addEventListener('click', async () => {
      const app = await loadFullApp();
      app.toggleSettingsModal();
    });

    const openImport = async () => {
      const app = await loadFullApp();
      app.ensureSettingsRendered();
      app.getRuntimeCapabilities().setModalVisibility('settings-modal', true, {
        initialFocusSelector: '#mal-watchlist-import-file'
      });
      documentRef.getElementById('mal-watchlist-import-file')?.scrollIntoView({ block: 'center' });
    };
    documentRef?.getElementById('mal-import-toggle')?.addEventListener('click', openImport);
    documentRef?.getElementById('watchlist-mal-import-toggle')?.addEventListener('click', openImport);
    documentRef?.getElementById('watchlist-export-backup')?.addEventListener('click', async () => {
      const app = await loadFullApp();
      app.exportPersonalData();
    });
    documentRef?.getElementById('watchlist-restore-backup')?.addEventListener('click', () => {
      documentRef.getElementById('watchlist-backup-file')?.click();
    });
    documentRef?.getElementById('watchlist-backup-file')?.addEventListener('change', async (event) => {
      const input = event.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      const app = await loadFullApp();
      await app.restorePersonalDataFile(file);
    });
  };

  const setupWatchlistSync = () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('rekonime:watchlist-updated', (event) => {
      renderWatchlist({ cacheOnly: Boolean(event.detail?.summary) });
    });
  };

  const setupPageHandlers = () => {
    setupGridHandlers();
    setupFilterHandlers();
    setupSettingsHandler();
    setupWatchlistSync();
  };

  return {
    attachCardHandlers,
    handleCardOpen,
    setupFilterHandlers,
    setupGridHandlers,
    setupPageHandlers,
    setupSettingsHandler,
    setupWatchlistSync
  };
};

export { createWatchlistPageInteractions };
