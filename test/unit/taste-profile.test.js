import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTasteProfileFromWatchlist,
  createTasteProfileStore
} from '../../src/features/preferences/taste-profile.ts';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value))
  };
};

test('taste profile infers weighted evidence without treating completed as loved', () => {
  const inferred = buildTasteProfileFromWatchlist([
    {
      id: 'completed',
      status: 'completed',
      snapshot: { genres: ['Drama'], themes: ['Coming of Age'] }
    },
    {
      id: 'loved',
      status: 'completed',
      loved: true,
      snapshot: { genres: ['Drama'], themes: ['Music'] }
    },
    {
      id: 'dropped',
      status: 'dropped',
      snapshot: { genres: ['Horror'], themes: ['Gore'] }
    }
  ]);

  assert.equal(inferred.positiveGenres.find(item => item.label === 'Drama').weight, 8);
  assert.equal(inferred.positiveThemes.find(item => item.label === 'Music').weight, 5);
  assert.equal(inferred.negativeThemes.find(item => item.label === 'Gore').weight, 3);
});

test('taste profile owns feedback, recommendation preparation, and settings summary', () => {
  const storage = createMemoryStorage();
  const store = createTasteProfileStore({ storage, now: () => 3000 });
  store.load();
  const liked = { id: 'liked', title: 'Liked', genres: ['Action'], themes: ['School'] };
  const blocked = { id: 'blocked', title: 'Blocked', genres: ['Action'], themes: [] };
  const neutral = { id: 'neutral', title: 'Neutral', genres: ['Drama'], themes: [] };

  assert.deepEqual(store.applyRecommendationFeedback('rec-more-like', liked), {
    changed: true,
    message: 'More like Liked added to your Taste Profile.'
  });
  store.applyRecommendationFeedback('rec-not-for-me', blocked);
  store.applyRecommendationFeedback('rec-less-tag', neutral, { genre: 'Drama' });

  const reloaded = createTasteProfileStore({ storage });
  reloaded.load();
  const profile = reloaded.getProfile();
  assert.deepEqual(profile.explicit.moreLikeTitleIds, ['liked']);
  assert.deepEqual(profile.explicit.notForMeTitleIds, ['blocked']);
  assert.deepEqual(profile.explicit.preferredGenres, ['Action']);
  assert.deepEqual(profile.explicit.reducedGenres, ['Drama']);

  const source = reloaded.prepareRecommendationSource([neutral, blocked, liked], { excludedIds: ['watched'] });
  assert.deepEqual(source.map(item => item.id), ['liked', 'neutral']);
  assert.equal(source[0].tasteScore > source[1].tasteScore, true);
  assert.deepEqual(store.getSettingsSummary(), {
    preferredTags: ['Action', 'School'],
    reducedTags: ['Drama'],
    inferredTags: [],
    hiddenCount: 1
  });
});

test('Taste Profile prepares weighted Discovery candidates from Watchlist Lifecycle evidence', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage(), now: () => 3500 });
  store.load();
  store.updateInferredFromWatchlist([{
    id: 'completed',
    status: 'completed',
    snapshot: { genres: ['Action'], themes: ['Fantasy'] }
  }]);
  store.applyRecommendationFeedback('rec-not-for-me', { id: 'blocked', title: 'Blocked', genres: ['Action'] });
  store.applyRecommendationFeedback('rec-less-tag', { id: 'drama', title: 'Drama' }, { genre: 'Drama' });

  const source = store.prepareDiscoverySource([
    { id: 'neutral', genres: ['Drama'], themes: [] },
    { id: 'preferred', genres: ['Action'], themes: ['Fantasy'] },
    { id: 'blocked', genres: ['Action'], themes: [] },
    { id: 'watched', genres: ['Action'], themes: ['Fantasy'] }
  ], { excludedIds: ['watched'] });

  assert.deepEqual(source.map(entry => ({ id: entry.anime.id, weight: entry.weight })), [
    { id: 'preferred', weight: 1.6 },
    { id: 'neutral', weight: 0.1 }
  ]);
});

test('taste profile reset preserves evidence learned from Watchlist Lifecycle', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage(), now: () => 4000 });
  store.load();
  store.applyRecommendationFeedback('rec-more-like', { id: 'liked', title: 'Liked', genres: ['Action'] });
  store.reset([{
    id: 'completed',
    status: 'completed',
    snapshot: { genres: ['Drama'], themes: ['Coming of Age'] }
  }]);

  assert.deepEqual(store.getSettingsSummary(), {
    preferredTags: [],
    reducedTags: [],
    inferredTags: ['Drama', 'Coming of Age'],
    hiddenCount: 0
  });
});
