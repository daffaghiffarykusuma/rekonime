# API Integration Gaps Remediation Plan

## Executive Summary

This document outlines the plan to address API integration gaps identified in the Gap Identification Report, specifically:
1. Jikan API risks (rate limiting, deprecation, schema changes, CORS failures)
2. Lack of a unified API abstraction layer

---

## 1. Jikan API Risk Mitigation

### 1.1 Token Bucket Rate Limiter

**Current State (Gap)**
- Exponential backoff exists but no token bucket
- May still hit 429s under burst load
- Lines 13-16, 200-208 in js/reviews.js

**Remediation Strategy: Token Bucket Implementation**

```javascript
// Add to new file: js/rateLimiter.js
/**
 * Token Bucket Rate Limiter for API calls
 * Prevents hitting rate limits by controlling request flow
 */
const RateLimiter = {
    // Token bucket configuration
    config: {
        // Jikan API: 3 requests per second (conservative: 2 per second)
        jikan: {
            tokensPerSecond: 2,
            maxTokens: 3,
            minRequestInterval: 500 // ms between requests
        },
        // Generic catalog fetch config
        catalog: {
            tokensPerSecond: 5,
            maxTokens: 10,
            minRequestInterval: 200
        }
    },

    // Bucket state per service
    buckets: new Map(),

    // Request queues per service
    queues: new Map(),

    // Processing state
    processing: new Map(),

    /**
     * Get or create bucket for a service
     */
    getBucket(serviceName) {
        if (!this.buckets.has(serviceName)) {
            const config = this.config[serviceName] || this.config.catalog;
            this.buckets.set(serviceName, {
                tokens: config.maxTokens,
                lastRefill: Date.now(),
                config
            });
        }
        return this.buckets.get(serviceName);
    },

    /**
     * Refill tokens based on elapsed time
     */
    refillTokens(bucket) {
        const now = Date.now();
        const elapsed = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = elapsed * bucket.config.tokensPerSecond;

        bucket.tokens = Math.min(
            bucket.config.maxTokens,
            bucket.tokens + tokensToAdd
        );
        bucket.lastRefill = now;
    },

    /**
     * Try to consume a token
     * @returns {boolean} Whether a token was consumed
     */
    tryConsume(serviceName) {
        const bucket = this.getBucket(serviceName);
        this.refillTokens(bucket);

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return true;
        }
        return false;
    },

    /**
     * Calculate wait time until next token available
     */
    getWaitTime(serviceName) {
        const bucket = this.getBucket(serviceName);
        const config = bucket.config;

        if (bucket.tokens >= 1) return 0;

        const tokensNeeded = 1 - bucket.tokens;
        const msPerToken = 1000 / config.tokensPerSecond;
        return Math.ceil(tokensNeeded * msPerToken);
    },

    /**
     * Add request to queue
     */
    enqueue(serviceName, fn, resolve, reject) {
        if (!this.queues.has(serviceName)) {
            this.queues.set(serviceName, []);
        }
        this.queues.get(serviceName).push({ fn, resolve, reject });
        this.processQueue(serviceName);
    },

    /**
     * Process queued requests
     */
    async processQueue(serviceName) {
        if (this.processing.get(serviceName)) return;
        this.processing.set(serviceName, true);

        const queue = this.queues.get(serviceName) || [];

        while (queue.length > 0) {
            if (this.tryConsume(serviceName)) {
                const { fn, resolve, reject } = queue.shift();
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            } else {
                // Wait for token
                const waitTime = this.getWaitTime(serviceName);
                await new Promise(r => setTimeout(r, waitTime));
            }
        }

        this.processing.set(serviceName, false);
    },

    /**
     * Execute function with rate limiting
     */
    async execute(serviceName, fn) {
        return new Promise((resolve, reject) => {
            this.enqueue(serviceName, fn, resolve, reject);
        });
    },

    /**
     * Get rate limiter status
     */
    getStatus(serviceName) {
        const bucket = this.getBucket(serviceName);
        this.refillTokens(bucket);
        return {
            service: serviceName,
            availableTokens: bucket.tokens,
            maxTokens: bucket.config.maxTokens,
            queueLength: this.queues.get(serviceName)?.length || 0
        };
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
}
```

**Integration with ReviewsService:**

