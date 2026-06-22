// @ts-nocheck
import { CatalogPayload } from './catalog-payload.ts';

const resetGridState = (app, gridState) => {
  app.gridSortedCache = gridState.sortedCache;
  app.gridSortedKey = gridState.sortedKey;
  app.gridSortedSource = gridState.sortedSource;
  app.gridSortedIsPartial = gridState.sortedIsPartial;
  if (app.gridSortHandle) {
    app.cancelIdleTask(app.gridSortHandle);
    app.gridSortHandle = null;
  }
  app.gridDomCache.clear();
  app.detailCache.clear();
  app.visibleCardIds.clear();
};

const reflectCatalogDocumentState = (catalogState, root = globalThis.document?.documentElement) => {
  if (!root) return;
  root.dataset.catalogStatus = catalogState.catalogStatus;
  root.dataset.catalogReady = String(catalogState.catalogReady);
};

const applyCatalogPayloadEffects = async (app, payload, {
  isFull = false,
  preserveFilters = true,
  prepareState = CatalogPayload.prepareState
} = {}) => {
  const catalogState = prepareState(payload, {
    isFull,
    preserveFilters,
    defaultActiveFilters: app.getDefaultActiveFilters()
  });

  app.scoreProfile = catalogState.scoreProfile;
  app.animeData = catalogState.animeData;
  app.isFullDataLoaded = catalogState.isFullDataLoaded;
  reflectCatalogDocumentState(catalogState);
  resetGridState(app, catalogState.gridState);
  app.markCatalogFresh?.();
  if (catalogState.activeFilters) app.activeFilters = catalogState.activeFilters;

  await app.ensureStats();
  app.refreshWatchlistSnapshotsFromCatalog({ persist: true });
  app.scheduleAiringDashboardRender({ timeout: 3500 });
  app.extractFilterOptions();

  app.deferFilterUiOnce = !app.deferFilterUiUsed && app.shouldEnableLowMotionMode();
  if (!app.urlFiltersApplied && app.isCatalogPage()) {
    const updateUrl = app.hasFilterParamsInUrl();
    app.setActiveFiltersFromUrl();
    app.urlFiltersApplied = true;
    if (updateUrl) app.updateUrlForFilters({ replace: true });
  }

  if (!app.deferFilterUiOnce) {
    app.updateSortOptions();
    if (app.filterPanelRendered || app.filterPanelOpen) {
      app.renderFilterPanel({ force: true });
    } else {
      app.scheduleFilterPanelRender();
    }
    app.renderQuickFilters();
  }
  app.applyFilters({ syncUrl: false, updateMeta: false });
  return catalogState;
};

export {
  applyCatalogPayloadEffects,
  reflectCatalogDocumentState,
  resetGridState
};
