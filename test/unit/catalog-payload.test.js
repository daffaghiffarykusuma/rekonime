import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CatalogPayload,
  normalizeAnimeData,
  prepareCatalogPayloadApplication,
  prepareCatalogPayloadState
} from '../../js/services/catalog-payload.ts';

test('CatalogPayload normalizes nested metadata into render-ready anime data', () => {
  const [anime] = normalizeAnimeData([
    {
      id: 'legacy-id',
      title: 'Fallback Title',
      metadata: {
        id: 'anime-1',
        title: 'Main Title',
        title_english: 'English Title',
        genres: [' Action ', 'action', 'undefined', 'Drama'],
        themes: ['School'],
        score: '8.5',
        episodes_count: '12',
        trailer: { youtubeId: 'abc123' },
        synopsis: 'A synopsis.'
      },
      episodes: [{ episode: 1 }, { episode: 7 }]
    }
  ]);

  assert.equal(anime.id, 'anime-1');
  assert.equal(anime.title, 'Main Title');
  assert.deepEqual(anime.genres, ['Action', 'Drama']);
  assert.deepEqual(anime.themes, ['School']);
  assert.equal(anime.communityScore, 8.5);
  assert.equal(anime.episodeCount, 12);
  assert.equal(anime.searchIndex.variants.includes('main title'), true);
  assert.equal(anime.searchText.includes('englishtitle'), true);
});

test('CatalogPayload preserves existing search text and search index', () => {
  const existingSearchIndex = {
    variants: ['custom'],
    compactVariants: ['custom'],
    tokenSet: new Set(['custom'])
  };

  const [anime] = normalizeAnimeData([
    {
      id: 'anime-2',
      title: 'Should Not Rebuild',
      searchText: 'already indexed',
      searchIndex: existingSearchIndex
    }
  ]);

  assert.equal(anime.searchText, 'already indexed');
  assert.equal(anime.searchIndex, existingSearchIndex);
});

test('CatalogPayload prepares application state for a full payload', () => {
  const defaultActiveFilters = {
    seasonYear: ['Spring 2026'],
    year: [],
    studio: [],
    source: [],
    genres: ['Action'],
    themes: [],
    demographic: []
  };
  const state = prepareCatalogPayloadState(
    {
      scoreProfile: { p35: 3.1, p50: 4.2, p65: 5.3 },
      anime: [{ id: 'full-entry', title: 'Full Entry' }]
    },
    {
      isFull: true,
      preserveFilters: false,
      defaultActiveFilters
    }
  );

  assert.equal(state.isFullDataLoaded, true);
  assert.equal(state.catalogStatus, 'full');
  assert.equal(state.catalogReady, true);
  assert.equal(state.scoreProfile.p50, 4.2);
  assert.deepEqual(state.gridState, {
    sortedCache: null,
    sortedKey: '',
    sortedSource: null,
    sortedIsPartial: false
  });
  assert.deepEqual(state.activeFilters.genres, ['Action']);
  assert.notEqual(state.activeFilters.genres, defaultActiveFilters.genres);
});

test('CatalogPayload keeps filters untouched and drops invalid score profiles', () => {
  const state = CatalogPayload.prepareState(
    {
      scoreProfile: { p35: 3.1, p50: 'bad', p65: 5.3 },
      anime: [{ id: 'embedded-entry', title: 'Embedded Entry' }]
    },
    {
      isFull: false,
      preserveFilters: true
    }
  );

  assert.equal(state.scoreProfile, null);
  assert.equal(state.catalogStatus, 'embedded');
  assert.equal(state.activeFilters, null);
  assert.equal(state.animeData[0].id, 'embedded-entry');
});

test('CatalogPayload prepares downstream refresh intent without App Shell knowledge', () => {
  const application = prepareCatalogPayloadApplication({
    anime: [{ id: 'show-1', title: 'Show 1' }]
  }, {
    filterUi: {
      catalogPage: true,
      deferUsed: false,
      hasFilterParams: true,
      lowMotion: false,
      panelVisible: false,
      urlFiltersApplied: false
    }
  });

  assert.equal(application.state.animeData[0].id, 'show-1');
  assert.deepEqual(application.intent, {
    applyUrlFilters: true,
    replaceUrlFilters: true,
    deferFilterUi: false,
    filterPanel: 'schedule',
    renderQuickFilters: true,
    refreshWatchlistSnapshots: { persist: true },
    scheduleAiringDashboard: { timeout: 3500 },
    applyFilters: { syncUrl: false, updateMeta: false }
  });
});

test('CatalogPayload suppresses filter rendering when low-motion deferral is active', () => {
  const { intent } = CatalogPayload.prepareApplication({ anime: [] }, {
    filterUi: { catalogPage: true, lowMotion: true }
  });

  assert.equal(intent.deferFilterUi, true);
  assert.equal(intent.filterPanel, 'none');
  assert.equal(intent.renderQuickFilters, false);
});