```javascript
// In js/reviews.js, modify fetchReviews method:
async fetchReviews(malId, title, isManualRetry = false) {
    const cacheKey = malId || title;

    // Reset retry count on manual retry
    if (isManualRetry) {
        this.resetRetryCount(cacheKey);
    }

    if (this.cache.has(cacheKey) && !isManualRetry) {
        return this.cache.get(cacheKey);
    }

    const cachedDescription = this.getCachedDescription(cacheKey);

    try {
        // Use rate limiter for Jikan API
        const result = await RateLimiter.execute('jikan', async () => {
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

            return {
                ...categorized,
                description,
                retryAttempt: this.getRetryCount(cacheKey),
                maxRetries: this.maxRetries
            };
        });

        // Reset retry count on success
        this.resetRetryCount(cacheKey);
        this.cache.set(cacheKey, result);
        return result;

    } catch (error) {
        console.error('Failed to fetch reviews:', error);
        // ... error handling
    }
}
```

---

### 1.2 API Version Management

**Current State (Gap)**
- Hardcoded v4 URLs
- No handling for API deprecation
- Lines 5 in js/reviews.js

**Remediation Strategy: Version-Aware API Client**

```javascript
// Add to new file: js/apiClient.js
/**
 * Version-aware API client with deprecation handling
 */
const ApiClient = {
    // API configurations
    endpoints: {
        jikan: {
            currentVersion: 'v4',
            baseUrls: {
                v4: 'https://api.jikan.moe/v4',
                v3: 'https://api.jikan.moe/v3' // fallback
            },
            deprecationStatus: null,
            sunsetDate: null
        }
    },

    // Version fallback state
    versionFallback: new Map(),

    /**
     * Get API URL with version management
     */
    getUrl(service, endpoint, params = {}) {
        const config = this.endpoints[service];
        if (!config) {
            throw new Error(`Unknown service: ${service}`);
        }

        // Check if we need to fallback to older version
        const version = this.versionFallback.get(service) || config.currentVersion;
        const baseUrl = config.baseUrls[version];

        if (!baseUrl) {
            throw new Error(`No URL configured for ${service} ${version}`);
        }

        const url = new URL(`${baseUrl}/${endpoint}`);

        // Add query parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });

        return url.toString();
    },

    /**
     * Handle API deprecation headers
     */
    handleDeprecationHeaders(service, response) {
        const sunset = response.headers.get('Sunset');
        const deprecation = response.headers.get('Deprecation');
        const link = response.headers.get('Link');

        if (sunset || deprecation) {
            console.warn(`[ApiClient] ${service} API deprecation detected:`, {
                sunset,
                deprecation,
                link
            });

            this.endpoints[service].deprecationStatus = {
                sunset,
                deprecation,
                link,
                detectedAt: Date.now()
            };
        }
    },

    /**
     * Attempt version fallback on failure
     */
    async attemptVersionFallback(service, fn) {
        const config = this.endpoints[service];

        try {
            return await fn(config.currentVersion);
        } catch (error) {
            // Check if it's a version-related error
            if (error.message?.includes('404') || error.message?.includes('410')) {
                const fallbackVersions = Object.keys(config.baseUrls)
                    .filter(v => v !== config.currentVersion)
                    .sort()
                    .reverse();

                for (const version of fallbackVersions) {
                    try {
                        console.warn(`[ApiClient] Trying ${service} ${version} fallback...`);
                        this.versionFallback.set(service, version);
                        const result = await fn(version);
                        console.log(`[ApiClient] Fallback to ${version} successful`);
                        return result;
                    } catch (fallbackError) {
                        console.error(`[ApiClient] Fallback to ${version} failed:`, fallbackError);
                    }
                }
            }

            throw error;
        }
    },

    /**
     * Fetch with version management and deprecation handling
     */
    async fetch(service, endpoint, options = {}) {
        const { params, ...fetchOptions } = options;

        return this.attemptVersionFallback(service, async (version) => {
            const url = this.getUrl(service, endpoint, params);

            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    'Accept': 'application/json',
                    ...fetchOptions.headers
                }
            });

            this.handleDeprecationHeaders(service, response);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        });
    },

    /**
     * Check if API is deprecated
     */
    isDeprecated(service) {
        return !!this.endpoints[service]?.deprecationStatus;
    },

    /**
     * Get deprecation info
     */
    getDeprecationInfo(service) {
        return this.endpoints[service]?.deprecationStatus || null;
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
```

**Update ReviewsService to use ApiClient:**

