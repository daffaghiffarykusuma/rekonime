import test from 'node:test';
import assert from 'node:assert/strict';
import { Recommendations } from '../../src/features/discovery/recommendations.ts';
import { prepareDiscoveryCandidates } from '../../src/features/discovery/recommendation-eligibility.ts';
import { buildContinueWatchingModel } from '../../src/features/watchlist/continue-watching.ts';
import { createTasteProfileStore } from '../../src/features/preferences/taste-profile.ts';

const franchise = { id: 'series', mode: 'linear', entryAnimeId: 'first', items: [
  { animeId: 'first', bucket: 'main', mainOrder: 1 },
  { animeId: 'second', bucket: 'main', mainOrder: 2 },
  { animeId: 'third', bucket: 'main', mainOrder: 3 }
] };
const shows = ['first', 'second', 'third'].map((id, index) => ({ id, title: id, franchise, communityScore: 8 + index / 10, genres: ['Action'], themes: ['Fantasy'], stats: { retentionScore: 80 + index }, episodes: [{ episode: 1, score: 4 }] }));

test('continuations need completed prerequisites and recommendations show one title per franchise', () => {
  assert.deepEqual(prepareDiscoveryCandidates(shows).map(a => a.id), ['first']);
  assert.deepEqual(prepareDiscoveryCandidates(shows, [{ id: 'first', status: 'watching' }]).map(a => a.id), ['first']);
  const watched = [{ id: 'first', status: 'completed' }];
  assert.deepEqual(prepareDiscoveryCandidates(shows, watched).map(a => a.id), ['first', 'second']);
  const picks = Recommendations.getRecommendationDecision([...shows, { ...shows[0], id: 'standalone', franchise: undefined }], { watchlistEntries: watched });
  assert.equal(picks.items.filter(a => a.franchise).length, 1);
  assert.ok(picks.items.some(a => a.id === 'standalone'));
  assert.ok(!picks.items.some(a => a.id === 'third'));
  const branch = shows.map(a => ({ ...a, franchise: { ...franchise, mode: 'branched' } }));
  assert.deepEqual(prepareDiscoveryCandidates(branch).map(a => a.id), ['first']);
  const because = Recommendations.getBecauseYouWatched(shows, ['first'], 6, watched);
  assert.deepEqual(because.recommendations.map(a => a.id), ['second']);
});

test('rating-only patterns cannot claim gentle mood or positive taste fit', () => {
  assert.deepEqual(Recommendations.getExperienceCues({ genres: [], themes: [], stats: { comfortScore: 100, emotionalStability: 100 } }), []);
  const data = new Map();
  const storage = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const store = createTasteProfileStore({ storage, now: () => 1000 });
  store.load();
  store.applyRecommendationFeedback('rec-more-like', { id: 'liked', genres: ['Action'] });
  store.applyRecommendationFeedback('rec-less-tag', { id: 'reduced', genres: ['Adventure'] }, { genre: 'Adventure' });
  const [candidate] = store.prepareRecommendationSource([{ id: 'candidate', genres: ['Action', 'Adventure'], themes: [] }]);
  assert.ok(candidate.tasteScore < 0);
  assert.equal(candidate.tasteReason, '');
  store.updateInferredFromWatchlist([{ id: 'watched', status: 'completed', snapshot: { genres: ['Drama'] } }]);
  assert.equal(JSON.parse(data.get('rekonime.tasteProfile')).inferred, undefined);
  const legacy = JSON.parse(data.get('rekonime.tasteProfile'));
  legacy.inferred = { positiveGenres: [{ label: 'Fake legacy preference', weight: 100 }] };
  data.set('rekonime.tasteProfile', JSON.stringify(legacy));
  const reload = createTasteProfileStore({ storage });
  reload.load();
  assert.deepEqual(reload.getProfile().inferred.positiveGenres, []);
});

test('continue watching sorts recent active progress and uses the canonical episode total', () => {
  const model = buildContinueWatchingModel([
    { id: 'done', status: 'completed', progress: 12, updatedAt: 5000 },
    { id: 'first', status: 'watching', progress: 4, updatedAt: 1000, snapshot: { title: 'First', stats: { episodeCount: 4 } } },
    { id: 'unknown', status: 'watching', progress: 2, updatedAt: 2000, snapshot: { title: 'Unknown' } }
  ], [{ id: 'first', title: 'First', episodes: [{ episode: 12 }] }]);
  assert.deepEqual(model.map(a => a.id), ['unknown', 'first']);
  assert.equal(model[0]!.episodeCount, null);
  assert.equal(model[1]!.episodeCount, 12);
  assert.equal(model[1]!.complete, false);
});
