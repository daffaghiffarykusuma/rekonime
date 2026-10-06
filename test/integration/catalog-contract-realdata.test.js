import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Stats } from '../../src/features/discovery/stats.ts';
import { CatalogPayload } from '../../src/features/catalog/catalog-payload.ts';
import { BrowseFiltering } from '../../src/features/discovery/browse-filtering.ts';

test('compact catalogs preserve title variants, search ranking, and genre search', () => {
  const full = readCatalog('anime.full.json').anime;
  const original = CatalogPayload.normalizeAnimeData(full);
  const compact = CatalogPayload.prepareState({ anime: full.map(({ searchText, detailPath, ...anime }) => anime) }).animeData;
  for (let i = 0; i < original.length; i += 1) {
    assert.deepEqual(compact[i].searchIndex, original[i].searchIndex, original[i].id);
  }
  const ids = entries => entries.map(anime => anime.id);
  for (const query of ['Doraemon', 'ドラえもん', 'Fullmetal Alchemist', '2.5-jigen', 'Steins Gate', '進撃の巨人', 'Action', 'School']) {
    assert.deepEqual(
      ids(BrowseFiltering.findSearchMatches({ animeData: compact, query })),
      ids(BrowseFiltering.findSearchMatches({ animeData: original, query })), query
    );
    assert.deepEqual(
      ids(BrowseFiltering.applyFilters({ animeData: compact, searchQuery: query }).filteredData),
      ids(BrowseFiltering.applyFilters({ animeData: original, searchQuery: query }).filteredData), query
    );
  }
});

test('Python-built rating strength and evidence agree with browser calculations', () => {
  const catalog = readCatalog('anime.full.json');
  for (const anime of catalog.anime) {
    const actual = Stats.calculateAllStats(anime, catalog.scoreProfile);
    assert.equal(actual.retentionScore, anime.stats.retentionScore, anime.id);
    assert.equal(actual.average, anime.stats.average, `${anime.id}: average`);
    assert.equal(actual.stdDev, anime.stats.stdDev, `${anime.id}: stdDev`);
    assert.equal(actual.scoringVersion, 2);
    for (const key of ['ratedEpisodes', 'totalEpisodes', 'coverage', 'positionsKnown', 'limited', 'completion', 'medianVotes']) {
      assert.equal(actual.ratingEvidence[key], anime.stats.ratingEvidence[key], `${anime.id}: ${key}`);
    }
  }
});

const readCatalog = (name) => {
  const filePath = path.join(process.cwd(), 'data', name);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const assertCatalogShape = (catalog, label) => {
  assert.equal(typeof catalog, 'object', `${label} must be an object`);
  assert.equal(Array.isArray(catalog.anime), true, `${label}.anime must be an array`);
  assert.equal(catalog.anime.length > 0, true, `${label}.anime must not be empty`);
  assert.equal(typeof catalog.generatedAt, 'string', `${label}.generatedAt must be a string`);
};

test('real full and preview catalogs satisfy core contract', () => {
  const full = readCatalog('anime.full.json');
  const preview = readCatalog('anime.preview.json');

  assertCatalogShape(full, 'anime.full.json');
  assertCatalogShape(preview, 'anime.preview.json');

  const fullIds = new Set();
  let duplicateIds = 0;
  full.anime.forEach((item, index) => {
    assert.equal(typeof item.id, 'string', `full anime[${index}].id must be string`);
    assert.equal(Boolean(item.id.trim()), true, `full anime[${index}].id must be non-empty`);
    assert.equal(typeof item.title, 'string', `full anime[${index}].title must be string`);
    assert.equal(typeof item.cover, 'string', `full anime[${index}].cover must be string`);
    assert.equal(Array.isArray(item.episodes), true, `full anime[${index}].episodes must be array`);
    if (fullIds.has(item.id)) {
      duplicateIds += 1;
    } else {
      fullIds.add(item.id);
    }

    item.episodes.forEach((episode, epIndex) => {
      assert.equal(Number.isInteger(episode.episode), true, `full ${item.id} episode[${epIndex}].episode must be integer`);
      assert.equal(Number.isFinite(episode.score), true, `full ${item.id} episode[${epIndex}].score must be number`);
      assert.equal(episode.score >= 0 && episode.score <= 10, true, `full ${item.id} episode[${epIndex}].score must be 0..10`);
    });
  });

  preview.anime.forEach((item, index) => {
    assert.equal(fullIds.has(item.id), true, `preview anime[${index}] id not found in full catalog: ${item.id}`);
  });

  // Baseline currently carries a small known duplicate-id debt.
  assert.equal(duplicateIds <= 5, true, `full catalog duplicate id count ${duplicateIds} exceeded baseline cap 5`);
});
