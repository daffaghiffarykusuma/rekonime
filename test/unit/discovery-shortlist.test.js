import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoveryShortlist } from '../../src/features/discovery/discovery-shortlist.ts';
import { createDiscoverySession } from '../../src/features/discovery/discovery-session.ts';
import { createWatchlistLifecycle } from '../../src/features/watchlist/watchlist-state.js';
import { createWatchlistLifecycleRuntime } from '../../src/features/watchlist/watchlist-lifecycle-runtime.ts';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
};

const catalog = Array.from({ length: 8 }, (_, index) => ({
  id: `show-${index + 1}`,
  title: `Show ${index + 1}`,
  cover: 'cover.jpg',
  episodeCount: 12
}));

// Recommendations ranks in catalog order; real ranking has its own tests.
const recommendations = {
  getRecommendationDecision: (source, { limit }) => ({
    items: source.slice(0, limit),
    hasMore: source.length > limit,
    context: 'General picks'
  })
};

const createHarness = ({ discovery = { getSurpriseMe: (source) => source[0]?.anime || null, recordSurprise: () => {} } } = {}) => {
  const lifecycle = createWatchlistLifecycle({ storage: createStorage(), now: () => 1000 });
  const watchlistRuntime = createWatchlistLifecycleRuntime({
    buildSnapshot: (anime) => anime ? { id: anime.id, title: anime.title, cover: anime.cover } : null,
    getAnime: (id) => catalog.find(anime => anime.id === id) || null,
    getLifecycle: () => lifecycle
  });
  const tasteCalls = [];
  const tasteProfile = {
    prepareRecommendationSource: (list, { excludedIds }) => list.filter(anime => !excludedIds.includes(anime.id)),
    prepareDiscoverySource: (list, { excludedIds }) => list.filter(anime => !excludedIds.includes(anime.id))
      .map(anime => ({ anime, weight: 1 })),
    applyRecommendationFeedback: (action, anime) => {
      tasteCalls.push(['apply', action, anime.id]);
      return { changed: true, message: 'Saved preference', undoToken: { action } };
    },
    undoRecommendationFeedback: (token) => {
      tasteCalls.push(['undo', token.action]);
      return { changed: true, message: 'Undid preference' };
    }
  };
  const shortlist = createDiscoveryShortlist({
    session: createDiscoverySession({ storage: createStorage(), now: () => 1000 }),
    findAnime: (id) => catalog.find(anime => anime.id === id) || null,
    getTasteProfile: () => tasteProfile,
    getWatchlistEntries: () => lifecycle.getEntries(),
    getWatchlistRuntime: () => watchlistRuntime,
    recommendations,
    discovery
  });
  return { lifecycle, shortlist, tasteCalls };
};

const ids = (model) => model.items.map(anime => anime.id);

test('the shortlist starts with three picks and More reveals three more', () => {
  const { shortlist } = createHarness();
  assert.deepEqual(ids(shortlist.getModel(catalog)), ['show-1', 'show-2', 'show-3']);
  assert.equal(shortlist.getModel(catalog).hasMore, true);

  const outcome = shortlist.showMore();

  assert.deepEqual(outcome.focus, { target: 'pick', index: 3 });
  assert.equal(outcome.announcement, 'More picks shown.');
  assert.equal(shortlist.getModel(catalog).items.length, 6);
});

test('skipping removes the pick and promotes the next without touching the Watchlist', () => {
  const { lifecycle, shortlist } = createHarness();
  shortlist.getModel(catalog);

  const outcome = shortlist.skip('show-1');

  assert.equal(outcome.changed, true);
  assert.match(outcome.announcement, /Skipped for now: Show 1\. Your taste and Watchlist are unchanged\./);
  assert.deepEqual(outcome.focus, { target: 'latest-dismissal-undo' });
  const model = shortlist.getModel(catalog);
  assert.deepEqual(ids(model), ['show-2', 'show-3', 'show-4']);
  assert.deepEqual(model.dismissed, [{ id: 'show-1', title: 'Show 1' }]);
  assert.equal(lifecycle.getEntries().length, 0);

  assert.equal(shortlist.restore('show-1').changed, true);
  assert.deepEqual(ids(shortlist.getModel(catalog)), ['show-1', 'show-2', 'show-3']);
});

test('saving a pick records a chosen title that Undo removes', () => {
  const { lifecycle, shortlist } = createHarness();

  const saved = shortlist.save('show-2');

  assert.equal(saved.changed, true);
  assert.deepEqual(saved.focus, { target: 'chosen-undo' });
  assert.deepEqual(shortlist.getModel(catalog).chosen, { id: 'show-2', title: 'Show 2', status: 'planned' });
  assert.deepEqual(ids(shortlist.getModel(catalog)), ['show-1', 'show-3', 'show-4']);

  const undone = shortlist.undoSave();

  assert.equal(undone.changed, true);
  assert.deepEqual(undone.focus, { target: 'save', id: 'show-2' });
  assert.equal(lifecycle.getEntry('show-2'), null);
  assert.equal(shortlist.getModel(catalog).chosen, null);
});

test('Undo after a newer Watchlist change is refused and preserves the newer change', () => {
  const { lifecycle, shortlist } = createHarness();
  shortlist.save('show-2');
  lifecycle.setStatus('show-2', 'watching');

  const outcome = shortlist.undoSave();

  assert.equal(outcome.changed, false);
  assert.match(outcome.announcement, /Your newer changes are preserved/);
  assert.match(outcome.error, /Couldn't undo this selection/);
  assert.equal(lifecycle.getEntry('show-2').status, 'watching');
});

test('Surprise Me respects the same exclusions as the shortlist', () => {
  const offered = [];
  const { lifecycle, shortlist } = createHarness({
    discovery: {
      getSurpriseMe: (source) => {
        offered.push(...source.map(entry => entry.anime.id));
        return source[0]?.anime || null;
      },
      recordSurprise: () => {}
    }
  });
  lifecycle.setStatus('show-1', 'completed');
  shortlist.skip('show-2');

  const surprise = shortlist.pickSurprise(catalog);

  assert.equal(surprise.id, 'show-3');
  assert.equal(offered.includes('show-1'), false);
  assert.equal(offered.includes('show-2'), false);
});

test('Already seen finishes the title in the Watchlist; other feedback goes to the Taste Profile with Undo', () => {
  const { lifecycle, shortlist, tasteCalls } = createHarness();

  shortlist.giveFeedback('rec-already-seen', 'show-1');
  assert.equal(lifecycle.getEntry('show-1').status, 'completed');
  assert.equal(lifecycle.getEntry('show-1').progress, 12);

  const liked = shortlist.giveFeedback('rec-more-like', 'show-2');
  assert.equal(liked.changed, true);
  assert.equal(liked.announcement, 'Saved preference');
  const undone = shortlist.undoFeedback(liked.undoToken, 'show-2');
  assert.deepEqual(undone.focus, { target: 'taste', id: 'show-2' });
  assert.deepEqual(tasteCalls, [['apply', 'rec-more-like', 'show-2'], ['undo', 'rec-more-like']]);
  assert.equal(shortlist.giveFeedback('rec-more-like', 'missing').changed, false);
});
