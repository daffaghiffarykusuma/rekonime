# Reliability & Resilience Gaps Remediation Plan

## Executive Summary

This document outlines the plan to address reliability and resilience gaps identified in the Gap Identification Report. The remediation focuses on three main areas: error handling improvements, circuit breaker implementation for external APIs, and health check/monitoring systems.

---

## 1. Error Handling Matrix Improvements

### 1.1 fetchCatalog() - Add Retry Logic with Timeout

**Current State (Gap)**
- Network errors caught but no retry logic
- No timeout handling
- Silent failures return null
- Lines 1103-1112 in js/app.js

**Current Implementation:**
```javascript
async fetchCatalog(path) {
    if (!path) return null;
    try {
      const response = await fetch(this.getAssetPath(path), { cache: 'force-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
}
```

**Remediation Strategy: Retry with Exponential Backoff**

```javascript
// Add to App configuration
fetchConfig: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    timeout: 10000, // 10 second timeout
},

/**
 * Fetch catalog with retry logic and timeout
 */
async fetchCatalog(path, options = {}) {
    if (!path) return null;
    
    const maxRetries = options.maxRetries ?? this.fetchConfig.maxRetries;
    const baseDelay = options.baseDelay ?? this.fetchConfig.baseDelay;
    const maxDelay = options.maxDelay ?? this.fetchConfig.maxDelay;
    const timeout = options.timeout ?? this.fetchConfig.timeout;
    
    const fetchWithTimeout = async (url, fetchOptions) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    };
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(
                this.getAssetPath(path), 
                { cache: attempt === 0 ? 'force-cache' : 'no-cache' }
            );
            
            if (!response.ok) {
                // Only retry on 5xx errors or network failures
                if (response.status >= 500 || response.status === 429) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return null; // 4xx errors are not retryable
            }
            
            // Validate JSON structure
            const data = await response.json();
            if (!this.isValidCatalogPayload(data)) {
                throw new Error('Invalid catalog payload structure');
            }
            
            return data;
            
        } catch (error) {
            lastError = error;
            
            // Don't retry on abort (timeout) or if this was the last attempt
            if (error.name === 'AbortError' || attempt === maxRetries) {
                break;
            }
            
            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) + Math.random() * 100,
                maxDelay
            );
            
            console.warn(`[fetchCatalog] Retry ${attempt + 1}/${maxRetries} for ${path} in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    console.error(`[fetchCatalog] Failed after ${maxRetries + 1} attempts:`, lastError);
    return null;
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

**Files to modify:**
- js/app.js: Lines 1103-1112

---

### 1.2 loadEmbeddedData() - Add Validation and Soft Fail

**Current State (Gap)**
- No data validation
- Hard fail if ANIME_DATA undefined
- Silent failure pattern
- Lines 1205-1239 in js/app.js

**Remediation Strategy: Validation with Graceful Degradation**

```javascript
/**
 * Load embedded data with validation and soft fail
 */
async loadEmbeddedData() {
    // Check if already loaded
    if (typeof ANIME_DATA !== 'undefined') {
        const validated = this.validateAnimeData(ANIME_DATA.anime);
        if (validated.isValid) {
            this.animeData = this.normalizeAnimeData(ANIME_DATA.anime);
            return true;
        }
        console.warn('[loadEmbeddedData] Embedded data validation failed:', validated.errors);
    }

    try {
        await this.loadEmbeddedDataScript();
    } catch (error) {
        console.error('[loadEmbeddedData] Failed to load script:', error);
        return false;
    }

    if (typeof ANIME_DATA === 'undefined') {
        console.error('[loadEmbeddedData] ANIME_DATA not defined after script load');
        return false;
    }
    
    // Validate the loaded data
    const validated = this.validateAnimeData(ANIME_DATA.anime);
    if (!validated.isValid) {
        console.error('[loadEmbeddedData] Data validation failed:', validated.errors);
        return false;
    }

    this.animeData = this.normalizeAnimeData(ANIME_DATA.anime);
    return true;
},

/**
 * Validate anime data structure
 * @returns {Object} Validation result with isValid flag and errors array
 */
validateAnimeData(animeList) {
    const errors = [];
    
    if (!Array.isArray(animeList)) {
        return { isValid: false, errors: ['anime is not an array'] };
    }
    
    if (animeList.length === 0) {
        return { isValid: true, errors: [], isEmpty: true };
    }
    
    // Sample validation on first few items
    const sampleSize = Math.min(animeList.length, 5);
    for (let i = 0; i < sampleSize; i++) {
        const anime = animeList[i];
        
        if (!anime) {
            errors.push(`Item ${i} is null/undefined`);
            continue;
        }
        
        if (typeof anime.id === 'undefined') {
            errors.push(`Item ${i} missing id`);
        }
        
        if (!anime.title || typeof anime.title !== 'string') {
            errors.push(`Item ${i} missing or invalid title`);
        }
    }
    
    // Consider valid if less than 20% of samples have errors
    const isValid = errors.length < sampleSize * 0.2;
    
    return { isValid, errors, itemCount: animeList.length };
},

/**
 * Load embedded data script with retry
 */
loadEmbeddedDataScript() {
    if (this.embeddedDataPromise) {
        return this.embeddedDataPromise;
    }

    this.embeddedDataPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = this.getAssetPath('js/data.js');
        script.async = true;
        
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Script load timeout'));
        }, 10000);
        
        const cleanup = () => {
            clearTimeout(timeoutId);
            script.onload = null;
            script.onerror = null;
        };
        
        script.onload = () => {
            cleanup();
            resolve();
        };
        
        script.onerror = () => {
            cleanup();
            reject(new Error('Failed to load embedded anime data'));
        };
        
        document.head.appendChild(script);
    });

    return this.embeddedDataPromise;
}
```

