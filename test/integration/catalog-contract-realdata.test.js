import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
