/**
 * Reviews Service - Fetches and categorizes reviews from AniList
 */
const ReviewsService = {
  API_URL: 'https://graphql.anilist.co',

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        default: return char;
      }
    });
  },

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  },

  sanitizeUrl(rawUrl) {
    if (!rawUrl) return '';
    const value = String(rawUrl).trim();
    if (!value) return '';
    try {
      const parsed = new URL(value, window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.toString();
    } catch (error) {
      return '';
    }
  },

  // Cache to avoid repeated API calls
  cache: new Map(),
  descriptionCachePrefix: 'rekonime:description:',
  descriptionCacheTtlMs: 1000 * 60 * 60 * 24 * 30,

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

    const cachedDescription = this.getCachedDescription(cacheKey);

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
      const description = media?.description || cachedDescription || '';
      const categorized = this.categorizeReviews(reviews);

      const result = {
        ...categorized,
        description
      };

      if (media?.description) {
        this.setCachedDescription(cacheKey, media.description);
      }

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      return {
        positive: [],
        neutral: [],
        negative: [],
        description: cachedDescription || '',
        error: true
      };
    }
  },

  /**
   * Build a stable localStorage key for cached descriptions.
   * @param {string|number} cacheKey - Anime identifier
   * @returns {string} Storage key
   */
  getDescriptionCacheKey(cacheKey) {
    if (cacheKey === null || cacheKey === undefined || cacheKey === '') return '';
    return `${this.descriptionCachePrefix}${String(cacheKey)}`;
  },

  /**
   * Read a cached description if available and not expired.
   * @param {string|number} cacheKey - Anime identifier
   * @returns {string} Cached description
   */
  getCachedDescription(cacheKey) {
    const storageKey = this.getDescriptionCacheKey(cacheKey);
    if (!storageKey || typeof localStorage === 'undefined') return '';

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return '';
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed.description !== 'string') return '';
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(storageKey);
        return '';
      }
      return parsed.description;
    } catch (error) {
      return '';
    }
  },

  /**
   * Persist a description for faster synopsis loads.
   * @param {string|number} cacheKey - Anime identifier
   * @param {string} description - Description text
   */
  setCachedDescription(cacheKey, description) {
    const storageKey = this.getDescriptionCacheKey(cacheKey);
    if (!storageKey || typeof localStorage === 'undefined' || !description) return;

    try {
      const payload = {
        description,
        expiresAt: Date.now() + this.descriptionCacheTtlMs
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures (private mode, quota, etc).
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
    const numericScore = Number.isFinite(review.score) ? review.score : 0;
    const scoreClass = numericScore >= 70 ? 'positive' : numericScore >= 50 ? 'neutral' : 'negative';
    const scoreText = Number.isFinite(review.score) ? `${review.score}/100` : 'N/A';
    const ratingText = Number.isFinite(review.rating) ? review.rating : 'N/A';
    const ratingAmountText = Number.isFinite(review.ratingAmount) ? review.ratingAmount : 'N/A';
    const safeUserName = this.escapeHtml(review.userName || 'Anonymous');
    const safeSummary = this.escapeHtml(review.summary || '');
    const safeBody = this.escapeHtml(review.body || '');
    const safeDate = this.escapeHtml(review.date || '');
    const safeAvatar = this.escapeAttr(this.sanitizeUrl(review.userAvatar));
    const safeUrl = this.escapeAttr(this.sanitizeUrl(review.url));

    return `
      <div class="review-card">
        <div class="review-header">
          <div class="review-user">
            ${safeAvatar ? `<img src="${safeAvatar}" alt="${safeUserName}" class="review-avatar" data-fallback-src="https://via.placeholder.com/40x40?text=User">` : ''}
            <span class="review-username">${safeUserName}</span>
          </div>
          <div class="review-score ${scoreClass}">${scoreText}</div>
        </div>
        <div class="review-content">
          <p class="review-summary">${safeSummary}</p>
          <p class="review-body">${safeBody}</p>
        </div>
        <div class="review-footer">
          <span class="review-date">${safeDate}</span>
          <span class="review-helpful">${ratingText}/${ratingAmountText} found helpful</span>
          ${safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="review-link">Read full review</a>` : ''}
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
            : '<p class="no-reviews">No community reviews yetâ€”be the first on AniList!</p>'
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

    const safeDescription = this.escapeHtml(cleanDescription);

    return `
      <div class="anime-synopsis">
        <h3>Synopsis</h3>
        <p class="synopsis-text">${safeDescription}</p>
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
    const tabsWrap = document.querySelector('.review-tabs');
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    if (!container || tabs.length === 0) return;

    const scrollTabIntoView = (tab) => {
      if (!tab || !tabsWrap) return;
      if (tabsWrap.scrollWidth <= tabsWrap.clientWidth) return;
      tab.scrollIntoView({ behavior: scrollBehavior, block: 'nearest', inline: 'center' });
    };

    const activeTab = document.querySelector('.review-tab.active');
    if (activeTab) {
      scrollTabIntoView(activeTab);
    }

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
          : '<p class="no-reviews">No community reviews yetâ€”be the first on AniList!</p>';
        scrollTabIntoView(tab);
      });
    });
  }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewsService;
}