```javascript
// In js/reviews.js, update buildReviewsUrl and buildAnimeUrl:
buildReviewsUrl(malId) {
    if (!malId) return '';
    const parsedId = Number.parseInt(malId, 10);
    if (!Number.isFinite(parsedId)) return '';

    return ApiClient.getUrl('jikan', `anime/${parsedId}/reviews`, {
        page: this.reviewsPage,
        spoiler: this.includeSpoilers ? 'true' : undefined,
        preliminary: this.includePreliminary ? 'true' : undefined
    });
},

buildAnimeUrl(malId) {
    if (!malId) return '';
    const parsedId = Number.parseInt(malId, 10);
    if (!Number.isFinite(parsedId)) return '';

    return ApiClient.getUrl('jikan', `anime/${parsedId}`);
},

// Update fetchSynopsis to use ApiClient.fetch:
async fetchSynopsis(malId) {
    try {
        const response = await ApiClient.fetch('jikan', `anime/${malId}`);
        const data = await response.json();
        const synopsis = data?.data?.synopsis;
        return typeof synopsis === 'string' ? synopsis : '';
    } catch (error) {
        console.error('[fetchSynopsis] Failed:', error);
        return '';
    }
}
```

---

### 1.3 Runtime Schema Validation

**Current State (Gap)**
- No runtime validation of API responses
- Schema changes can break the app silently
- Lines 296-297, 186-191 in js/reviews.js

**Remediation Strategy: Schema Validation with Zod-like Interface**

```javascript
// Add to new file: js/schemaValidator.js
/**
 * Lightweight schema validator for API responses
 * Zod-inspired API without external dependency
 */
const SchemaValidator = {
    /**
     * Validate value against schema
     */
    validate(data, schema, path = '') {
        const errors = [];

        if (schema.type === 'object') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                errors.push({ path, expected: 'object', actual: typeof data });
                return { valid: false, errors };
            }

            // Check required fields
            if (schema.required) {
                for (const key of schema.required) {
                    if (!(key in data)) {
                        errors.push({ path: `${path}.${key}`, error: 'required field missing' });
                    }
                }
            }

            // Validate properties
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (key in data) {
                        const result = this.validate(data[key], propSchema, `${path}.${key}`);
                        if (!result.valid) {
                            errors.push(...result.errors);
                        }
                    }
                }
            }

            // Allow additional properties if specified
            if (!schema.additionalProperties) {
                const allowedKeys = new Set(Object.keys(schema.properties || {}));
                for (const key of Object.keys(data)) {
                    if (!allowedKeys.has(key)) {
                        // Just log, don't fail
                        console.warn(`[SchemaValidator] Unexpected property at ${path}.${key}`);
                    }
                }
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(data)) {
                errors.push({ path, expected: 'array', actual: typeof data });
                return { valid: false, errors };
            }

            if (schema.items) {
                data.forEach((item, index) => {
                    const result = this.validate(item, schema.items, `${path}[${index}]`);
                    if (!result.valid) {
                        errors.push(...result.errors);
                    }
                });
            }
        } else if (schema.type === 'string') {
            if (typeof data !== 'string') {
                errors.push({ path, expected: 'string', actual: typeof data });
            }
        } else if (schema.type === 'number') {
            if (typeof data !== 'number' || !Number.isFinite(data)) {
                errors.push({ path, expected: 'number', actual: typeof data });
            }
        } else if (schema.type === 'integer') {
            if (!Number.isInteger(data)) {
                errors.push({ path, expected: 'integer', actual: typeof data });
            }
        } else if (schema.type === 'boolean') {
            if (typeof data !== 'boolean') {
                errors.push({ path, expected: 'boolean', actual: typeof data });
            }
        } else if (schema.type === 'null') {
            if (data !== null) {
                errors.push({ path, expected: 'null', actual: typeof data });
            }
        }

        // Custom validator
        if (schema.validate && typeof schema.validate === 'function') {
            try {
                const customResult = schema.validate(data);
                if (customResult !== true) {
                    errors.push({ path, error: customResult || 'custom validation failed' });
                }
            } catch (error) {
                errors.push({ path, error: error.message });
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Create a validator function for a schema
     */
    createValidator(schema) {
        return (data) => this.validate(data, schema);
    },

    // Predefined schemas
    schemas: {
        // Jikan API response schemas
        jikan: {
            anime: {
                type: 'object',
                required: ['data'],
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            mal_id: { type: 'integer' },
                            title: { type: 'string' },
                            synopsis: { type: 'string' },
                            score: { type: 'number' },
                            episodes: { type: 'integer' },
                            images: {
                                type: 'object',
                                properties: {
                                    jpg: {
                                        type: 'object',
                                        properties: {
                                            image_url: { type: 'string' },
                                            small_image_url: { type: 'string' },
                                            large_image_url: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },

            reviews: {
                type: 'object',
                required: ['data'],
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['mal_id', 'review'],
                            properties: {
                                mal_id: { type: 'integer' },
                                review: { type: 'string' },
                                score: { type: 'integer' },
                                date: { type: 'string' },
                                is_spoiler: { type: 'boolean' },
                                is_preliminary: { type: 'boolean' },
                                user: {
                                    type: 'object',
                                    properties: {
                                        username: { type: 'string' },
                                        images: {
                                            type: 'object',
                                            properties: {
                                                jpg: {
                                                    type: 'object',
                                                    properties: {
                                                        image_url: { type: 'string' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                reactions: {
                                    type: 'object',
                                    properties: {
                                        overall: { type: 'integer' },
                                        nice: { type: 'integer' },
                                        love_it: { type: 'integer' },
                                        funny: { type: 'integer' },
                                        informative: { type: 'integer' },
                                        well_written: { type: 'integer' },
                                        creative: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    pagination: {
                        type: 'object',
                        properties: {
                            last_visible_page: { type: 'integer' },
                            has_next_page: { type: 'boolean' }
                        }
                    }
                }
            }
        },

        // Catalog data schema
        catalog: {
            type: 'object',
            required: ['anime'],
            properties: {
                generatedAt: { type: 'string' },
                scoreProfile: {
                    type: 'object',
                    properties: {
                        p35: { type: 'number' },
                        p50: { type: 'number' },
                        p65: { type: 'number' },
                        sampleSize: { type: 'integer' },
                        source: { type: 'string' }
                    }
                },
                anime: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'title'],
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            titleEnglish: { type: 'string' },
                            titleJapanese: { type: 'string' },
                            malId: { type: 'integer' },
                            anilistId: { type: 'integer' },
                            cover: { type: 'string' },
                            type: { type: 'string' },
                            year: { type: 'integer' },
                            season: { type: 'string' },
                            studio: { type: 'string' },
                            source: { type: 'string' },
                            genres: { type: 'array', items: { type: 'string' } },
                            themes: { type: 'array', items: { type: 'string' } },
                            demographic: { type: 'string' },
                            synopsis: { type: 'string' },
                            communityScore: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchemaValidator;
}
```