**Files to modify:**
- js/app.js: Lines 1205-1239

---

### 1.3 loadFullCatalog() - Add Timeout and Degradation

**Current State (Gap)**
- No timeout on loading
- No partial data handling
- No degradation strategy
- Lines 1059-1101 in js/app.js

**Remediation Strategy: Timeout with Partial Data Support**

```javascript
async loadFullCatalog(options = {}) {
    const timeout = options.timeout ?? 30000; // 30 second default
    
    if (this.isFullDataLoaded) {
        return true;
    }

    if (this.fullCatalogPromise) {
        return this.fullCatalogPromise;
    }

    this.loadingFullCatalog = true;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    this.fullCatalogPromise = (async () => {
        try {
            if (window.location.protocol === 'file:') {
                const loaded = await this.loadEmbeddedData();
                if (!loaded) {
                    return false;
                }
                this.applyCatalogPayload(
                    { anime: this.animeData }, 
                    { isFull: true, preserveFilters: true }
                );
                return true;
            }

            // Try full catalog first
            let fullPayload = await this.fetchCatalog(this.dataSources.full);
            
            // If aborted, return current state
            if (controller.signal.aborted) {
                console.warn('[loadFullCatalog] Aborted due to timeout');
                return this.isFullDataLoaded; // Return current state
            }
            
            // Try legacy if full not available
            if (!fullPayload) {
                fullPayload = await this.fetchCatalog(this.dataSources.legacy);
            }

            if (!fullPayload) {
                // Last resort: embedded data
                const loaded = await this.loadEmbeddedData();
                if (!loaded) {
                    return false;
                }
                this.applyCatalogPayload(
                    { anime: this.animeData }, 
                    { isFull: true, preserveFilters: true }
                );
                return true;
            }

            this.applyCatalogPayload(fullPayload, { isFull: true, preserveFilters: true });
            return true;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('[loadFullCatalog] Request timed out');
                return this.isFullDataLoaded;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    })();

    try {
        const result = await this.fullCatalogPromise;
        this.isFullDataLoaded = Boolean(result);
        return result;
    } catch (error) {
        console.error('[loadFullCatalog] Unexpected error:', error);
        return false;
    } finally {
        this.loadingFullCatalog = false;
        this.fullCatalogPromise = null;
    }
}
```

**Files to modify:**
- js/app.js: Lines 1059-1101

---

## 2. Circuit Breaker Implementation

### 2.1 Jikan API Circuit Breaker

**Current State (Gap)**
- Retry logic exists but no circuit breaker
- Under sustained failures, could overwhelm API
- No failure rate tracking
- Lines 13-16, 265-346 in js/reviews.js

**Remediation Strategy: Circuit Breaker Pattern**

