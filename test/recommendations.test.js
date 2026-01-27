const test = require('node:test');
const assert = require('node:assert/strict');
const Recommendations = require('../js/recommendations');

const baseAnime = (overrides = {}) => ({
  id: 'base',
  genres: ['Action', 'Adventure'],
  themes: ['Fantasy'],
  communityScore: 8.6,
  episodes: [{ episode: 1, score: 4 }],
  stats: {
    retentionScore: 90,
    churnRisk: { score: 10 },
    threeEpisodeHook: 85,
    worthFinishing: 75,
    flowState: 88
  },
  ...overrides
});

test('normalizeTagSet trims and deduplicates', () => {
  const set = Recommendations.normalizeTagSet([' Action ', 'Action', '', '  ', 'Drama']);
  assert.deepEqual([...set], ['Action', 'Drama']);
});

test('getSharedTags returns unique shared tags', () => {
  const shared = Recommendations.getSharedTags(new Set(['Action', 'Drama']), ['Drama', 'Action', 'Action']);
  assert.deepEqual(shared, ['Drama', 'Action']);
});

test('computeAlignmentScore returns 1 for identical scores', () => {
  assert.equal(Recommendations.computeAlignmentScore(80, 80, 100), 1);
});

test('combineAlignmentScores returns weighted average', () => {
  const combined = Recommendations.combineAlignmentScores(0.5, 0.25);
  assert.equal(combined, (0.5 * 0.6 + 0.25 * 0.4) / 1);
});

test('getRecommendationReason handles missing episodes with high community score', () => {
  const anime = baseAnime({ episodes: [], stats: {} });
  assert.equal(Recommendations.getRecommendationReason(anime), 'Loved by the community');
});

test('getBadges returns at most two badges', () => {
  const badges = Recommendations.getBadges(baseAnime());
  assert.equal(badges.length, 2);
  assert.equal(badges[0].label, 'Keeps You Hooked');
  assert.equal(badges[1].label, 'Fan Favorite');
});

test('getSimilarAnime returns empty when base themes missing', () => {
  const anime = baseAnime({ themes: [] });
  const result = Recommendations.getSimilarAnime([baseAnime()], anime, 5);
  assert.deepEqual(result, []);
});

test('getRecommendations returns limited results with reasons', () => {
  const list = [
    baseAnime({ id: 'a', stats: { retentionScore: 95, churnRisk: { score: 5 }, threeEpisodeHook: 85 } }),
    baseAnime({ id: 'b', stats: { retentionScore: 70, churnRisk: { score: 30 }, threeEpisodeHook: 70 } }),
    baseAnime({ id: 'c', stats: { retentionScore: 80, churnRisk: { score: 20 }, threeEpisodeHook: 75 } })
  ];
  const result = Recommendations.getRecommendations(list, 2);
  assert.equal(result.length, 2);
  result.forEach(item => {
    assert.equal(typeof item.reason, 'string');
  });
});

test('getSimilarAnime prioritizes strict matches over higher-scoring relaxed matches', () => {
  const base = baseAnime({
    genres: ['Action', 'Adventure'],
    themes: ['Fantasy'],
    communityScore: 10,
    stats: { retentionScore: 100 },
    episodes: [{ episode: 1, score: 5 }]
  });
  const strictMatch = baseAnime({
    id: 'strict',
    genres: ['Action', 'Adventure'],
    themes: ['Fantasy'],
    communityScore: 0,
    stats: { retentionScore: 0 },
    episodes: [{ episode: 1, score: 1 }]
  });
  const relaxedMatch = baseAnime({
    id: 'relaxed',
    genres: ['Action'],
    themes: ['Fantasy'],
    communityScore: 10,
    stats: { retentionScore: 100 },
    episodes: [{ episode: 1, score: 5 }]
  });

  const result = Recommendations.getSimilarAnime([strictMatch, relaxedMatch], base, 2);
  assert.equal(result[0].anime.id, 'strict');
  assert.equal(result[1].anime.id, 'relaxed');
});

test('getSimilarAnime scoring falls back to similarity when scores are missing', () => {
  const base = baseAnime({
    genres: ['Action'],
    themes: ['Fantasy'],
    communityScore: 8,
    stats: { retentionScore: 80 },
    episodes: [{ episode: 1, score: 4 }]
  });
  const candidate = {
    id: 'candidate',
    genres: ['Action'],
    themes: ['Fantasy'],
    episodes: [],
    stats: {},
    communityScore: null
  };

  const result = Recommendations.getSimilarAnime([candidate], base, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].retentionAlignment, null);
  assert.equal(result[0].satisfactionAlignment, null);
  assert.ok(Math.abs(result[0].score - 0.6) < 1e-9);
});

