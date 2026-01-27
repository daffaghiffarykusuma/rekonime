/**
 * Reviews Service - Fetches and categorizes reviews from MyAnimeList (via Jikan)
 */
const ReviewsService = {
  API_URL: 'https://api.jikan.moe/v4',
  maxReviewsTotal: 9,
  maxReviewsPerSentiment: 3,
  minReviewLength: 120,
  includeSpoilers: false,
  includePreliminary: false,
  reviewsPage: 1,

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

  decodeHtmlEntities(text) {
    if (!text) return '';
    const named = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: '\'',
      nbsp: ' ',
      rsquo: '\'',
      lsquo: '\'',
      ldquo: '"',
      rdquo: '"',
      mdash: '-',
      ndash: '-',
      hellip: '...'
    };

    let decoded = String(text);
    for (let i = 0; i < 2; i += 1) {
      decoded = decoded
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
          const code = Number.parseInt(hex, 16);
          return Number.isFinite(code) ? String.fromCharCode(code) : _;
        })
        .replace(/&#(\d+);/g, (_, num) => {
          const code = Number.parseInt(num, 10);
          return Number.isFinite(code) ? String.fromCharCode(code) : _;
        })
        .replace(/&([a-z]+);/gi, (match, name) => {
          const key = String(name || '').toLowerCase();
          return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
        });
    }
    return decoded;
  },

  sanitizeReviewText(text) {
    if (!text) return '';
    let cleaned = this.decodeHtmlEntities(String(text));

    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Spoiler markup (~!spoiler!~) -> keep content without markers.
    cleaned = cleaned.replace(/~!([\s\S]*?)!~/g, '$1');

    // Remove common BBCode image embeds and markdown images.
    cleaned = cleaned.replace(/!\[[^\]]*]\(([^)]+)\)/g, '');
    cleaned = cleaned.replace(/\[img\][\s\S]*?\[\/img\]/gi, '');
    cleaned = cleaned.replace(/\bimg\d*\([^)]+\)/gi, '');
    cleaned = cleaned.replace(/\bimage\d*\([^)]+\)/gi, '');

    // Remove media embeds while keeping surrounding text.
    cleaned = cleaned.replace(/\b(?:youtube|video)\([^)]+\)/gi, '');

    // Keep link text but drop the URL.
    cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');

    // Remove spoiler labels and tags.
    cleaned = cleaned.replace(/\[\s*(no spoilers?|contains spoilers?|spoilers?|spoiler warning)\s*\]/gi, '');
    cleaned = cleaned.replace(/^\s*(contains spoilers?|no spoilers?)\s*[:-]?\s*/gmi, '');
    cleaned = cleaned.replace(/https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?/gi, '');

    const lines = cleaned.split(/\r?\n/);
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(contains spoilers?|no spoilers?|spoilers?|spoiler warning|spoilers ahead)\.?$/i.test(trimmed)) {
        return false;
      }
      if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp|svg)(\?\S*)?$/i.test(trimmed)) {
        return false;
      }
      return true;
    });

    cleaned = filtered.join('\n');
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  },

  buildReviewSummary(text) {
    const cleaned = this.sanitizeReviewText(text);
    if (!cleaned) return '';
    const lines = cleaned.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const candidate = lines[0] || cleaned;
    const sentenceMatch = candidate.match(/^(.{0,180}?[.!?])\s/);
    let summary = sentenceMatch ? sentenceMatch[1] : candidate;
    if (summary.length > 180) {
      summary = `${summary.slice(0, 177).trim()}...`;
    }
    return summary;
  },

  // Cache to avoid repeated API calls
  cache: new Map(),
  descriptionCachePrefix: 'rekonime:description:',
  descriptionCacheTtlMs: 1000 * 60 * 60 * 24 * 30,

  buildReviewsUrl(malId) {
    if (!malId) return '';
    const parsedId = Number.parseInt(malId, 10);
    if (!Number.isFinite(parsedId)) return '';

    const url = new URL(`${this.API_URL}/anime/${parsedId}/reviews`);
    if (Number.isFinite(this.reviewsPage) && this.reviewsPage > 0) {
      url.searchParams.set('page', String(this.reviewsPage));
    }
    if (this.includeSpoilers) {
      url.searchParams.set('spoiler', 'true');
    }
    if (this.includePreliminary) {
      url.searchParams.set('preliminary', 'true');
    }
    return url.toString();
  },

  buildAnimeUrl(malId) {
    if (!malId) return '';
    const parsedId = Number.parseInt(malId, 10);
    if (!Number.isFinite(parsedId)) return '';
    return `${this.API_URL}/anime/${parsedId}`;
  },

  async fetchSynopsis(malId) {
    const url = this.buildAnimeUrl(malId);
    if (!url) return '';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return '';
      const data = await response.json();
      const synopsis = data?.data?.synopsis;
      return typeof synopsis === 'string' ? synopsis : '';
    } catch (error) {
      return '';
    }
  },

  /**
   * Fetch reviews from MyAnimeList via the Jikan API.
   * @param {number|null} malId - MyAnimeList media ID
   * @param {string} title - Anime title for caching fallback
   * @returns {Promise<Object>} Categorized reviews and description
   */
  async fetchReviews(malId, title) {
    const cacheKey = malId || title;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const cachedDescription = this.getCachedDescription(cacheKey);

    try {
      const url = this.buildReviewsUrl(malId);
      if (!url) {
        throw new Error('Missing MAL id for reviews');
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const reviews = Array.isArray(data?.data) ? data.data : [];
      let description = cachedDescription || '';
      if (!description) {
        const synopsis = await this.fetchSynopsis(malId);
        if (synopsis) {
          description = synopsis;
          this.setCachedDescription(cacheKey, synopsis);
        }
      }
      const categorized = this.categorizeReviews(reviews);

      const result = {
        ...categorized,
        description
      };

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
  normalizeReviewScore(score) {
    if (!Number.isFinite(score)) return null;
    const bounded = Math.min(10, Math.max(0, score));
    return Math.round((bounded / 10) * 100);
  },

  getReviewSentiment(scoreNormalized) {
    if (!Number.isFinite(scoreNormalized)) return 'neutral';
    if (scoreNormalized >= 70) return 'positive';
    if (scoreNormalized >= 50) return 'neutral';
    return 'negative';
  },

  getReviewUsefulness(review) {
    const reactions = review?.reactions || {};
    const overall = Number(reactions.overall);
    if (Number.isFinite(overall)) return overall;
    const keys = ['nice', 'love_it', 'funny', 'informative', 'well_written', 'creative'];
    return keys.reduce((sum, key) => {
      const value = Number(reactions[key]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  },

  normalizeReview(review) {
    if (!review) return null;
    if (!this.includeSpoilers && review.is_spoiler) return null;
    if (!this.includePreliminary && review.is_preliminary) return null;

    const cleanedBody = this.sanitizeReviewText(review.review);
    if (!cleanedBody || cleanedBody.length < this.minReviewLength) return null;

    const scoreNormalized = this.normalizeReviewScore(review.score);
    const dateValue = review.date ? new Date(review.date) : null;
    const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
      ? dateValue.toLocaleDateString()
      : '';

    return {
      id: review.mal_id || review.id,
      summary: this.buildReviewSummary(cleanedBody),
      body: this.truncateText(cleanedBody, 300, { alreadyClean: true }),
      score: scoreNormalized,
      helpfulCount: this.getReviewUsefulness(review),
      userName: review.user?.username || 'Anonymous',
      userAvatar: review.user?.images?.jpg?.image_url || review.user?.images?.webp?.image_url,
      url: review.url,
      date: dateLabel,
      sentiment: this.getReviewSentiment(scoreNormalized)
    };
  },

  categorizeReviews(reviews) {
    const result = {
      positive: [],
      neutral: [],
      negative: []
    };

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return result;
    }

    const seen = new Set();
    const processed = [];

    reviews.forEach(review => {
      const normalized = this.normalizeReview(review);
      if (!normalized) return;
      const key = String(normalized.id || normalized.url || normalized.summary || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      processed.push(normalized);
    });

    const buckets = {
      positive: [],
      neutral: [],
      negative: []
    };

    processed.forEach(review => {
      const bucket = buckets[review.sentiment] || buckets.neutral;
      bucket.push(review);
    });

    const sortByUsefulness = (a, b) => {
      const helpfulDiff = (b.helpfulCount || 0) - (a.helpfulCount || 0);
      if (helpfulDiff !== 0) return helpfulDiff;
      return (b.body?.length || 0) - (a.body?.length || 0);
    };

    ['positive', 'neutral', 'negative'].forEach(key => {
      const bucket = buckets[key].sort(sortByUsefulness);
      result[key] = bucket.slice(0, this.maxReviewsPerSentiment);
    });

    const totalCount = result.positive.length + result.neutral.length + result.negative.length;
    if (totalCount <= this.maxReviewsTotal) {
      return result;
    }

    const flattened = [
      ...result.positive.map(review => ({ ...review, _bucket: 'positive' })),
      ...result.neutral.map(review => ({ ...review, _bucket: 'neutral' })),
      ...result.negative.map(review => ({ ...review, _bucket: 'negative' }))
    ].sort(sortByUsefulness);

    const trimmed = {
      positive: [],
      neutral: [],
      negative: []
    };

    for (const review of flattened) {
      const bucket = trimmed[review._bucket];
      if (bucket.length >= this.maxReviewsPerSentiment) continue;
      bucket.push(review);
      if (trimmed.positive.length + trimmed.neutral.length + trimmed.negative.length >= this.maxReviewsTotal) {
        break;
      }
    }

    return trimmed;
  },

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength, { alreadyClean = false } = {}) {
    if (!text) return '';
    const stripped = alreadyClean ? String(text) : this.sanitizeReviewText(text);
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength).trim() + '...';
  },

  /**
   * Render a single review card
   * @param {Object} review - Processed review object
   * @returns {string} HTML string
   */
  renderReviewCard(review) {
    const hasScore = Number.isFinite(review.score);
    const numericScore = hasScore ? review.score : 0;
    const scoreClass = hasScore ? (numericScore >= 70 ? 'positive' : numericScore >= 50 ? 'neutral' : 'negative') : 'neutral';
    const scoreText = hasScore ? `${review.score}/100` : 'N/A';
    const helpfulCount = Number.isFinite(review.helpfulCount) ? review.helpfulCount : null;
    const helpfulText = helpfulCount !== null ? `${helpfulCount} helpful reactions` : 'Helpful reactions: N/A';
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
          <span class="review-helpful">${helpfulText}</span>
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
            : '<p class="no-reviews">No community reviews yetâ€”be the first on MyAnimeList!</p>'
          }
        </div>
        <p class="reviews-attribution">
          Reviews from <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer">MyAnimeList</a>
        </p>
      </div>
    `;
  },

  /**
   * Render the synopsis/description section
   * @param {string} description - Anime description text
   * @returns {string} HTML string
   */
  renderSynopsis(description) {
    if (!description) {
      return '';
    }

    // Clean up the description (remove any remaining HTML-like artifacts)
    const cleanDescription = this.decodeHtmlEntities(description)
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
          : '<p class="no-reviews">No community reviews yetâ€”be the first on MyAnimeList!</p>';
        scrollTabIntoView(tab);
      });
    });
  }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewsService;
}