**Integration with ReviewsService:**

```javascript
// In js/reviews.js, add validation to fetchReviews:
async fetchReviews(malId, title, isManualRetry = false) {
    // ... existing code ...

    try {
        const result = await RateLimiter.execute('jikan', async () => {
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

            // Validate response schema
            const validation = SchemaValidator.validate(
                data,
                SchemaValidator.schemas.jikan.reviews
            );

            if (!validation.valid) {
                console.warn('[fetchReviews] Schema validation warnings:', validation.errors);
                // Continue processing but log warnings
            }

            const reviews = Array.isArray(data?.data) ? data.data : [];
            // ... rest of the method
        });

        // ...
    } catch (error) {
        // ... error handling
    }
}
```

---

### 1.4 Alternative Data Source Fallback

**Current State (Gap)**
- Cache fallback only
- No alternative data source for CORS failures
- Lines 320-345 in js/reviews.js

**Remediation Strategy: Multi-Source Data Provider**

```javascript
// Add to new file: js/dataProvider.js
/**
 * Multi-source data provider with fallback strategies
 */
const DataProvider = {
    // Data sources configuration
    sources: {
        synopsis: {
            primary: 'jikan',
            fallbacks: ['cached', 'local']
        },
        reviews: {
            primary: 'jikan',
            fallbacks: ['cached', 'none']
        }
    },

    // Source implementations
    implementations: {
        jikan: {
            async getSynopsis(malId) {
                const response = await ApiClient.fetch('jikan', `anime/${malId}`);
                const data = await response.json();
                return data?.data?.synopsis || '';
            },

            async getReviews(malId, options = {}) {
                const { page, includeSpoilers, includePreliminary } = options;
                const params = {
                    page,
                    spoiler: includeSpoilers ? 'true' : undefined,
                    preliminary: includePreliminary ? 'true' : undefined
                };

                const response = await ApiClient.fetch('jikan', `anime/${malId}/reviews`, { params });
                const data = await response.json();

                return {
                    reviews: Array.isArray(data?.data) ? data.data : [],
                    pagination: data?.pagination || {}
                };
            }
        },

        cached: {
            async getSynopsis(malId, title) {
                const cacheKey = malId || title;
                return ReviewsService.getCachedDescription(cacheKey);
            },

            async getReviews(malId, title) {
                const cacheKey = malId || title;
                const cached = ReviewsService.cache.get(cacheKey);
                if (cached) {
                    return {
                        reviews: [...cached.positive, ...cached.neutral, ...cached.negative],
                        fromCache: true
                    };
                }
                return { reviews: [], fromCache: false };
            }
        },

        local: {
            async getSynopsis(malId, title, animeData) {
                // Try to find synopsis in local anime data
                const anime = animeData?.find(a =>
                    a.malId === malId ||
                    a.title === title ||
                    a.titleEnglish === title
                );
                return anime?.synopsis || '';
            }
        },

        none: {
            async getReviews() {
                return { reviews: [], unavailable: true };
            }
        }
    },

    /**
     * Fetch data with fallback chain
     */
    async fetchWithFallback(dataType, identifier, options = {}) {
        const config = this.sources[dataType];
        if (!config) {
            throw new Error(`Unknown data type: ${dataType}`);
        }

        const sources = [config.primary, ...config.fallbacks];
        const errors = [];

        for (const sourceName of sources) {
            try {
                const implementation = this.implementations[sourceName];
                if (!implementation) {
                    errors.push({ source: sourceName, error: 'Implementation not found' });
                    continue;
                }

                const method = implementation[dataType === 'synopsis' ? 'getSynopsis' : 'getReviews'];
                if (!method) {
                    errors.push({ source: sourceName, error: 'Method not implemented' });
                    continue;
                }

                const result = await method(identifier, options.animeData, options);

                if (result && (result.reviews?.length > 0 || result.length > 0 || result.unavailable)) {
                    return {
                        data: result,
                        source: sourceName,
                        errors: errors.length > 0 ? errors : undefined
                    };
                }
            } catch (error) {
                console.warn(`[DataProvider] ${sourceName} failed for ${dataType}:`, error);
                errors.push({ source: sourceName, error: error.message });

                // Don't fallback on certain errors
                if (error.message?.includes('404') || error.message?.includes('malformed')) {
                    break;
                }
            }
        }

        throw new Error(
            `All data sources failed for ${dataType}: ${errors.map(e => `${e.source}: ${e.error}`).join(', ')}`
        );
    },

    /**
     * Get synopsis with fallback
     */
    async getSynopsis(malId, title, animeData) {
        try {
            const result = await this.fetchWithFallback('synopsis', malId, {
                animeData,
                title
            });

            return {
                synopsis: result.data,
                source: result.source
            };
        } catch (error) {
            console.error('[DataProvider] Failed to get synopsis:', error);
            return {
                synopsis: '',
                source: 'none',
                error: error.message
            };
        }
    },

    /**
     * Get reviews with fallback
     */
    async getReviews(malId, title, options = {}) {
        try {
            const result = await this.fetchWithFallback('reviews', malId, {
                ...options,
                title
            });

            return {
                reviews: result.data.reviews || result.data,
                source: result.source,
                fromCache: result.data.fromCache,
                unavailable: result.data.unavailable,
                errors: result.errors
            };
        } catch (error) {
            console.error('[DataProvider] Failed to get reviews:', error);
            return {
                reviews: [],
                source: 'none',
                error: error.message
            };
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProvider;
}
```

