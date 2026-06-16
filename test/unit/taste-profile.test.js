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
