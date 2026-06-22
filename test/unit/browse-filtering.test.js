import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowseFiltering } from '../../js/browse-filtering.ts';

test('Browse View Filtering parses and canonicalizes URL filters', () => {
  const filters = BrowseFiltering.getFiltersFromUrl(
    'https://example.test/?genre=action,Drama&theme=Fantasy&year=2024&genre=ACTION',
    {
      filterOptions: {
        ...BrowseFiltering.getDefaultFilterOptions(),
        genres: ['Action', 'Drama'],
        themes: ['Fantasy'],
        year: ['2024']
      }
    }
  );

  assert.deepEqual(filters.genres, ['Action', 'Drama']);
  assert.deepEqual(filters.themes, ['Fantasy']);
  assert.deepEqual(filters.year, ['2024']);
});

test('Browse View Filtering extracts sorted facet options from catalog entries', () => {
  const options = BrowseFiltering.extractFilterOptions([
    {
      id: 'a',
      season: 'Spring',
      year: 2024,
      studio: ['Studio B', 'Studio A'],
      source: 'Manga',
      genres: ['Drama'],
      themes: ['School'],
      demographic: 'Shounen'
    },
    {
      id: 'b',
      season: 'Fall',
      year: 2025,
      studio: 'Studio C',
      source: 'Original',
      genres: ['Action'],
      themes: ['Fantasy']
    }
  ]);

  assert.deepEqual(options.seasonYear, ['Fall 2025', 'Spring 2024']);
  assert.deepEqual(options.year, [2025, 2024]);
  assert.deepEqual(options.studio, ['Studio A', 'Studio B', 'Studio C']);
  assert.deepEqual(options.genres, ['Action', 'Drama']);
});

test('Browse View Filtering applies facet and search filters through one interface', () => {
  const animeData = [
    { id: 'a', title: 'Action School', season: 'Spring', year: 2024, studio: 'Studio A', source: 'Manga', genres: ['Action'], themes: ['School'], demographic: 'Shounen' },
    { id: 'b', title: 'Action Space', season: 'Spring', year: 2024, studio: 'Studio A', source: 'Manga', genres: ['Action'], themes: ['Space'], demographic: 'Shounen' },
    { id: 'c', title: 'Drama School', season: 'Winter', year: 2023, studio: 'Studio B', source: 'Novel', genres: ['Drama'], themes: ['School'], demographic: 'Josei' }
  ];

  const result = BrowseFiltering.applyFilters({
    animeData,
    activeFilters: {
      ...BrowseFiltering.getDefaultActiveFilters(),
      genres: ['Action'],
      themes: ['School']
    },
    searchQuery: 'school'
  });

  assert.deepEqual(result.filteredData.map(item => item.id), ['a']);
  assert.equal(result.lastAppliedSearchQuery, 'school');
});

test('Browse View Filtering owns ranked search matching and metadata inputs', () => {
  const animeData = [
    { id: 'a', title: 'Blue Lock', genres: ['Sports'] },
    { id: 'b', title: 'Blue Period', themes: ['Visual Arts'] },
    { id: 'c', title: 'Lockdown Drama', genres: ['Drama'] }
  ];

  assert.deepEqual(
    BrowseFiltering.findSearchMatches({ animeData, query: 'blue', limit: 2 }).map(item => item.id),
    ['a', 'b']
  );

  const meta = BrowseFiltering.buildFilterMeta({
    activeFilters: BrowseFiltering.getDefaultActiveFilters(),
    searchQuery: 'blue',
    siteName: 'Rekonime',
    defaultTitle: 'Rekonime',
    defaultDescription: 'Find anime.'
  });
  assert.equal(meta.title, 'Search: blue | Rekonime');
  assert.match(meta.description, /Anime filtered by Search: blue/);
});

test('Browse View Filtering builds active filter summary items', () => {
  const items = BrowseFiltering.buildActiveFilterItems({
    activeFilters: {
      ...BrowseFiltering.getDefaultActiveFilters(),
      genres: ['Action'],
      seasonYear: ['Spring 2024']
    },
    searchQuery: 'score'
  });

  assert.deepEqual(items.map(item => [item.type, item.value]), [
    ['search', 'score'],
    ['seasonYear', 'Spring 2024'],
    ['genres', 'Action']
  ]);
});
