import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogPayload } from '../../src/features/catalog/catalog-payload.ts';
import { Stats } from '../../src/features/discovery/stats.ts';
import { Recommendations } from '../../src/features/discovery/recommendations.ts';

const title = (id: string, overrides = {}) => ({ id, title: id, genres: ['Action'], themes: [], communityScore: 9, stats: { retentionScore: 95 }, ...overrides });
test('Discovery starts with three picks, one per franchise, and reports more when available', () => {
  const source = [title('a'), title('b', { communityScore: 8 }), title('c', { communityScore: 7 }), title('d', { communityScore: 6 })];
  const decision = Recommendations.getRecommendationDecision(source);
  assert.deepEqual(decision.items.map(item => item.id), ['a', 'b', 'c']);
  assert.equal(decision.hasMore, true);
  assert.equal(decision.items[0].fitLabel, 'General pick');
  const expanded = Recommendations.getRecommendationDecision(source, { limit: 6 });
  assert.equal(expanded.items.length, 4);
  assert.equal(expanded.hasMore, false);
  assert.deepEqual(Recommendations.getRecommendationDecision([]).items, []);
});

test('Discovery distinguishes declared episode counts from observed episodes and unknown totals', () => {
  const decision = Recommendations.getRecommendationDecision([
    title('declared', { episodeCount: 12, episodes: [{ episode: 3 }], metadata: { status: 'Currently Airing' } }),
    title('observed', { episodes: [{ episode: 7 }], stats: { episodeCount: 7 } }),
    title('unknown', { episodes: [], stats: { episodeCount: 0 } })
  ]);
  assert.deepEqual(decision.items.map(item => item.episodeSummary), [
    '12 episodes listed', 'Through episode 7 observed · total unknown', 'Episode count unknown'
  ]);
});

test('Discovery preserves partial rating evidence without turning normalized episode counts into declared totals', () => {
  const decision = Recommendations.getRecommendationDecision([title('normalized', {
    episodeCount: 7,
    stats: { episodeCount: 7, retentionScore: 60, ratingEvidence: {
      totalEpisodes: null, ratedEpisodes: 4, limited: true, completion: 'airing'
    } }
  })]);
  assert.equal(decision.items[0].episodeSummary, 'Through episode 7 observed · total unknown');
  assert.equal(Recommendations.getRatingEvidenceLabel(decision.items[0]), 'Limited data · 4 episodes rated · total unknown · Provisional');
});


test('Discovery keeps observed-only totals unknown after catalog normalization and rating recalculation', () => {
  const [anime] = CatalogPayload.normalizeAnimeData([title('observed-only', {
    episodes: [{ episode: 7, score: 4 }], stats: null
  })]);
  assert.ok(anime);
  assert.equal(Recommendations.getRecommendationDecision([anime]).items[0].episodeSummary, 'Through episode 7 observed · total unknown');
  anime.stats = Stats.calculateAllStats(anime, Stats.defaultScoreProfile);
  const [renormalized] = CatalogPayload.normalizeAnimeData([anime]);
  const pick = Recommendations.getRecommendationDecision([renormalized]).items[0];
  assert.equal(pick.episodeSummary, 'Through episode 7 observed · total unknown');
  assert.equal(pick.stats.ratingEvidence.totalEpisodes, null);
  assert.match(Recommendations.getRatingEvidenceLabel(pick), /total unknown/);
});

test('Discovery states missing episode rating evidence without promising future data', () => {
  const pick = Recommendations.getRecommendationDecision([title('unrated', {
    episodes: [], stats: null, communityScore: 7
  })]).items[0];
  assert.equal(pick.fitReason, 'Episode rating data unavailable');
});

test('Discovery does not claim consistent or strong episode ratings from one observed rating', () => {
  const [anime] = CatalogPayload.normalizeAnimeData([title('sparse', {
    episodes: [{ episode: 7, score: 4 }], stats: null, communityScore: 7
  })]);
  assert.ok(anime);
  anime.stats = Stats.calculateAllStats(anime, Stats.defaultScoreProfile);
  const pick = Recommendations.getRecommendationDecision([anime]).items[0];
  assert.equal(pick.fitReason, 'Limited episode rating data');
});
