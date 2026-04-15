import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFranchiseMap } from '../../tools/lib/franchise-builder.js';

test('buildFranchiseMap keeps TV seasons as the entry path and demotes side content', () => {
  const catalogAnime = [
    {
      id: 'season-1',
      title: 'Example Season 1',
      anilistId: 101,
      year: 2018,
      type: 'TV'
    },
    {
      id: 'season-2',
      title: 'Example Season 2',
      anilistId: 102,
      year: 2020,
      type: 'TV'
    }
  ];

  const rawNodes = [
    {
      key: 'anilist:101',
      anilistId: 101,
      format: 'TV',
      seasonYear: 2018,
      title: { userPreferred: 'Example Season 1' },
      relations: [
        { relationType: 'SEQUEL', toKey: 'anilist:102' },
        { relationType: 'ALTERNATIVE', toKey: 'anilist:103' },
        { relationType: 'SIDE_STORY', toKey: 'anilist:104' }
      ]
    },
    {
      key: 'anilist:102',
      anilistId: 102,
      format: 'TV',
      seasonYear: 2020,
      title: { userPreferred: 'Example Season 2' },
      relations: [
        { relationType: 'PREQUEL', toKey: 'anilist:101' }
      ]
    },
    {
      key: 'anilist:103',
      anilistId: 103,
      format: 'MOVIE',
      seasonYear: 2019,
      title: { userPreferred: 'Example Recap Movie' },
      relations: [
        { relationType: 'ALTERNATIVE', toKey: 'anilist:101' }
      ]
    },
    {
      key: 'anilist:104',
      anilistId: 104,
      format: 'OVA',
      seasonYear: 2019,
      title: { userPreferred: 'Example OVA' },
      relations: [
        { relationType: 'SIDE_STORY', toKey: 'anilist:101' }
      ]
    }
  ];

  const franchiseMap = buildFranchiseMap(catalogAnime, rawNodes);
  const franchiseId = franchiseMap.byAnimeId['season-1'];
  const franchise = franchiseMap.franchises[franchiseId];

  assert.ok(franchise);
  assert.equal(franchise.entryAnimeId, 'season-1');
  assert.equal(franchise.items[0]?.title, 'Example Season 1');

  const recapMovie = franchise.items.find(item => item.externalKey === 'anilist:103');
  const ova = franchise.items.find(item => item.externalKey === 'anilist:104');
  const season2 = franchise.items.find(item => item.animeId === 'season-2');

  assert.equal(recapMovie?.bucket, 'alternative');
  assert.equal(ova?.bucket, 'side_story');
  assert.equal(ova?.anchorAnimeId, 'season-1');
  assert.ok(season2);
  assert.notEqual(season2?.bucket, 'alternative');
});