```javascript
// Add new file: js/circuitBreaker.js
/**
 * Circuit Breaker pattern implementation for external API calls
 */
const CircuitBreaker = {
    // Circuit states
    states: {
        CLOSED: 'CLOSED',       // Normal operation
        OPEN: 'OPEN',           // Failing, reject requests
        HALF_OPEN: 'HALF_OPEN'  // Testing if service recovered
    },
    
    // Circuit configuration
    config: {
        failureThreshold: 5,        // Open after 5 failures
        resetTimeout: 60000,        // Try again after 60 seconds
        halfOpenMaxCalls: 3         // Max calls in half-open state
    },
    
    // Circuit state storage
    circuits: new Map(),
    
    /**
     * Get or create circuit for a service
     */
    getCircuit(serviceName) {
        if (!this.circuits.has(serviceName)) {
            this.circuits.set(serviceName, {
                state: this.states.CLOSED,
                failures: 0,
                lastFailureTime: null,
                successCount: 0,
                halfOpenCalls: 0
            });
        }
        return this.circuits.get(serviceName);
    },
    
    /**
     * Check if request should be allowed
     */
    canExecute(serviceName) {
        const circuit = this.getCircuit(serviceName);
        
        switch (circuit.state) {
            case this.states.CLOSED:
                return { allowed: true };
                
            case this.states.OPEN:
                // Check if reset timeout has passed
                if (Date.now() - circuit.lastFailureTime > this.config.resetTimeout) {
                    circuit.state = this.states.HALF_OPEN;
                    circuit.halfOpenCalls = 0;
                    return { allowed: true, state: this.states.HALF_OPEN };
                }
                return { 
                    allowed: false, 
                    reason: 'Circuit breaker is OPEN',
                    retryAfter: Math.ceil((this.config.resetTimeout - (Date.now() - circuit.lastFailureTime)) / 1000)
                };
                
            case this.states.HALF_OPEN:
                if (circuit.halfOpenCalls < this.config.halfOpenMaxCalls) {
                    circuit.halfOpenCalls++;
                    return { allowed: true, state: this.states.HALF_OPEN };
                }
                return { allowed: false, reason: 'Circuit breaker is HALF_OPEN (testing)' };
        }
    },
    
    /**
     * Record successful call
     */
    recordSuccess(serviceName) {
        const circuit = this.getCircuit(serviceName);
        
        if (circuit.state === this.states.HALF_OPEN) {
            circuit.successCount++;
            
            // If enough successes in half-open, close the circuit
            if (circuit.successCount >= this.config.halfOpenMaxCalls) {
                this.reset(serviceName);
            }
        } else {
            // Reset failures on success in closed state
            circuit.failures = 0;
        }
    },
    
    /**
     * Record failed call
     */
    recordFailure(serviceName) {
        const circuit = this.getCircuit(serviceName);
        
        circuit.failures++;
        circuit.lastFailureTime = Date.now();
        
        if (circuit.state === this.states.HALF_OPEN) {
            // Failure in half-open goes back to open
            circuit.state = this.states.OPEN;
            circuit.halfOpenCalls = 0;
            circuit.successCount = 0;
        } else if (circuit.failures >= this.config.failureThreshold) {
            circuit.state = this.states.OPEN;
        }
    },
    
    /**
     * Reset circuit to closed state
     */
    reset(serviceName) {
        this.circuits.set(serviceName, {
            state: this.states.CLOSED,
            failures: 0,
            lastFailureTime: null,
            successCount: 0,
            halfOpenCalls: 0
        });
    },
    
    /**
     * Execute function with circuit breaker protection
     */
    async execute(serviceName, fn) {
        const check = this.canExecute(serviceName);
        
        if (!check.allowed) {
            throw new Error(`Circuit breaker open for ${serviceName}: ${check.reason}`);
        }
        
        try {
            const result = await fn();
            this.recordSuccess(serviceName);
            return result;
        } catch (error) {
            this.recordFailure(serviceName);
            throw error;
        }
    },
    
    /**
     * Get circuit status for monitoring
     */
    getStatus(serviceName) {
        const circuit = this.getCircuit(serviceName);
        return {
            service: serviceName,
            ...circuit,
            isHealthy: circuit.state === this.states.CLOSED
        };
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CircuitBreaker;
}
```

**Integration with ReviewsService:**

