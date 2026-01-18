/**
 * Reviews Service - Fetches and categorizes reviews from AniList
 */
const ReviewsService = {
  API_URL: 'https://graphql.anilist.co',

  // Cache to avoid repeated API calls
  cache: new Map(),

  /**
   * GraphQL query to fetch reviews and description for an anime
   */
  REVIEWS_QUERY: `
    query ($id: Int, $search: String) {
      Media(id: $id, search: $search, type: ANIME) {
        id
        title {
          romaji
          english
        }
        description(asHtml: false)
        reviews(limit: 15, sort: RATING_DESC) {
          nodes {
            id
            summary
            body
            score
            rating
            ratingAmount
            user {
              name
              avatar {
                medium
              }
            }
            siteUrl
            createdAt
          }
        }
      }
    }
  `,

  /**
   * Fetch reviews and description from AniList API
   * @param {number|null} anilistId - AniList media ID
   * @param {string} title - Anime title for search fallback
   * @returns {Promise<Object>} Categorized reviews and description
   */
  async fetchReviews(anilistId, title) {
    const cacheKey = anilistId || title;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const variables = anilistId ? { id: anilistId } : { search: title };

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: this.REVIEWS_QUERY,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'GraphQL error');
      }

      const media = data.data?.Media;
      const reviews = media?.reviews?.nodes || [];
      const description = media?.description || '';
      const categorized = this.categorizeReviews(reviews);

      const result = {
        ...categorized,
        description
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      return { positive: [], neutral: [], negative: [], description: '', error: true };
    }
  },

  /**
   * Categorize reviews by sentiment based on score
   * Positive: >= 70, Neutral: 50-69, Negative: < 50
   * @param {Array} reviews - Raw reviews from API
   * @returns {Object} Categorized reviews
   */
  categorizeReviews(reviews) {
    const result = {
      positive: [],
      neutral: [],
      negative: []
    };

    reviews.forEach(review => {
      const processed = {
        id: review.id,
        summary: review.summary,
        body: this.truncateText(review.body, 300),
        score: review.score,
        rating: review.rating,
        ratingAmount: review.ratingAmount,
        userName: review.user?.name || 'Anonymous',
        userAvatar: review.user?.avatar?.medium,
        url: review.siteUrl,
        date: new Date(review.createdAt * 1000).toLocaleDateString()
      };

      if (review.score >= 70) {
        result.positive.push(processed);
      } else if (review.score >= 50) {
        result.neutral.push(processed);
      } else {
        result.negative.push(processed);
      }
    });

    return result;
  },

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    // Strip HTML tags
    const stripped = text.replace(/<[^>]*>/g, '');
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength).trim() + '...';
  },

  /**
   * Render a single review card
   * @param {Object} review - Processed review object
   * @returns {string} HTML string
   */
  renderReviewCard(review) {
    const scoreClass = review.score >= 70 ? 'positive' : review.score >= 50 ? 'neutral' : 'negative';

    return `
      <div class="review-card">
        <div class="review-header">
          <div class="review-user">
            ${review.userAvatar ? `<img src="${review.userAvatar}" alt="${review.userName}" class="review-avatar">` : ''}
            <span class="review-username">${review.userName}</span>
          </div>
          <div class="review-score ${scoreClass}">${review.score}/100</div>
        </div>
        <div class="review-content">
          <p class="review-summary">${review.summary || ''}</p>
          <p class="review-body">${review.body}</p>
        </div>
        <div class="review-footer">
          <span class="review-date">${review.date}</span>
          <span class="review-helpful">${review.rating}/${review.ratingAmount} found helpful</span>
          <a href="${review.url}" target="_blank" rel="noopener noreferrer" class="review-link">Read full review</a>
        </div>
      </div>
    `;
  },

  /**
   * Render the reviews section HTML
   * @param {Object} categorizedReviews - Reviews sorted by sentiment
   * @param {string} activeSentiment - Currently active tab
   * @returns {string} HTML string
   */
  renderReviewsSection(categorizedReviews, activeSentiment = 'positive') {
    const counts = {
      positive: categorizedReviews.positive.length,
      neutral: categorizedReviews.neutral.length,
      negative: categorizedReviews.negative.length
    };

    const activeReviews = categorizedReviews[activeSentiment] || [];

    return `
      <div class="community-reviews">
        <h3>Community Reviews</h3>
        <div class="review-tabs">
          <button class="review-tab ${activeSentiment === 'positive' ? 'active' : ''}" data-sentiment="positive">
            Positive <span class="tab-count">${counts.positive}</span>
          </button>
          <button class="review-tab ${activeSentiment === 'neutral' ? 'active' : ''}" data-sentiment="neutral">
            Neutral <span class="tab-count">${counts.neutral}</span>
          </button>
          <button class="review-tab ${activeSentiment === 'negative' ? 'active' : ''}" data-sentiment="negative">
            Negative <span class="tab-count">${counts.negative}</span>
          </button>
        </div>
        <div class="reviews-container" id="reviews-container">
          ${activeReviews.length > 0
            ? activeReviews.map(r => this.renderReviewCard(r)).join('')
            : '<p class="no-reviews">No reviews yet</p>'
          }
        </div>
        <p class="reviews-attribution">
          Reviews from <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a>
        </p>
      </div>
    `;
  },

  /**
   * Render the synopsis/description section
   * @param {string} description - Anime description from AniList
   * @returns {string} HTML string
   */
  renderSynopsis(description) {
    if (!description) {
      return '';
    }

    // Clean up the description (remove any remaining HTML-like artifacts)
    const cleanDescription = description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanDescription) {
      return '';
    }

    return `
      <div class="anime-synopsis">
        <h3>Synopsis</h3>
        <p class="synopsis-text">${cleanDescription}</p>
      </div>
    `;
  },

  /**
   * Render loading state for synopsis
   * @returns {string} HTML string
   */
  renderSynopsisLoading() {
    return `
      <div class="anime-synopsis">
        <h3>Synopsis</h3>
        <div class="synopsis-loading">
          <div class="loading-shimmer"></div>
          <div class="loading-shimmer"></div>
          <div class="loading-shimmer short"></div>
        </div>
      </div>
    `;
  },

  /**
   * Render loading state
   * @returns {string} HTML string
   */
  renderLoading() {
    return `
      <div class="community-reviews">
        <h3>Community Reviews</h3>
        <div class="reviews-loading">
          <div class="loading-spinner"></div>
          <p>Loading reviews...</p>
        </div>
      </div>
    `;
  },

  /**
   * Initialize tab switching for reviews section
   * @param {Object} categorizedReviews - Reviews data
   */
  initTabSwitching(categorizedReviews) {
    const tabs = document.querySelectorAll('.review-tab');
    const container = document.getElementById('reviews-container');

    if (!container) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const sentiment = tab.dataset.sentiment;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update content
        const reviews = categorizedReviews[sentiment] || [];
        container.innerHTML = reviews.length > 0
          ? reviews.map(r => this.renderReviewCard(r)).join('')
          : '<p class="no-reviews">No reviews yet</p>';
      });
    });
  }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewsService;
}
