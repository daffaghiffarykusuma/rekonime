import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewsService } from '../../js/reviews.js';
import { CircuitBreaker } from '../../js/circuitBreaker.js';

test('ReviewsService sanitizeReviewText removes markup', () => {
  const raw = '<p>Hello<br>World</p> ~!spoiler!~ [img]http://x/y.png[/img]';
  const cleaned = ReviewsService.sanitizeReviewText(raw);
  assert.equal(cleaned.includes('<'), false);
  assert.equal(cleaned.includes('spoiler'), true);
  assert.equal(cleaned.includes('http://x/y.png'), false);
});

test('ReviewsService decodeHtmlEntities decodes basic entities', () => {
  const decoded = ReviewsService.decodeHtmlEntities('Fish &amp; Chips &#39;Test&#39;');
  assert.equal(decoded, "Fish & Chips 'Test'");
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
});

test('ReviewsService buildReviewSummary trims long text', () => {
  const raw = 'Sentence one. ' + 'word '.repeat(80);
  const summary = ReviewsService.buildReviewSummary(raw);
  assert.ok(summary.length <= 180);
  assert.ok(summary.endsWith('.') || summary.endsWith('...'));
});

test('ReviewsService normalizeReviewScore and sentiment', () => {
  const normalized = ReviewsService.normalizeReviewScore(8.5);
  assert.equal(normalized, 85);
  assert.equal(ReviewsService.getReviewSentiment(85), 'positive');
  assert.equal(ReviewsService.getReviewSentiment(55), 'neutral');
  assert.equal(ReviewsService.getReviewSentiment(20), 'negative');
});

test('ReviewsService categorizeReviews dedupes and limits', () => {
  const longBody = 'Great show. '.repeat(20);
  const reviews = [
    { mal_id: 1, score: 9, review: longBody, reactions: { nice: 5 } },
    { mal_id: 1, score: 9, review: longBody, reactions: { nice: 10 } },
    { mal_id: 2, score: 6, review: longBody, reactions: { nice: 2 } },
    { mal_id: 3, score: 2, review: longBody, reactions: { nice: 1 } }
  ];

  const categorized = ReviewsService.categorizeReviews(reviews);
  assert.equal(categorized.positive.length, 1);
  assert.equal(categorized.neutral.length, 1);
  assert.equal(categorized.negative.length, 1);
});

test('ReviewsService fetchReviews returns cached result when available', async () => {
  CircuitBreaker.reset('jikan-api');
  const originalApi = ReviewsService.getApiClient;
  let apiCalled = false;
  ReviewsService.getApiClient = () => ({
    getServiceJson: async () => {
      apiCalled = true;
      return { data: [] };
    }
  });

  ReviewsService.setCacheEntry(100, { positive: [], neutral: [], negative: [], description: '' });
  const result = await ReviewsService.fetchReviews(100, 'Title');

  assert.equal(apiCalled, false);
  assert.equal(Array.isArray(result.positive), true);

  ReviewsService.getApiClient = originalApi;
});