```javascript
// In js/reviews.js, modify fetchReviews method:
async fetchReviews(malId, title, isManualRetry = false) {
    const cacheKey = malId || title;
    
    // Check circuit breaker before making request
    const circuitCheck = CircuitBreaker.canExecute('jikan-api');
    if (!circuitCheck.allowed) {
        console.warn(`[fetchReviews] Circuit breaker preventing request: ${circuitCheck.reason}`);
        return {
            positive: [],
            neutral: [],
            negative: [],
            description: this.getCachedDescription(cacheKey) || '',
            error: true,
            errorMessage: circuitCheck.reason,
            circuitOpen: true,
            retryAfter: circuitCheck.retryAfter
        };
    }
    
    if (isManualRetry) {
        this.resetRetryCount(cacheKey);
        CircuitBreaker.reset('jikan-api'); // Reset circuit on manual retry
    }

    const cached = this.getCacheEntry(cacheKey);
    if (cached && !isManualRetry) {
        return cached;
    }

    const cachedDescription = this.getCachedDescription(cacheKey);

    try {
        const result = await CircuitBreaker.execute('jikan-api', async () => {
            const url = this.buildReviewsUrl(malId);
            if (!url) {
                throw new Error('Missing MAL id for reviews');
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
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

        this.setCacheEntry(cacheKey, result);
        return result;

    } catch (error) {
        console.error('Failed to fetch reviews:', error);
        
        const isCircuitOpen = error.message?.includes('Circuit breaker');
        
        return {
            positive: [],
            neutral: [],
            negative: [],
            description: cachedDescription || '',
            error: true,
            errorMessage: error.message,
            circuitOpen: isCircuitOpen,
            retryAttempt: this.getRetryCount(cacheKey),
            maxRetries: this.maxRetries,
            canRetry: !isCircuitOpen && this.getRetryCount(cacheKey) < this.maxRetries
        };
    }
}
```

**Files to create/modify:**
- js/circuitBreaker.js (new file)
- js/reviews.js: Integrate circuit breaker

---

## 3. Health Check System

### 3.1 Connectivity Monitoring

**Current State (Gap)**
- Only uses navigator.onLine
- No periodic connectivity checks
- No stale data detection
- Lines 118-123, 155-170 in js/serviceWorker.js

**Remediation Strategy: Comprehensive Health Monitoring**

