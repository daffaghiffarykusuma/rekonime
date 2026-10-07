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

  assert.equal(store.applyRecommendationFeedback('rec-more-like', liked).changed, true);
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

test('lasting feedback Undo restores only affected evidence and persists the result', () => {
  const storage = createMemoryStorage();
  const store = createTasteProfileStore({ storage });
  store.load();
  const title = { id: 'chosen', title: 'Chosen', genres: ['Action'], themes: ['School'] };
  store.applyRecommendationFeedback('rec-more-like', title);
  const hidden = store.applyRecommendationFeedback('rec-not-for-me', title);
  store.applyRecommendationFeedback('rec-less-tag', { id: 'other' }, { genre: 'Horror' });
  store.updateInferredFromWatchlist([{ id: 'seen', status: 'completed', snapshot: { genres: ['Drama'] } }]);
  assert.equal(store.prepareRecommendationSource([title]).length, 0);
  assert.equal(store.undoRecommendationFeedback(hidden.undoToken).changed, true);
  assert.deepEqual(store.getSettingsSummary(), {
    preferredTags: ['Action', 'School'], reducedTags: ['Horror'], inferredTags: ['Drama'], hiddenCount: 0
  });
  const reloaded = createTasteProfileStore({ storage });
  reloaded.load();
  assert.equal(reloaded.prepareRecommendationSource([title])[0].id, 'chosen');
  assert.deepEqual(reloaded.getProfile().explicit.moreLikeTitleIds, ['chosen']);
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

test('Undo preserves newer feedback that shares preference evidence even when membership is unchanged', () => {
  const store = createTasteProfileStore({ storage: createMemoryStorage() });
  store.load();
  const first = store.applyRecommendationFeedback('rec-more-like', { id: 'first', genres: ['Action'] });
  store.applyRecommendationFeedback('rec-more-like', { id: 'second', genres: ['Action'] });
  const undone = store.undoRecommendationFeedback(first.undoToken);
  assert.equal(undone.changed, false);
  assert.match(undone.message, /changed/);
  assert.deepEqual(store.getProfile().explicit.preferredGenres, ['Action']);
  assert.deepEqual(store.getProfile().explicit.moreLikeTitleIds, ['first', 'second']);
});

test('Undo refuses to replace preferences changed by another store or personal-data restore', () => {
  const storage = createMemoryStorage();
  const store = createTasteProfileStore({ storage });
  store.load();
  const hidden = store.applyRecommendationFeedback('rec-not-for-me', { id: 'first' });
  const other = createTasteProfileStore({ storage });
  other.load();
  other.applyRecommendationFeedback('rec-more-like', { id: 'second', genres: ['Drama'] });
  assert.equal(store.undoRecommendationFeedback(hidden.undoToken).changed, false);
  other.load();
  assert.deepEqual(other.getProfile().explicit.moreLikeTitleIds, ['second']);
  store.load();
  const another = store.applyRecommendationFeedback('rec-not-for-me', { id: 'third' });
  store.commitProfile(store.getProfile());
  assert.equal(store.undoRecommendationFeedback(another.undoToken).changed, false);
});

for (const failure of ['refuse', 'throw']) {
  test(`feedback and Undo preserve live and persisted preferences when storage will ${failure}`, () => {
    const storage = createMemoryStorage();
    const write = storage.setItem;
    let reject = false;
    storage.setItem = (key, value) => {
      if (!reject) return write(key, value);
      if (failure === 'throw') throw new Error('Storage unavailable');
      return false;
    };
    const store = createTasteProfileStore({ storage });
    store.load();
    const title = { id: 'chosen', title: 'Chosen' };
    reject = true;
    assert.equal(store.applyRecommendationFeedback('rec-not-for-me', title).changed, false);
    assert.equal(store.prepareRecommendationSource([title]).length, 1);
    reject = false;
    const result = store.applyRecommendationFeedback('rec-not-for-me', title);
    reject = true;
    assert.equal(store.undoRecommendationFeedback(result.undoToken).changed, false);
    assert.equal(store.prepareRecommendationSource([title]).length, 0);
    const reloaded = createTasteProfileStore({ storage });
    reloaded.load();
    assert.equal(reloaded.prepareRecommendationSource([title]).length, 0);
    reject = false;
    assert.equal(store.undoRecommendationFeedback(result.undoToken).changed, true);
    assert.equal(store.applyRecommendationFeedback('rec-already-seen', title).changed, false);
  });
}

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
