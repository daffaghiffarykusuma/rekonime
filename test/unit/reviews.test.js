import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewsService } from '../../src/features/detail/reviews.js';

test('ReviewsService sanitizeReviewText removes markup', () => {
  const raw = '<p>Hello<br>World &amp; &#39;friends&#39;</p> ~!spoiler!~ [img]http://x/y.png[/img]';
  const cleaned = ReviewsService.sanitizeReviewText(raw);
  assert.equal(cleaned.includes('<'), false);
  assert.equal(cleaned.includes('spoiler'), true);
  assert.equal(cleaned.includes('http://x/y.png'), false);
  assert.ok(cleaned.includes("World & 'friends'"));
});

test('ReviewsService review links stay on MyAnimeList hosts', () => {
  assert.equal(
    ReviewsService.sanitizeUrl('https://myanimelist.net/reviews.php?id=123'),
    'https://myanimelist.net/reviews.php?id=123'
  );
  assert.equal(
    ReviewsService.sanitizeUrl('https://www.myanimelist.net/reviews.php?id=123'),
    'https://www.myanimelist.net/reviews.php?id=123'
  );
  assert.equal(ReviewsService.sanitizeUrl('https://evil.example/reviews.php?id=123'), '');
  assert.equal(ReviewsService.sanitizeUrl('https://reviews.myanimelist.net/reviews.php?id=123'), '');
  assert.equal(ReviewsService.sanitizeUrl('https://anilist.co/review/7'), 'https://anilist.co/review/7');
});

test('ReviewsService categorizeReviews dedupes and limits', () => {
  const longBody = 'Great show. '.repeat(20);
  const reviews = [
    { mal_id: 1, score: 8.5, review: longBody, reactions: { nice: 5 } },
    { mal_id: 1, score: 9, review: longBody, reactions: { nice: 10 } },
    { mal_id: 2, score: 5.5, review: 'word '.repeat(80), reactions: { nice: 2 } },
    { mal_id: 3, score: 2, review: longBody, reactions: { nice: 1 } }
  ];

  const categorized = ReviewsService.categorizeReviews(reviews);
  assert.equal(categorized.positive.length, 1);
  assert.equal(categorized.neutral.length, 1);
  assert.equal(categorized.negative.length, 1);
  assert.equal(categorized.positive[0].score, 85);
  assert.equal(categorized.neutral[0].score, 55);
  assert.equal(categorized.negative[0].score, 20);
  assert.equal(categorized.positive[0].summary, 'Great show.');
  assert.ok(categorized.neutral[0].summary.length <= 180);
  assert.ok(categorized.neutral[0].summary.endsWith('...'));
});

test('ReviewsService fetchReviews returns cached result when available', async () => {
  const originalRequestJson = ReviewsService.requestJson;
  let apiCalled = false;
  ReviewsService.requestJson = async () => {
    apiCalled = true;
    return { data: [] };
  };

  ReviewsService.setCacheEntry(100, { positive: [], neutral: [], negative: [], description: '' });
  const result = await ReviewsService.fetchReviews(100, 'Title');

  assert.equal(apiCalled, false);
  assert.equal(Array.isArray(result.positive), true);

  ReviewsService.requestJson = originalRequestJson;
});

test('ReviewsService falls back to AniList when Jikan reviews time out', async () => {
  const originalRequestJson = ReviewsService.requestJson;
  const originalRequestAniListJson = ReviewsService.requestAniListJson;
  ReviewsService.cache.clear();
  ReviewsService.retryAttempts.clear();
  ReviewsService.nextJikanRequestAt = 0;

  ReviewsService.requestJson = async () => {
    const error = new Error('API request failed: 504');
    error.status = 504;
    throw error;
  };
  ReviewsService.requestAniListJson = async () => ({
    data: {
      Media: {
        description: 'AniList synopsis',
        reviews: {
          nodes: [{
            id: 7,
            summary: 'Worth watching.',
            body: 'Strong characters and thoughtful pacing. '.repeat(5),
            score: 90,
            rating: 12,
            user: { name: 'Reviewer', avatar: { medium: 'https://s4.anilist.co/avatar.jpg' } },
            siteUrl: 'https://anilist.co/review/7',
            createdAt: 1_700_000_000
          }]
        }
      }
    }
  });

  try {
    const result = await ReviewsService.fetchReviews(5114, 'Fullmetal Alchemist: Brotherhood');
    assert.equal(result.error, undefined);
    assert.equal(result.source, 'AniList');
    assert.equal(result.positive.length, 1);
    assert.equal(result.description, 'AniList synopsis');
    assert.match(ReviewsService.renderReviewsSection(result), /Reviews from <a[^>]+>AniList<\/a>/);
  } finally {
    ReviewsService.requestJson = originalRequestJson;
    ReviewsService.requestAniListJson = originalRequestAniListJson;
    ReviewsService.cache.clear();
    ReviewsService.retryAttempts.clear();
  }
});