```javascript
// Add to js/serviceWorker.js or create js/healthMonitor.js
/**
 * Health Monitor - Tracks system health and connectivity
 */
const HealthMonitor = {
    // Configuration
    config: {
        connectivityCheckInterval: 30000,    // Check every 30 seconds
        staleDataThreshold: 5 * 60 * 1000,   // Data older than 5 min is stale
        healthCheckTimeout: 5000             // 5 second timeout for checks
    },
    
    // State
    isOnline: navigator.onLine,
    lastConnectivityCheck: null,
    dataFreshness: new Map(),
    listeners: [],
    checkIntervalId: null,
    
    // Service health status
    services: {
        'jikan-api': { healthy: true, lastCheck: null, latency: null },
        'catalog-data': { healthy: true, lastCheck: null, latency: null },
        'embedded-data': { healthy: true, lastCheck: null, latency: null }
    },
    
    /**
     * Initialize health monitoring
     */
    init() {
        this.setupConnectivityListeners();
        this.startPeriodicChecks();
        this.performInitialChecks();
    },
    
    /**
     * Setup online/offline event listeners
     */
    setupConnectivityListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('connectivity', { online: true });
            this.performHealthChecks(); // Immediate check on reconnect
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('connectivity', { online: false });
        });
    },
    
    /**
     * Start periodic health checks
     */
    startPeriodicChecks() {
        if (this.checkIntervalId) return;
        
        this.checkIntervalId = setInterval(() => {
            this.performHealthChecks();
        }, this.config.connectivityCheckInterval);
    },
    
    /**
     * Stop periodic checks
     */
    stopPeriodicChecks() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
    },
    
    /**
     * Perform initial health checks
     */
    async performInitialChecks() {
        await this.performHealthChecks();
    },
    
    /**
     * Perform comprehensive health checks
     */
    async performHealthChecks() {
        this.lastConnectivityCheck = Date.now();
        
        // Check each service
        await Promise.all([
            this.checkJikanApi(),
            this.checkCatalogData()
        ]);
        
        this.notifyListeners('health-check', this.getHealthStatus());
    },
    
    /**
     * Check Jikan API health
     */
    async checkJikanApi() {
        const startTime = performance.now();
        const service = this.services['jikan-api'];
        
        try {
            // Use a simple endpoint for health check
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);
            
            const response = await fetch('https://api.jikan.moe/v4/schedules?limit=1', {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            service.healthy = response.ok;
            service.latency = Math.round(performance.now() - startTime);
            service.lastCheck = Date.now();
            
        } catch (error) {
            service.healthy = false;
            service.latency = null;
            service.lastCheck = Date.now();
            service.error = error.message;
        }
    },
    
    /**
     * Check catalog data freshness
     */
    async checkCatalogData() {
        const service = this.services['catalog-data'];
        
        try {
            const response = await fetch('data/anime.preview.json', { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            service.healthy = response.ok;
            service.lastCheck = Date.now();
            
            // Check if we have a generatedAt timestamp
            const generatedAt = response.headers.get('x-generated-at') || 
                               (typeof ANIME_DATA !== 'undefined' ? ANIME_DATA.generatedAt : null);
            
            if (generatedAt) {
                this.dataFreshness.set('catalog', new Date(generatedAt).getTime());
            }
            
        } catch (error) {
            service.healthy = false;
            service.lastCheck = Date.now();
            service.error = error.message;
        }
    },
    
    /**
     * Mark data as fresh
     */
    markDataFresh(dataType, timestamp = Date.now()) {
        this.dataFreshness.set(dataType, timestamp);
    },
    
    /**
     * Check if data is stale
     */
    isDataStale(dataType) {
        const timestamp = this.dataFreshness.get(dataType);
        if (!timestamp) return true;
        
        return Date.now() - timestamp > this.config.staleDataThreshold;
    },
    
    /**
     * Get overall health status
     */
    getHealthStatus() {
        const serviceHealth = Object.entries(this.services).map(([name, status]) => ({
            name,
            ...status
        }));
        
        const allHealthy = serviceHealth.every(s => s.healthy);
        const anyHealthy = serviceHealth.some(s => s.healthy);
        
        return {
            online: this.isOnline,
            healthy: allHealthy,
            degraded: anyHealthy && !allHealthy,
            services: serviceHealth,
            lastCheck: this.lastConnectivityCheck,
            staleData: {
                catalog: this.isDataStale('catalog')
            }
        };
    },
    
    /**
     * Subscribe to health events
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    },
    
    /**
     * Notify all listeners
     */
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Health monitor listener error:', error);
            }
        });
    },
    
    /**
     * Trigger automatic refresh on reconnection
     */
    async onReconnection() {
        console.log('[HealthMonitor] Reconnected, checking for stale data...');
        
        // Check if catalog data is stale
        if (this.isDataStale('catalog')) {
            console.log('[HealthMonitor] Catalog data is stale, triggering refresh...');
            
            // Trigger data refresh
            if (typeof App !== 'undefined' && App.loadFullCatalog) {
                try {
                    await App.loadFullCatalog();
                    this.markDataFresh('catalog');
                    console.log('[HealthMonitor] Catalog data refreshed successfully');
                } catch (error) {
                    console.error('[HealthMonitor] Failed to refresh catalog:', error);
                }
            }
        }
    }
};

// Auto-initialize
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => HealthMonitor.init());
    } else {
        HealthMonitor.init();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HealthMonitor;
}
```

**Files to create/modify:**
- js/healthMonitor.js (new file)
- js/serviceWorker.js: Integrate health monitor

---

### 3.2 UI Health Indicator

```javascript
// Add to js/app.js
/**
 * Render health status indicator
 */
renderHealthIndicator() {
    if (typeof HealthMonitor === 'undefined') return;
    
    const status = HealthMonitor.getHealthStatus();
    const existingIndicator = document.getElementById('health-indicator');
    
    // Only show indicator if degraded or offline
    if (status.online && status.healthy) {
        if (existingIndicator) {
            existingIndicator.remove();
        }
        return;
    }
    
    const indicator = existingIndicator || document.createElement('div');
    indicator.id = 'health-indicator';
    indicator.className = `health-indicator ${status.online ? 'degraded' : 'offline'}`;
    
    let message = '';
    let icon = '';
    
    if (!status.online) {
        icon = '📡';
        message = 'Offline - Using cached data';
    } else if (status.degraded) {
        icon = '⚠️';
        const unhealthyServices = status.services
            .filter(s => !s.healthy)
            .map(s => s.name)
            .join(', ');
        message = `Degraded - ${unhealthyServices} unavailable`;
    }
    
    indicator.innerHTML = `
        <span class="health-icon">${icon}</span>
        <span class="health-message">${message}</span>
        ${!status.online ? '<button class="health-retry" data-action="check-connectivity">Retry</button>' : ''}
    `;
    
    if (!existingIndicator) {
        document.body.appendChild(indicator);
    }
},

/**
 * Setup health monitoring integration
 */
setupHealthMonitoring() {
    if (typeof HealthMonitor === 'undefined') return;
    
    // Subscribe to health events
    HealthMonitor.subscribe((event, data) => {
        if (event === 'connectivity') {
            if (data.online) {
                HealthMonitor.onReconnection();
            }
        }
        
        // Update UI
        this.renderHealthIndicator();
    });
    
    // Initial render
    this.renderHealthIndicator();
}
```

