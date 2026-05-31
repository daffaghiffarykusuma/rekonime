import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCatalogPayloadEffects } from '../../js/services/catalog-payload-effects.ts';
import { setupDom } from '../helpers/dom.js';

test('Catalog Payload effects apply payload state and downstream render intent', async () => {
  setupDom('<!doctype html><html><body></body></html>');
  const calls = [];
  const app = {
    scoreProfile: null,
    animeData: [],
    isFullDataLoaded: false,
    gridSortedCache: ['stale'],
    gridSortedKey: 'stale',
    gridSortedSource: 'stale',
    gridSortedIsPartial: true,
    gridSortHandle: 1,
    gridDomCache: new Map([['stale', {}]]),
    detailCache: new Map([['stale', 'html']]),
    visibleCardIds: new Set(['stale']),
    activeFilters: {},
    filterPanelRendered: false,
    filterPanelOpen: false,
    deferFilterUiUsed: false,
    urlFiltersApplied: false,
    getDefaultActiveFilters: () => ({ genres: ['Action'] }),
    cancelIdleTask: (handle) => calls.push(['cancelIdleTask', handle]),
    markCatalogFresh: () => calls.push(['markCatalogFresh']),
    ensureStats: async () => calls.push(['ensureStats']),
    refreshWatchlistSnapshotsFromCatalog: (options) => calls.push(['refreshWatchlistSnapshotsFromCatalog', options]),
    scheduleAiringDashboardRender: (options) => calls.push(['scheduleAiringDashboardRender', options]),
    extractFilterOptions: () => calls.push(['extractFilterOptions']),
    shouldEnableLowMotionMode: () => false,
    isCatalogPage: () => true,
    hasFilterParamsInUrl: () => true,
    setActiveFiltersFromUrl: () => calls.push(['setActiveFiltersFromUrl']),
    updateUrlForFilters: (options) => calls.push(['updateUrlForFilters', options]),
    updateSortOptions: () => calls.push(['updateSortOptions']),
    scheduleFilterPanelRender: () => calls.push(['scheduleFilterPanelRender']),
    renderFilterPanel: () => calls.push(['renderFilterPanel']),
    renderQuickFilters: () => calls.push(['renderQuickFilters']),
    applyFilters: (options) => calls.push(['applyFilters', options])
  };

  const state = await applyCatalogPayloadEffects(app, {
    scoreProfile: { p35: 3, p50: 4, p65: 5 },
    anime: [{ id: 'show-1', title: 'Show 1' }]
  }, { isFull: true, preserveFilters: false });

  assert.equal(state.catalogStatus, 'full');
  assert.equal(app.isFullDataLoaded, true);
  assert.equal(app.animeData[0].id, 'show-1');
  assert.equal(app.gridDomCache.size, 0);
  assert.equal(app.detailCache.size, 0);
  assert.equal(document.documentElement.dataset.catalogStatus, 'full');
  assert.deepEqual(calls.map(call => call[0]), [
    'cancelIdleTask',
    'markCatalogFresh',
    'ensureStats',
    'refreshWatchlistSnapshotsFromCatalog',
    'scheduleAiringDashboardRender',
    'extractFilterOptions',
    'setActiveFiltersFromUrl',
    'updateUrlForFilters',
    'updateSortOptions',
    'scheduleFilterPanelRender',
    'renderQuickFilters',
    'applyFilters'
  ]);
});
