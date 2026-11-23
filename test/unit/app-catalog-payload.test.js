import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { setupDom } from '../helpers/dom.js';

test('App Shell applies Catalog Payload state and browser effects', async () => {
  setupDom('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/?genre=Action'
  });
  const calls = [];
  const app = Object.assign(Object.create(App), {
    gridDomCache: new Map([['stale', {}]]),
    detailExperience: { invalidate: () => calls.push(['invalidateDetails']) },
    visibleCardIds: new Set(['stale']),
    gridSortHandle: 1,
    deferFilterUiUsed: false,
    filterPanelRendered: false,
    filterPanelOpen: false,
    urlFiltersApplied: false,
    isCatalogPage: () => true,
    shouldEnableLowMotionMode: () => false,
    runtimeCapabilities: {
      cancelIdleTask: (handle) => calls.push(['cancelIdleTask', handle])
    },
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
  assert.equal(calls.filter(([name]) => name === 'invalidateDetails').length, 1);
  assert.equal(document.documentElement.dataset.catalogStatus, 'full');
  assert.deepEqual(calls.find(([name]) => name === 'refreshWatchlistSnapshots'), ['refreshWatchlistSnapshots', { persist: true }]);
  assert.deepEqual(calls.find(([name]) => name === 'scheduleAiringDashboard'), ['scheduleAiringDashboard', { timeout: 3500 }]);
  assert.deepEqual(calls.find(([name]) => name === 'applyFilters'), ['applyFilters', { syncUrl: false, updateMeta: false }]);
  assert.deepEqual(calls.find(([name]) => name === 'updateUrlForFilters'), ['updateUrlForFilters', { replace: true }]);
  assert.deepEqual(calls.map(([name]) => name), [
    'cancelIdleTask',
    'invalidateDetails',
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

test('App applies one invalidation policy to catalog replacement and enrichment', () => {
  const invalidated = [];
  const snapshotRefreshes = [];
  const app = Object.assign(Object.create(App), {
    gridSortedCache: ['old'], gridSortedKey: 'k', gridSortedSource: ['old'], gridSortedIsPartial: true, gridSortHandle: null,
    gridDomCache: new Map([['one', {}], ['two', {}]]),
    visibleCardIds: new Set(['one', 'two']),
    detailExperience: { invalidate: (id) => invalidated.push(id ?? 'all') },
    refreshWatchlistSnapshotsFromCatalog: (options) => snapshotRefreshes.push(options)
  });

  app.handleCatalogChange({ reason: 'enriched', ids: ['one'] });

  assert.equal(app.gridSortedCache, null);
  assert.equal(app.gridSortedIsPartial, false);
  assert.deepEqual([...app.gridDomCache.keys()], ['one', 'two']);
  assert.deepEqual([...app.visibleCardIds], ['one', 'two']);
  assert.deepEqual(invalidated, ['one']);
  assert.deepEqual(snapshotRefreshes, [{ persist: true }]);

  app.handleCatalogChange({ reason: 'replaced' });

  assert.equal(app.gridDomCache.size, 0);
  assert.equal(app.visibleCardIds.size, 0);
  assert.deepEqual(invalidated, ['one', 'all']);
  assert.equal(snapshotRefreshes.length, 1);
});

test('locally calculated strengths rank against this catalog when the payload profile has no quantile table', async () => {
  const { Stats } = await import('../../src/features/discovery/stats.ts');
  const series = score => Array.from({ length: 12 }, (_, i) => ({ episode: i + 1, score }));
  const animeData = [3.6, 3.9, 4.1, 4.3, 4.5, 4.8].map((score, i) => ({ id: `t${i}`, episodes: series(score) }));
  const app = Object.assign(Object.create(App), {
    animeData,
    scoreProfile: { p35: 4.15, p50: 4.29, p65: 4.4 },
    loadStatsModule: async () => Stats
  });
  await app.ensureStats();
  assert.equal(Stats.isValidStrengthQuantiles(app.scoreProfile.strengthQuantiles), true);
  assert.equal(app.scoreProfile.p35, 4.15, 'the payload baseline is kept');
  const strengths = animeData.map(anime => anime.stats.retentionScore);
  assert.deepEqual([...strengths].sort((a, b) => a - b), strengths, 'higher-rated series rank higher');
  assert.ok(strengths[0] < 20 && strengths.at(-1) > 80, `percentiles span the catalog: ${strengths}`);
});
