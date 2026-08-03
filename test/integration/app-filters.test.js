import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { createTasteProfileStore } from '../../js/taste-profile.ts';
import { setupDom } from '../helpers/dom.js';

test('App URL filter parsing and normalization', () => {
  setupDom(undefined, { url: 'http://localhost/?genre=Action&genre=drama&theme=Fantasy&year=2024' });

  App.filterOptions = {
    seasonYear: ['Spring 2024'],
    year: ['2024'],
    studio: [],
    source: [],
    genres: ['Action', 'Drama'],
    themes: ['Fantasy'],
    demographic: []
  };

  const filters = App.getFiltersFromUrl();
  assert.deepEqual(filters.genres, ['Action', 'Drama']);
  assert.deepEqual(filters.themes, ['Fantasy']);
  assert.deepEqual(filters.year, ['2024']);
});

test('App setFiltersOnUrl builds query params', () => {
  setupDom(undefined, { url: 'http://localhost/' });
  const url = new URL('http://localhost/');
  const filters = {
    seasonYear: ['Spring 2024'],
    year: ['2024'],
    studio: ['Studio A'],
    source: [],
    genres: ['Action'],
    themes: ['Fantasy'],
    demographic: []
  };

  App.setFiltersOnUrl(url, filters);
  assert.equal(url.searchParams.getAll('genre')[0], 'Action');
  assert.equal(url.searchParams.getAll('theme')[0], 'Fantasy');
  assert.equal(url.searchParams.getAll('season')[0], 'Spring 2024');
});

test('App buildFilterStateUrl includes active filters', () => {
  setupDom(undefined, { url: 'http://localhost/' });
  App.activeFilters = {
    seasonYear: [],
    year: ['2024'],
    studio: [],
    source: [],
    genres: ['Action'],
    themes: [],
    demographic: []
  };

  const url = App.buildFilterStateUrl();
  assert.ok(url.includes('genre=Action'));
  assert.ok(url.includes('year=2024'));
});

test('App normalizes legacy home route to canonical root', () => {
  setupDom('<!doctype html><div id="catalog-section"></div>', { url: 'https://rekonime.vercel.app/home' });

  App.syncHomePath();

  assert.equal(window.location.pathname, '/');
});

test('App refreshes recommendations immediately when filters change during secondary render', () => {
  setupDom('<!doctype html><div id="recommendations-grid"></div><div id="anime-grid"></div>', {
    url: 'http://localhost/'
  });

  const originals = {
    animeData: App.animeData,
    filteredData: App.filteredData,
    activeFilters: App.activeFilters,
    secondaryRenderHandle: App.secondaryRenderHandle,
    secondaryRenderInFlight: App.secondaryRenderInFlight,
    renderActiveFilters: App.renderActiveFilters,
    renderWatchlist: App.renderWatchlist,
    renderSeasonalFilters: App.renderSeasonalFilters,
    renderRecommendationModes: App.renderRecommendationModes,
    renderAnimeGrid: App.renderAnimeGrid,
    updatePrefetchObserving: App.updatePrefetchObserving,
    renderRecommendations: App.renderRecommendations,
    renderRankings: App.renderRankings,
    renderBecauseYouWatched: App.renderBecauseYouWatched,
    renderTrending: App.renderTrending,
    resetGridPagination: App.resetGridPagination,
    updateUrlForFilters: App.updateUrlForFilters,
    updateMetaForFilters: App.updateMetaForFilters,
    queueIdleTask: App.queueIdleTask,
    cancelIdleTask: App.cancelIdleTask,
    shouldDeferHeavyContent: App.shouldDeferHeavyContent
  };

  try {
    App.animeData = [
      { id: 'a', title: 'Action pick', genres: ['Action'], themes: [], year: 2024 },
      { id: 'b', title: 'Drama pick', genres: ['Drama'], themes: [], year: 2024 }
    ];
    App.filteredData = App.animeData;
    App.activeFilters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: ['Action'],
      themes: [],
      demographic: []
    };
    App.secondaryRenderHandle = null;
    App.secondaryRenderInFlight = true;

    let recommendationRenderCount = 0;
    let recommendationDataLength = 0;
    App.renderActiveFilters = () => {};
    App.renderWatchlist = () => {};
    App.renderSeasonalFilters = () => {};
    App.renderRecommendationModes = () => {};
    App.renderAnimeGrid = () => {};
    App.updatePrefetchObserving = () => {};
    App.renderRankings = () => {};
    App.renderBecauseYouWatched = () => {};
    App.renderTrending = () => {};
    App.resetGridPagination = () => {};
    App.updateUrlForFilters = () => {};
    App.updateMetaForFilters = () => {};
    App.shouldDeferHeavyContent = () => false;
    App.cancelIdleTask = () => {};
    App.queueIdleTask = () => 99;
    App.renderRecommendations = () => {
      recommendationRenderCount += 1;
      recommendationDataLength = App.filteredData.length;
    };

    App.applyFilters();

    assert.equal(recommendationRenderCount, 1);
    assert.equal(recommendationDataLength, 1);
  } finally {
    Object.assign(App, originals);
  }
});

