import test from 'node:test';
import assert from 'node:assert/strict';
import { Recommendations } from '../../src/features/discovery/recommendations.ts';

const title = (id: string, overrides = {}) => ({ id, title: id, genres: ['Action'], themes: [], communityScore: 9, stats: { retentionScore: 95 }, ...overrides });
const unwind = { key: 'unwind', label: 'Help me unwind', description: 'Genre-based suggestions.' };

test('Discovery starts with three picks and prioritizes supported goal matches over stronger general ratings', () => {
  const source = [title('general-a'), title('general-b'), title('general-c'), title('gentle', {
    genres: ['Slice of Life'], communityScore: 5, stats: { retentionScore: 10 }
  })];
  const decision = Recommendations.getRecommendationDecision(source, { viewingIntent: unwind });
  assert.deepEqual(decision.items.map(item => [item.id, item.group]), [
    ['gentle', 'intent'], ['general-a', 'alternative'], ['general-b', 'alternative']
  ]);
  assert.equal(decision.hasMore, true);
  assert.equal(decision.noCloseMatches, false);
  assert.match(decision.items[0].fitReason, /slice-of-life/);
  const expanded = Recommendations.getRecommendationDecision(source, { viewingIntent: unwind, limit: 6 });
  assert.equal(expanded.items.length, 4);
  assert.equal(expanded.hasMore, false);
});

test('Discovery identifies no matches, no eligible titles, and general exploration honestly', () => {
  const source = [title('dark', { genres: ['Slice of Life', 'Horror'], tasteReason: 'You like this genre', tasteScore: 100 })];
  const alternatives = Recommendations.getRecommendationDecision(source, { viewingIntent: unwind });
  assert.equal(alternatives.noCloseMatches, true);
  assert.equal(alternatives.items[0].group, 'alternative');
  assert.equal(alternatives.items[0].fitLabel, 'General alternative');
  assert.equal(alternatives.hasMore, false);
  const empty = Recommendations.getRecommendationDecision([], { viewingIntent: unwind });
  assert.equal(empty.noCloseMatches, true);
  assert.deepEqual(empty.items, []);
  for (const viewingIntent of [null, { key: 'surprise' }]) {
    const general = Recommendations.getRecommendationDecision(source, { viewingIntent });
    assert.equal(general.noCloseMatches, false);
    assert.equal(general.items[0].group, 'general');
  }
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