**CSS for health indicator:**

```css
/* Add to css/styles.css */
.health-indicator {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
}

.health-indicator.offline {
    background: var(--error-bg, #fee2e2);
    color: var(--error-text, #991b1b);
    border: 1px solid var(--error-border, #fca5a5);
}

.health-indicator.degraded {
    background: var(--warning-bg, #fef3c7);
    color: var(--warning-text, #92400e);
    border: 1px solid var(--warning-border, #fcd34d);
}

.health-icon {
    font-size: 1.25rem;
}

.health-retry {
    margin-left: 0.5rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid currentColor;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-size: 0.75rem;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(1rem);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

---

## 4. Implementation Priority

### Phase 1: Critical Reliability (High Impact)
1. **fetchCatalog() Retry Logic** - Prevent transient failures
2. **loadEmbeddedData() Validation** - Ensure data integrity
3. **Circuit Breaker for Jikan** - Prevent API overload
4. **Basic Health Monitoring** - Track connectivity

### Phase 2: Resilience Improvements (Medium Impact)
5. **loadFullCatalog() Timeout** - Prevent indefinite loading
6. **Health Indicator UI** - User feedback on system state
7. **Automatic Refresh on Reconnect** - Stale data handling
8. **Service Health Dashboard** - Detailed monitoring

### Phase 3: Advanced Reliability (Lower Impact)
9. **Metrics Collection** - Performance tracking
10. **Alerting System** - Proactive notifications
11. **Fallback Content Strategies** - Graceful degradation

---

## 5. Testing Checklist

After implementing fixes, verify:

### Reliability Tests
- [ ] fetchCatalog retries on network failure
- [ ] fetchCatalog returns null on 4xx errors (no retry)
- [ ] Circuit breaker opens after threshold failures
- [ ] Circuit breaker closes after recovery period
- [ ] loadEmbeddedData validates data structure
- [ ] loadFullCatalog times out appropriately
- [ ] Health monitor detects connectivity changes
- [ ] Stale data detection works correctly

### Resilience Tests
- [ ] App works offline with cached data
- [ ] App recovers gracefully from API failures
- [ ] Circuit breaker prevents overwhelming Jikan API
- [ ] Health indicator shows correct status
- [ ] Automatic refresh triggers on reconnection
- [ ] All error states have user-friendly messages

### Edge Cases
- [ ] Very slow network (timeout scenarios)
- [ ] Intermittent connectivity (frequent on/off)
- [ ] Malformed JSON responses
- [ ] Empty catalog data
- [ ] Concurrent request failures
- [ ] Browser storage quota exceeded

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| js/app.js | Add retry logic, validation, timeout handling |
| js/reviews.js | Integrate circuit breaker |
| js/circuitBreaker.js | New file - circuit breaker implementation |
| js/healthMonitor.js | New file - health monitoring system |
| js/serviceWorker.js | Integrate health monitor |
| css/styles.css | Health indicator styles |
| index.html | Include new scripts |

---

## 7. Success Metrics

| Metric | Current (Est.) | Target |
|--------|---------------|--------|
| Transient failure recovery | 0% | > 95% |
| Circuit breaker triggers | N/A | < 5% of requests |
| Data validation failures | Silent | Logged + handled |
| Time to detect offline | ~5s | < 2s |
| Stale data refresh | Manual | Automatic |
| Error message clarity | Poor | User-friendly |

---

## 8. Rollback Plan

If issues arise:

1. **Feature Flags**: Implement each reliability feature behind a flag:
    ```javascript
    reliability: {
        retryLogic: true,
        circuitBreaker: true,
        healthMonitoring: false
    }
    ```

2. **Quick Disable**: All features can be disabled by setting flags to `false`.

3. **Fallback Behavior**: When disabled, fall back to current (less reliable) behavior.

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Architect | Initial remediation plan |

---

*This document is a living specification. As implementation progresses, update the status and mark completed items.*
