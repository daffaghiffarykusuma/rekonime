// @ts-nocheck
import { CatalogPayload } from './catalog-payload.ts';
import { buildCatalogPayloadEffectPlan } from './catalog-payload-effect-plan.ts';

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

const buildPlanInputsFromApp = (app) => {
  const isCatalogPage = app.isCatalogPage();
  const shouldApplyUrlFilters = !app.urlFiltersApplied && isCatalogPage;
  return {
    deferFilterUiUsed: app.deferFilterUiUsed,
    filterPanelOpen: app.filterPanelOpen,
    filterPanelRendered: app.filterPanelRendered,
    hasFilterParamsInUrl: shouldApplyUrlFilters ? app.hasFilterParamsInUrl() : false,
    isCatalogPage,
    lowMotionMode: app.shouldEnableLowMotionMode(),
    urlFiltersApplied: app.urlFiltersApplied
  };
};

const executeCatalogPayloadEffectPlan = async (app, plan) => {
  for (const step of plan.steps) {
    if (step.enabled === false) continue;

    if (step.type === 'assignCatalogState') {
      app.scoreProfile = plan.state.scoreProfile;
      app.animeData = plan.state.animeData;
      app.isFullDataLoaded = plan.state.isFullDataLoaded;
      continue;
    }

    if (step.type === 'reflectCatalogDocumentState') {
      reflectCatalogDocumentState(plan.document);
      continue;
    }

    if (step.type === 'resetGridState') {
      resetGridState(app, plan.gridState);
      continue;
    }

    if (step.type === 'markCatalogFresh') {
      if (app.markCatalogFresh) {
        app.markCatalogFresh();
      }
      continue;
    }

    if (step.type === 'assignActiveFilters') {
      app.activeFilters = plan.state.activeFilters;
      continue;
    }

    if (step.type === 'ensureStats') {
      await app.ensureStats();
      continue;
    }

    if (step.type === 'refreshWatchlistSnapshots') {
      app.refreshWatchlistSnapshotsFromCatalog(step.options);
      continue;
    }

    if (step.type === 'scheduleAiringDashboard') {
      app.scheduleAiringDashboardRender(step.options);
      continue;
    }

    if (step.type === 'extractFilterOptions') {
      app.extractFilterOptions();
      continue;
    }

    if (step.type === 'assignDeferredFilterUi') {
      app.deferFilterUiOnce = plan.state.deferFilterUiOnce;
      continue;
    }

    if (step.type === 'applyUrlFilters') {
      app.setActiveFiltersFromUrl();
      app.urlFiltersApplied = true;
      if (step.updateUrl) {
        app.updateUrlForFilters({ replace: true });
      }
      continue;
    }

    if (step.type === 'renderFilterUi') {
      app.updateSortOptions();
      if (step.filterPanel === 'render') {
        app.renderFilterPanel({ force: true });
      } else {
        app.scheduleFilterPanelRender();
      }
      app.renderQuickFilters();
      continue;
    }

    if (step.type === 'applyFilters') {
      app.applyFilters(step.options);
    }
  }
};

const applyCatalogPayloadEffects = async (app, payload, {
  isFull = false,
  preserveFilters = true,
  buildPlan = buildCatalogPayloadEffectPlan,
  prepareState = CatalogPayload.prepareState
} = {}) => {
  const catalogState = prepareState(payload, {
    isFull,
    preserveFilters,
    defaultActiveFilters: app.getDefaultActiveFilters()
  });

  const plan = buildPlan(catalogState, buildPlanInputsFromApp(app));
  await executeCatalogPayloadEffectPlan(app, plan);
  return catalogState;
};

export {
  applyCatalogPayloadEffects,
  buildPlanInputsFromApp,
  executeCatalogPayloadEffectPlan,
  reflectCatalogDocumentState,
  resetGridState
};
