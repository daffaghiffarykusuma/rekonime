// @ts-nocheck

const buildCatalogPayloadEffectPlan = (catalogState, {
  deferFilterUiUsed = false,
  filterPanelOpen = false,
  filterPanelRendered = false,
  hasFilterParamsInUrl = false,
  isCatalogPage = false,
  lowMotionMode = false,
  urlFiltersApplied = false
} = {}) => {
  const deferFilterUiOnce = !deferFilterUiUsed && Boolean(lowMotionMode);
  const shouldApplyUrlFilters = !urlFiltersApplied && Boolean(isCatalogPage);
  const shouldRenderFilterUi = !deferFilterUiOnce;

  return {
    state: {
      scoreProfile: catalogState.scoreProfile,
      animeData: catalogState.animeData,
      isFullDataLoaded: catalogState.isFullDataLoaded,
      activeFilters: catalogState.activeFilters,
      deferFilterUiOnce
    },
    document: {
      catalogStatus: catalogState.catalogStatus,
      catalogReady: catalogState.catalogReady
    },
    gridState: catalogState.gridState,
    steps: [
      { type: 'assignCatalogState' },
      { type: 'reflectCatalogDocumentState' },
      { type: 'resetGridState' },
      { type: 'markCatalogFresh' },
      { type: 'assignActiveFilters', enabled: Boolean(catalogState.activeFilters) },
      { type: 'ensureStats' },
      { type: 'refreshWatchlistSnapshots', options: { persist: true } },
      { type: 'scheduleAiringDashboard', options: { timeout: 3500 } },
      { type: 'extractFilterOptions' },
      { type: 'assignDeferredFilterUi' },
      {
        type: 'applyUrlFilters',
        enabled: shouldApplyUrlFilters,
        updateUrl: Boolean(hasFilterParamsInUrl)
      },
      {
        type: 'renderFilterUi',
        enabled: shouldRenderFilterUi,
        filterPanel: filterPanelRendered || filterPanelOpen ? 'render' : 'schedule'
      },
      { type: 'applyFilters', options: { syncUrl: false, updateMeta: false } }
    ]
  };
};

export { buildCatalogPayloadEffectPlan };
