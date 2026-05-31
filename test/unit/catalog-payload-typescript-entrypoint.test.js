import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogPayload } from '../../js/services/catalog-payload.ts';

test('TypeScript Catalog Payload entrypoint prepares render-ready state', () => {
  const state = CatalogPayload.prepareState(
    {
      scoreProfile: { p35: 3.1, p50: 4.2, p65: 4.8 },
      anime: [{
        id: 'catalog-entry',
        title: 'Catalog Entry',
        genres: [' Action ', 'Action'],
        episodes: [{ episode: 12, score: 5 }]
      }]
    },
    {
      isFull: true,
      preserveFilters: true,
      validator: null
    }
  );

  assert.equal(state.catalogStatus, 'full');
  assert.equal(state.scoreProfile.p50, 4.2);
  assert.equal(state.animeData[0].id, 'catalog-entry');
  assert.deepEqual(state.animeData[0].genres, ['Action']);
  assert.equal(state.animeData[0].episodeCount, 12);
});