---

## 2. API Abstraction Layer

### 2.1 Unified API Client

**Current State (Gap)**
- Direct fetch calls scattered across files
- No standardized error handling
- No request/response interceptors
- No mocking capabilities

**Remediation Strategy: Unified API Client**

```javascript
// Add to new file: js/apiClient.js (extend existing)
/**
 * Unified API Client with interceptors, error handling, and mocking
 */
const ApiClient = {
    // Configuration
    config: {
        timeout: 10000,
        retries: 3,
        baseDelay: 500,
        maxDelay: 5000
    },

    // Interceptors
    interceptors: {
        request: [],
        response: [],
        error: []
    },

    // Mock mode
    mockEnabled: false,
    mockHandlers: new Map(),

    /**
     * Add request interceptor
     */
    addRequestInterceptor(fn) {
        this.interceptors.request.push(fn);
    },

    /**
     * Add response interceptor
     */
    addResponseInterceptor(fn) {
        this.interceptors.response.push(fn);
    },

    /**
     * Add error interceptor
     */
    addErrorInterceptor(fn) {
        this.interceptors.error.push(fn);
    },

    /**
     * Enable mock mode
     */
    enableMock() {
        this.mockEnabled = true;
    },

    /**
     * Disable mock mode
     */
    disableMock() {
        this.mockEnabled = false;
    },

    /**
     * Register mock handler
     */
    mock(endpoint, handler) {
        this.mockHandlers.set(endpoint, handler);
    },

    /**
     * Clear mock handlers
     */
    clearMocks() {
        this.mockHandlers.clear();
    },

    /**
     * Apply request interceptors
     */
    async applyRequestInterceptors(url, options) {
        let result = { url, options };
        for (const interceptor of this.interceptors.request) {
            result = await interceptor(result.url, result.options) || result;
        }
        return result;
    },

    /**
     * Apply response interceptors
     */
    async applyResponseInterceptors(response) {
        let result = response;
        for (const interceptor of this.interceptors.response) {
            result = await interceptor(result) || result;
        }
        return result;
    },

    /**
     * Apply error interceptors
     */
    async applyErrorInterceptors(error) {
        let result = error;
        for (const interceptor of this.interceptors.error) {
            try {
                result = await interceptor(result) || result;
            } catch (e) {
                // Error interceptors can throw to stop propagation
                throw e;
            }
        }
        return result;
    },

    /**
     * Check if should use mock
     */
    getMockResponse(url, options) {
        if (!this.mockEnabled) return null;

        for (const [pattern, handler] of this.mockHandlers) {
            if (url.includes(pattern) || pattern === '*') {
                return handler(url, options);
            }
        }
        return null;
    },

    /**
     * Fetch with all features
     */
    async fetch(url, options = {}) {
        // Check for mock
        const mockResponse = this.getMockResponse(url, options);
        if (mockResponse) {
            return mockResponse;
        }

        // Apply request interceptors
        const { url: finalUrl, options: finalOptions } = await this.applyRequestInterceptors(url, options);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

        try {
            const response = await fetch(finalUrl, {
                ...finalOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Apply response interceptors
            return await this.applyResponseInterceptors(response);
        } catch (error) {
            clearTimeout(timeoutId);

            // Apply error interceptors
            const processedError = await this.applyErrorInterceptors(error);
            throw processedError;
        }
    },

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(url, options = {}) {
        const maxRetries = options.retries ?? this.config.retries;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.fetch(url, options);
            } catch (error) {
                lastError = error;

                // Don't retry on abort (timeout) or if this was the last attempt
                if (error.name === 'AbortError' || attempt === maxRetries) {
                    break;
                }

                // Don't retry on 4xx client errors
                if (error.message?.includes('4')) {
                    break;
                }

                // Calculate exponential backoff with jitter
                const delay = Math.min(
                    this.config.baseDelay * Math.pow(2, attempt) + Math.random() * 100,
                    this.config.maxDelay
                );

                console.warn(`[ApiClient] Retry ${attempt + 1}/${maxRetries} for ${url} in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    },

    /**
     * JSON fetch helper
     */
    async fetchJson(url, options = {}) {
        const response = await this.fetchWithRetry(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
```

---

### 2.2 Refactor ReviewsService to Use API Client

```javascript
// Updated js/reviews.js structure
const ReviewsService = {
    API_URL: 'https://api.jikan.moe/v4',
    maxReviewsTotal: 9,
    maxReviewsPerSentiment: 3,
    minReviewLength: 120,
    includeSpoilers: false,
    includePreliminary: false,
    reviewsPage: 1,

    // Retry configuration (now handled by ApiClient)
    maxRetries: 3,

    // Cache
    cache: new Map(),
    descriptionCachePrefix: 'rekonime:description:',
    descriptionCacheTtlMs: 1000 * 60 * 60 * 24 * 30,

    // Retry attempts tracking
    retryAttempts: new Map(),

    /**
     * Initialize the service
     */
    init() {
        // Setup error interceptor for rate limiting
        ApiClient.addErrorInterceptor(async (error) => {
            if (error.message?.includes('429')) {
                console.warn('[ReviewsService] Rate limited by Jikan API');
                // Could trigger circuit breaker here
            }
            return error;
        });
    },

    /**
     * Build reviews URL using ApiClient
     */
    buildReviewsUrl(malId) {
        if (!malId) return '';
        const parsedId = Number.parseInt(malId, 10);
        if (!Number.isFinite(parsedId)) return '';

        return ApiClient.getUrl('jikan', `anime/${parsedId}/reviews`, {
            page: this.reviewsPage,
            spoiler: this.includeSpoilers ? 'true' : undefined,
            preliminary: this.includePreliminary ? 'true' : undefined
        });
    },

    /**
     * Build anime details URL
     */
    buildAnimeUrl(malId) {
        if (!malId) return '';
        const parsedId = Number.parseInt(malId, 10);
        if (!Number.isFinite(parsedId)) return '';

        return ApiClient.getUrl('jikan', `anime/${parsedId}`);
    },

    /**
     * Fetch synopsis with multi-source fallback
     */
    async fetchSynopsis(malId) {
        try {
            const result = await DataProvider.getSynopsis(malId);
            return result.synopsis;
        } catch (error) {
            console.error('[fetchSynopsis] Failed:', error);
            return '';
        }
    },

    /**
     * Fetch reviews with full resilience stack
     */
    async fetchReviews(malId, title, isManualRetry = false) {
        const cacheKey = malId || title;

        if (isManualRetry) {
            this.resetRetryCount(cacheKey);
        }

        if (this.cache.has(cacheKey) && !isManualRetry) {
            return this.cache.get(cacheKey);
        }

        const cachedDescription = this.getCachedDescription(cacheKey);

        try {
            // Try DataProvider first (includes fallback chain)
            const result = await DataProvider.getReviews(malId, title, {
                page: this.reviewsPage,
                includeSpoilers: this.includeSpoilers,
                includePreliminary: this.includePreliminary
            });

            // Process reviews
            const reviews = result.reviews || [];

            // Get synopsis if not from cache
            let description = cachedDescription;
            if (!description) {
                const synopsisResult = await this.fetchSynopsis(malId);
                if (synopsisResult) {
                    description = synopsisResult;
                    this.setCachedDescription(cacheKey, synopsisResult);
                }
            }

            const categorized = this.categorizeReviews(reviews);

            const output = {
                ...categorized,
                description,
                source: result.source,
                retryAttempt: this.getRetryCount(cacheKey),
                maxRetries: this.maxRetries
            };

            this.resetRetryCount(cacheKey);
            this.cache.set(cacheKey, output);
            return output;

        } catch (error) {
            console.error('[fetchReviews] Failed:', error);

            return {
                positive: [],
                neutral: [],
                negative: [],
                description: cachedDescription || '',
                error: true,
                errorMessage: error.message,
                retryAttempt: this.getRetryCount(cacheKey),
                maxRetries: this.maxRetries,
                canRetry: true
            };
        }
    },

    // ... rest of existing methods (sanitize, categorize, render, etc.)
};

// Auto-initialize
ReviewsService.init();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewsService;
}
```

---

### 2.3 Refactor App.fetchCatalog to Use API Client

```javascript
// In js/app.js, update fetchCatalog method:
async fetchCatalog(path, options = {}) {
    if (!path) return null;

    try {
        const data = await ApiClient.fetchJson(this.getAssetPath(path), {
            timeout: options.timeout || 10000,
            retries: options.maxRetries || 3,
            cache: options.cache || 'force-cache'
        });

        // Validate catalog payload
        if (!this.isValidCatalogPayload(data)) {
            throw new Error('Invalid catalog payload structure');
        }

        return data;
    } catch (error) {
        console.error('[fetchCatalog] Failed:', error);
        return null;
    }
},

/**
 * Validate catalog payload structure
 */
isValidCatalogPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!Array.isArray(payload.anime)) return false;

    // Check minimum required fields for first item
    const firstItem = payload.anime[0];
    if (!firstItem) return true; // Empty array is valid

    return (
        typeof firstItem.id !== 'undefined' &&
        typeof firstItem.title === 'string'
    );
}
```

---

## 3. Testing Infrastructure

### 3.1 Mock Utilities

```javascript
// Add to new file: js/apiMocks.js
/**
 * Mock utilities for API testing
 */