test('App active filter summary reports matches and keeps clear available', () => {
  setupDom(`<!doctype html>
    <div class="active-filters is-empty" id="active-filters">
      <div class="active-filters-content">
        <span id="active-filters-label"></span>
        <div id="active-filters-list"></div>
      </div>
      <button class="is-hidden" id="active-filters-clear" type="button">Reset filters</button>
    </div>`);
  const originals = {
    activeFilters: App.activeFilters,
    filteredData: App.filteredData
  };

  try {
    App.activeFilters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: ['Action'],
      themes: [],
      demographic: []
    };
    App.filteredData = [{ id: 'a' }, { id: 'b' }];

    App.renderActiveFilters();

    assert.equal(document.getElementById('active-filters-label').textContent, '2 matches');
    assert.equal(document.getElementById('active-filters-clear').classList.contains('is-hidden'), false);
    assert.equal(document.getElementById('active-filters').classList.contains('is-empty'), false);
  } finally {
    Object.assign(App, originals);
  }
});

test('App shows six recommendations on desktop and three on mobile', () => {
  setupDom();
  window.matchMedia = query => ({
    matches: query.includes('max-width: 640px') ? false : false
  });
  assert.equal(App.getRecommendationDisplayLimit(), 6);
  assert.equal(App.initialGridBatchSize, 6);

  window.matchMedia = query => ({
    matches: query.includes('max-width: 640px')
  });
  assert.equal(App.getRecommendationDisplayLimit(), 3);
  assert.equal(App.initialGridBatchSizeMobile, 3);
});

test('App initially ranks Explore Every Title by Taste Profile fit', () => {
  const originals = {
    currentSort: App.currentSort,
    tasteProfileStore: App.tasteProfileStore
  };
  const storage = {
    getItem: () => null,
    setItem: () => {}
  };

  try {
    App.currentSort = 'taste';
    App.tasteProfileStore = createTasteProfileStore({ storage });
    App.tasteProfileStore.load();
    App.tasteProfileStore.applyRecommendationFeedback('rec-more-like', {
      id: 'seed',
      title: 'Seed',
      genres: ['Drama']
    });

    const sorted = App.sortAnimeByMetric([
      { id: 'generic', genres: ['Action'], stats: { retentionScore: 95 } },
      { id: 'taste-fit', genres: ['Drama'], stats: { retentionScore: 70 } }
    ], App.currentSort);

    assert.deepEqual(sorted.map(item => item.id), ['taste-fit', 'generic']);
  } finally {
    Object.assign(App, originals);
  }
});

test('App applies a Viewing Intent without changing explicit filters', () => {
  setupDom('<!doctype html><div id="viewing-intent-options"></div><div id="recommendations-grid"></div>');
  const originals = {
    activeFilters: App.activeFilters,
    viewingIntentRuntime: App.viewingIntentRuntime,
    renderViewingIntents: App.renderViewingIntents,
    renderRecommendations: App.renderRecommendations
  };

  try {
    App.activeFilters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: ['Action'],
      themes: ['Fantasy'],
      demographic: []
    };
    App.viewingIntentRuntime = null;
    App.renderViewingIntents = () => {};
    let rendered = 0;
    App.renderRecommendations = () => {
      rendered += 1;
    };

    assert.equal(App.applyViewingIntent('unwind'), true);
    assert.deepEqual(App.activeFilters.genres, ['Action']);
    assert.deepEqual(App.activeFilters.themes, ['Fantasy']);
    assert.equal(App.getActiveViewingIntent()?.key, 'unwind');
    assert.equal(rendered, 1);
  } finally {
    Object.assign(App, originals);
  }
});
