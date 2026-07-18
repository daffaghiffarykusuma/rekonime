import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTasteProfileFromWatchlist,
  createTasteProfileStore,
  scoreAnimeForTaste
} from '../../js/taste-profile.ts';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value))
  };
};

test('taste profile stores explicit positive, negative, and reduced preferences', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage(), now: () => 1000 });
  store.load();

  store.addMoreLike({ id: 'show-1', genres: ['Action'], themes: ['Super Power'] });
  store.addNotForMe({ id: 'show-2', genres: ['Horror'] });
  store.reduceGenre('Horror');

  const profile = store.getProfile();
  assert.deepEqual(profile.explicit.moreLikeTitleIds, ['show-1']);
  assert.deepEqual(profile.explicit.notForMeTitleIds, ['show-2']);
  assert.deepEqual(profile.explicit.preferredGenres, ['Action']);
  assert.deepEqual(profile.explicit.reducedGenres, ['Horror']);
});

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

test('taste score rewards matching preferences and strongly suppresses not-for-me titles', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage(), now: () => 2000 });
  store.load();
  store.addMoreLike({ id: 'liked', genres: ['Adventure'], themes: ['Found Family'] });
  store.addNotForMe({ id: 'blocked', genres: ['Adventure'] });
  const profile = store.getProfile();

  assert.equal(scoreAnimeForTaste({ id: 'candidate', genres: ['Adventure'], themes: ['Found Family'] }, profile) > 0, true);
  assert.equal(scoreAnimeForTaste({ id: 'blocked', genres: ['Adventure'], themes: [] }, profile) < -900, true);
});

test('taste profile owns feedback, recommendation preparation, and settings summary', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage(), now: () => 3000 });
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

  const source = store.prepareRecommendationSource([neutral, blocked, liked], { excludedIds: ['watched'] });
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
  store.addNotForMe({ id: 'blocked', genres: ['Action'] });
  store.reduceGenre('Drama');

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
  store.addMoreLike({ id: 'liked', genres: ['Action'] });
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