const ApiMocks = {
    /**
     * Enable mocking for tests
     */
    setup() {
        ApiClient.enableMock();
    },

    /**
     * Disable mocking
     */
    teardown() {
        ApiClient.disableMock();
        ApiClient.clearMocks();
    },

    /**
     * Mock Jikan anime endpoint
     */
    mockJikanAnime(animeData) {
        ApiClient.mock('anime/', () => {
            return {
                ok: true,
                status: 200,
                json: async () => ({ data: animeData })
            };
        });
    },

    /**
     * Mock Jikan reviews endpoint
     */
    mockJikanReviews(reviews, pagination = {}) {
        ApiClient.mock('reviews', () => {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    data: reviews,
                    pagination
                })
            };
        });
    },

    /**
     * Mock error response
     */
    mockError(endpoint, status, message) {
        ApiClient.mock(endpoint, () => {
            return {
                ok: false,
                status,
                statusText: message
            };
        });
    },

    /**
     * Mock network failure
     */
    mockNetworkError(endpoint) {
        ApiClient.mock(endpoint, () => {
            throw new Error('Network error');
        });
    },

    /**
     * Mock rate limit
     */
    mockRateLimit(endpoint) {
        ApiClient.mock(endpoint, () => {
            return {
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                headers: new Map([['Retry-After', '60']])
            };
        });
    },

    /**
     * Sample anime data
     */
    sampleAnime: {
        mal_id: 1,
        title: 'Test Anime',
        synopsis: 'A test anime synopsis',
        score: 8.5,
        episodes: 12
    },

    /**
     * Sample review data
     */
    sampleReview: {
        mal_id: 1,
        review: 'Great anime!',
        score: 9,
        date: '2024-01-01',
        is_spoiler: false,
        is_preliminary: false,
        user: {
            username: 'TestUser',
            images: {
                jpg: {
                    image_url: 'https://example.com/avatar.jpg'
                }
            }
        },
        reactions: {
            overall: 10,
            nice: 5,
            love_it: 3,
            funny: 2
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiMocks;
}
```

---

## 4. Implementation Priority

### Phase 1: Core Resilience (Critical)
1. **Token Bucket Rate Limiter** - Prevent 429 errors
2. **DataProvider with Fallback** - Alternative data sources
3. **Basic ApiClient** - Unified fetch interface
4. **Schema Validation** - Runtime type checking

### Phase 2: API Hardening (High)
5. **Version Management** - Handle API deprecation
6. **Request/Response Interceptors** - Centralized handling
7. **Mock Infrastructure** - Testing capabilities
8. **Circuit Breaker Integration** - From reliability plan

### Phase 3: Monitoring (Medium)
9. **API Health Metrics** - Track success rates
10. **Deprecation Warnings** - UI notifications
11. **Rate Limit Monitoring** - Usage dashboards

---

## 5. File Structure

```
js/
├── api/
│   ├── apiClient.js          # Unified API client
│   ├── rateLimiter.js        # Token bucket rate limiting
│   ├── dataProvider.js       # Multi-source data provider
│   ├── schemaValidator.js    # Runtime schema validation
│   └── apiMocks.js           # Testing mocks
├── reviews.js                # Refactored to use API layer
└── app.js                    # Refactored fetchCatalog
```

---

## 6. Migration Guide

### Step 1: Create New Files
- Create `js/api/` directory
- Implement `rateLimiter.js`
- Implement `schemaValidator.js`
- Implement `dataProvider.js`
- Extend `apiClient.js`

### Step 2: Update ReviewsService
- Replace direct fetch with ApiClient
- Integrate RateLimiter
- Add DataProvider fallback
- Add schema validation

### Step 3: Update App
- Refactor `fetchCatalog` to use ApiClient
- Add payload validation
- Update error handling

### Step 4: Update HTML
```html
<!-- Add before other scripts in index.html -->
<script src="js/api/schemaValidator.js"></script>
<script src="js/api/rateLimiter.js"></script>
<script src="js/api/apiClient.js"></script>
<script src="js/api/dataProvider.js"></script>
<!-- existing scripts -->
```

### Step 5: Testing
- Add mock utilities
- Write tests for API layer
- Test fallback scenarios
- Test rate limiting

---

## 7. Success Metrics

| Metric | Current (Est.) | Target |
|--------|---------------|--------|
| 429 Rate Limit Errors | ~5% | < 1% |
| API Failure Recovery | 50% | > 95% |
| Schema Validation Coverage | 0% | 100% |
| Test Coverage (API layer) | 0% | > 80% |
| Time to Add New API Source | Hours | Minutes |
| Mock Setup Time | N/A | < 5 min |

---

## 8. Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| js/api/apiClient.js | Create | Unified API client with interceptors |
| js/api/rateLimiter.js | Create | Token bucket rate limiter |
| js/api/dataProvider.js | Create | Multi-source data provider |
| js/api/schemaValidator.js | Create | Runtime schema validation |
| js/api/apiMocks.js | Create | Testing mock utilities |
| js/reviews.js | Modify | Use new API layer |
| js/app.js | Modify | Refactor fetchCatalog |
| index.html | Modify | Include new scripts |
| bookmarks.html | Modify | Include new scripts |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Architect | Initial remediation plan |

---

*This document is a living specification. Update as implementation progresses.*
