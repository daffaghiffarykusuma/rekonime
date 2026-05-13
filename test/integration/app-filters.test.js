import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.js';
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