test('getSimilarAnime scoring invariants hold under randomized inputs', () => {
  const makeRng = (seed = 123456789) => {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  };

  const pickTags = (rng, pool, minCount, maxCount, forced = []) => {
    const target = Math.min(
      pool.length,
      minCount + Math.floor(rng() * (maxCount - minCount + 1))
    );
    const selected = new Set(forced);
    while (selected.size < target) {
      selected.add(pool[Math.floor(rng() * pool.length)]);
      if (selected.size === pool.length) break;
    }
    return Array.from(selected);
  };

  const rng = makeRng(42);
  const genrePool = ['Action', 'Drama', 'Comedy', 'Sci-Fi', 'Fantasy', 'Sports'];
  const themePool = ['School', 'Magic', 'Music', 'Space', 'Isekai', 'Romance'];
  const baseGenres = ['Action', 'Drama'];
  const baseThemes = ['Magic', 'School'];
  const base = baseAnime({
    id: 'base-random',
    genres: baseGenres,
    themes: baseThemes,
    communityScore: 8.2,
    stats: { retentionScore: 82 },
    episodes: [{ episode: 1, score: 4 }]
  });

  const candidates = Array.from({ length: 40 }, (_, index) => {
    const shareGenre = rng() < 0.6;
    const shareTheme = rng() < 0.6;
    const genres = pickTags(rng, genrePool, 0, 3, shareGenre ? [baseGenres[0]] : []);
    const themes = pickTags(rng, themePool, 0, 2, shareTheme ? [baseThemes[0]] : []);
    const hasEpisodes = rng() < 0.8;
    const episodes = hasEpisodes
      ? Array.from({ length: 1 + Math.floor(rng() * 5) }, () => ({
        episode: 1,
        score: 1 + Math.round(rng() * 4)
      }))
      : [];
    const retentionScore = hasEpisodes ? Math.round(rng() * 100) : undefined;
    const communityScore = rng() < 0.7 ? Math.round((6 + rng() * 4) * 10) / 10 : null;

    return {
      id: `candidate-${index}`,
      genres,
      themes,
      episodes,
      stats: { retentionScore },
      communityScore
    };
  });

  candidates[0] = {
    id: 'forced-match',
    genres: ['Action', 'Drama'],
    themes: ['Magic'],
    episodes: [{ episode: 1, score: 4 }],
    stats: { retentionScore: 50 },
    communityScore: 7.5
  };

  const limit = 15;
  const result = Recommendations.getSimilarAnime(candidates, base, limit);

  const baseGenreSet = new Set(baseGenres);
  const baseThemeSet = new Set(baseThemes);
  const eligibleCount = candidates.filter(candidate => {
    const sharesGenre = candidate.genres.some(tag => baseGenreSet.has(tag));
    const sharesTheme = candidate.themes.some(tag => baseThemeSet.has(tag));
    return sharesGenre && sharesTheme && candidate.id !== base.id;
  }).length;

  const minSharedGenres = baseGenres.length >= 2 ? 2 : 1;
  let seenRelaxed = false;

  assert.ok(result.length <= limit);
  assert.ok(result.length <= eligibleCount);

  result.forEach(entry => {
    assert.ok(entry.sharedGenres.length > 0);
    assert.ok(entry.sharedThemes.length > 0);

    assert.ok(Number.isFinite(entry.score));
    assert.ok(entry.score >= 0 && entry.score <= 1);
    assert.ok(entry.similarityScore >= 0 && entry.similarityScore <= 1);

    if (entry.retentionAlignment !== null) {
      assert.ok(entry.retentionAlignment >= 0 && entry.retentionAlignment <= 1);
    } else {
      const hasEpisodes = Array.isArray(entry.anime.episodes) && entry.anime.episodes.length > 0;
      const retention = entry.anime.stats?.retentionScore;
      assert.ok(!hasEpisodes || !Number.isFinite(retention));
    }

    if (entry.satisfactionAlignment !== null) {
      assert.ok(entry.satisfactionAlignment >= 0 && entry.satisfactionAlignment <= 1);
    } else {
      assert.ok(!Number.isFinite(entry.anime.communityScore));
    }

    if (entry.sharedGenres.length < minSharedGenres) {
      seenRelaxed = true;
    } else if (seenRelaxed) {
      assert.fail('Strict matches should appear before relaxed matches.');
    }
  });
});
