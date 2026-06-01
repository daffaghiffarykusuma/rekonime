import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogPayloadEffectPlan } from '../../js/services/catalog-payload-effect-plan.ts';

const catalogState = {
  animeData: [{ id: 'show-1' }],
  scoreProfile: { p35: 3, p50: 4, p65: 5 },
  isFullDataLoaded: true,
  activeFilters: null,
  catalogStatus: 'full',
  catalogReady: true,
  gridState: {
    sortedCache: null,
    sortedKey: '',
    sortedSource: null,
    sortedIsPartial: false
  }
};

test('Catalog Payload Effect Plan makes post-payload work explicit', () => {
  const plan = buildCatalogPayloadEffectPlan(catalogState, {
    deferFilterUiUsed: false,
    filterPanelOpen: false,
    filterPanelRendered: false,
    hasFilterParamsInUrl: true,
    isCatalogPage: true,
    lowMotionMode: false,
    urlFiltersApplied: false
  });

  assert.deepEqual(plan.document, { catalogStatus: 'full', catalogReady: true });
  assert.equal(plan.state.deferFilterUiOnce, false);
  assert.deepEqual(plan.steps.map(step => step.type), [
    'assignCatalogState',
    'reflectCatalogDocumentState',
    'resetGridState',
    'markCatalogFresh',
    'assignActiveFilters',
    'ensureStats',
    'refreshWatchlistSnapshots',
    'scheduleAiringDashboard',
    'extractFilterOptions',
    'assignDeferredFilterUi',
    'applyUrlFilters',
    'renderFilterUi',
    'applyFilters'
  ]);
  assert.equal(plan.steps.find(step => step.type === 'applyUrlFilters').updateUrl, true);
  assert.equal(plan.steps.find(step => step.type === 'renderFilterUi').filterPanel, 'schedule');
});

test('Catalog Payload Effect Plan can defer filter UI without hiding the decision in App Shell', () => {
  const plan = buildCatalogPayloadEffectPlan(catalogState, {
    deferFilterUiUsed: false,
    lowMotionMode: true
  });

  assert.equal(plan.state.deferFilterUiOnce, true);
  assert.equal(plan.steps.find(step => step.type === 'renderFilterUi').enabled, false);
});
