import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { setupDom } from '../helpers/dom.js';

test('App Shell applies Catalog Payload state and browser effects', async () => {
  setupDom('<!doctype html><html><body></body></html>');
  const calls = [];
  const app = Object.assign(Object.create(App), {
    gridDomCache: new Map([['stale', {}]]),
    detailCache: new Map([['stale', 'html']]),
    visibleCardIds: new Set(['stale']),
    gridSortHandle: 1,
    deferFilterUiUsed: false,
    filterPanelRendered: false,
    filterPanelOpen: false,
    urlFiltersApplied: false,
    getDefaultActiveFilters: () => ({ genres: ['Action'] }),
    isCatalogPage: () => true,
    hasFilterParamsInUrl: () => true,
    shouldEnableLowMotionMode: () => false,
    cancelIdleTask: (handle) => calls.push(['cancelIdleTask', handle]),
    markCatalogFresh: () => calls.push(['markCatalogFresh']),
    ensureStats: async () => calls.push(['ensureStats']),
    refreshWatchlistSnapshotsFromCatalog: (options) => calls.push(['refreshWatchlistSnapshots', options]),
    refreshTasteProfileEvidence: () => calls.push(['refreshTasteProfileEvidence']),
    scheduleAiringDashboardRender: (options) => calls.push(['scheduleAiringDashboard', options]),
    extractFilterOptions: () => calls.push(['extractFilterOptions']),
    setActiveFiltersFromUrl: () => calls.push(['setActiveFiltersFromUrl']),
    updateUrlForFilters: (options) => calls.push(['updateUrlForFilters', options]),
    updateSortOptions: () => calls.push(['updateSortOptions']),
    scheduleFilterPanelRender: () => calls.push(['scheduleFilterPanelRender']),
    renderQuickFilters: () => calls.push(['renderQuickFilters']),
    applyFilters: (options) => calls.push(['applyFilters', options])
  });

  const state = await app.applyCatalogPayload({
    scoreProfile: { p35: 3, p50: 4, p65: 5 },
    anime: [{ id: 'show-1', title: 'Show 1' }]
  }, { isFull: true, preserveFilters: false });

  assert.equal(state.catalogStatus, 'full');
  assert.equal(app.animeData[0].id, 'show-1');
  assert.equal(app.gridDomCache.size, 0);
  assert.equal(app.detailCache.size, 0);
  assert.equal(document.documentElement.dataset.catalogStatus, 'full');
  assert.deepEqual(calls.map(([name]) => name), [
    'cancelIdleTask',
    'markCatalogFresh',
    'ensureStats',
    'refreshWatchlistSnapshots',
    'refreshTasteProfileEvidence',
    'scheduleAiringDashboard',
    'extractFilterOptions',
    'setActiveFiltersFromUrl',
    'updateUrlForFilters',
    'updateSortOptions',
    'scheduleFilterPanelRender',
    'renderQuickFilters',
    'applyFilters'
  ]);
});
