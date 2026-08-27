import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../js/app.ts';
import { Discovery } from '../../js/discovery.js';

test('App routes Surprise Me candidates through Taste Profile before Discovery', () => {
  const original = {
    animeData: App.animeData,
    getTasteProfileStore: App.getTasteProfileStore,
    getWatchlistLifecycle: App.getWatchlistLifecycle,
    showAnimeDetail: App.showAnimeDetail,
    getSurpriseMe: Discovery.getSurpriseMe,
    recordSurprise: Discovery.recordSurprise
  };
  const calls = [];
  const candidate = { id: 'preferred', title: 'Preferred' };

  try {
    App.animeData = [candidate];
    App.getWatchlistLifecycle = () => ({ getIds: () => ['watched'] });
    App.getTasteProfileStore = () => ({
      prepareDiscoverySource: (anime, options) => {
        calls.push(['prepare', anime, options]);
        return [{ anime: candidate, weight: 2 }];
      }
    });
    Discovery.getSurpriseMe = (source) => {
      calls.push(['discover', source]);
      return candidate;
    };
    Discovery.recordSurprise = (id) => calls.push(['track', id]);
    App.showAnimeDetail = (id) => calls.push(['show', id]);

    App.showSurpriseMe();

    assert.deepEqual(calls.map(call => call[0]), ['prepare', 'discover', 'track', 'show']);
    assert.deepEqual(calls[0][2], { excludedIds: ['watched'] });
  } finally {
    App.animeData = original.animeData;
    App.getTasteProfileStore = original.getTasteProfileStore;
    App.getWatchlistLifecycle = original.getWatchlistLifecycle;
    App.showAnimeDetail = original.showAnimeDetail;
    Discovery.getSurpriseMe = original.getSurpriseMe;
    Discovery.recordSurprise = original.recordSurprise;
  }
});
