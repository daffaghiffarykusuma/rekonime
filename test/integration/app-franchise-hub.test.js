import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.js';
import { setupDom } from '../helpers/dom.js';

test('App renders franchise hub guidance with safe catalog actions', () => {
  setupDom(undefined, { url: 'https://example.com/' });

  const anime = {
    id: 'season-2',
    title: 'Example Season 2',
    franchise: {
      id: 'example-series',
      title: 'Example Season 1',
      mode: 'linear',
      entryAnimeId: 'season-1',
      entryTitle: 'Example Season 1',
      totalCount: 3,
      catalogCount: 2,
      mainCount: 2,
      items: [
        {
          animeId: 'season-1',
          title: 'Example Season 1',
          year: 2020,
          format: 'TV',
          bucket: 'main',
          relationType: 'ENTRY',
          isEntry: true,
          isInCatalog: true,
          anchorAnimeId: null,
          anchorTitle: '',
          mainOrder: 1,
          order: 1
        },
        {
          animeId: 'season-2',
          title: 'Example Season 2',
          year: 2022,
          format: 'TV',
          bucket: 'main',
          relationType: 'SEQUEL',
          isEntry: false,
          isInCatalog: true,
          anchorAnimeId: null,
          anchorTitle: '',
          mainOrder: 2,
          order: 2
        },
        {
          animeId: null,
          externalKey: 'anilist:404',
          title: '<script>alert(1)</script>',
          year: 2023,
          format: 'SPECIAL',
          bucket: 'side_story',
          relationType: 'SIDE_STORY',
          isEntry: false,
          isInCatalog: false,
          anchorAnimeId: 'season-2',
          anchorTitle: 'Example Season 2',
          mainOrder: 2,
          order: 3
        }
      ]
    }
  };

  const html = App.renderFranchiseHubSection(anime);

  assert.match(html, /Franchise Hub/);
  assert.match(html, /Start with Example Season 1\. This title is step 2 of 2 in the main story\./);
  assert.match(html, /data-action="open-anime"/);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
