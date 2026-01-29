# Operational & Observability Gaps Remediation Plan

## Gap Summary

Based on analysis of the Rekonime codebase, this plan addresses critical operational and observability gaps that impact debugging, monitoring, deployment reliability, and user experience visibility.

### Current State Analysis

| Component | Current Implementation | Gap |
|-----------|----------------------|-----|
| Error Logging | `console.error()` only | No structured logging, severity levels, or context |
| Analytics | Optional `gtag` with no fallback | Events lost if gtag fails to load |
| Performance Monitoring | None | No Core Web Vitals tracking or RUM |
| Error Tracking | None | No error aggregation service (Sentry, etc.) |
| API Monitoring | None | No uptime monitoring for Jikan API |
| Data Quality | `validate-data.js` CLI only | No runtime data validation or alerts |
| Deployment | Manual process | No staging environment or rollback strategy |
| Cache Versioning | Hardcoded `v1` in sw.js | Manual version bumps required |

---

## Remediation Strategy

### Phase 1: Structured Logging & Error Tracking

#### 1.1 Create Logger Module (`js/logger.js`)

**Purpose**: Structured logging with severity levels, context enrichment, and multiple transports.

**Features**:
- Log levels: DEBUG, INFO, WARN, ERROR, FATAL
- Context enrichment (user agent, URL, timestamp, session ID)
- Batched log buffering for performance
- LocalStorage persistence for offline scenarios
- Console and remote transport support

**Implementation Sketch**:
```javascript
const Logger = {
  levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 },
  currentLevel: 1, // INFO by default
  buffer: [],
  maxBufferSize: 100,
  
  log(level, message, context = {}) {
    if (level < this.currentLevel) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      level: this.levels[level],
      message,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId(),
        ...context
      }
    };
    
    this.buffer.push(entry);
    console[this.levels[level].toLowerCase()](message, context);
    
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  },
  
  flush() {
    // Send to remote if configured
    // Persist to localStorage as fallback
  }
};
```

**Integration Points**:
- Replace `console.error` in `js/app.js` (line 1013, 3794)
- Replace `console.log` in `js/serviceWorker.js`
- Wrap all async operations with error boundaries

#### 1.2 Error Boundary Implementation

**Purpose**: Catch and report unhandled errors with context.

**Implementation in `js/logger.js`**:
```javascript
initErrorBoundary() {
  window.addEventListener('error', (event) => {
    this.log(this.levels.ERROR, 'Unhandled error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
    this.flush();
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    this.log(this.levels.ERROR, 'Unhandled promise rejection', {
      reason: event.reason?.message || event.reason,
      stack: event.reason?.stack
    });
    this.flush();
  });
}
```

#### 1.3 Sentry Integration (Optional but Recommended)

**Purpose**: Production error tracking with source maps.

**Configuration**:
```javascript
// Only load in production
if (window.location.hostname !== 'localhost' && typeof Sentry !== 'undefined') {
  Sentry.init({
    dsn: 'YOUR_SENTRY_DSN',
    environment: window.location.hostname,
    release: 'rekonime@' + APP_VERSION,
    beforeSend(event) {
      // Sanitize PII
      return sanitizeEvent(event);
    }
  });
}
```

**Acceptance Criteria**:
- [ ] Logger module created with all severity levels
- [ ] All `console.error` calls migrated to structured logger
- [ ] Error boundaries catching unhandled errors
- [ ] Logs include session ID, URL, and user agent
- [ ] Buffer flushing mechanism implemented

---

### Phase 2: Analytics Resilience

#### 2.1 Analytics Wrapper Module (`js/analytics.js`)

**Purpose**: Analytics abstraction with queuing and fallback.

**Gap Addressed**: Current gtag usage (line 4088-4089 in app.js) is optional with no fallback—events are lost if gtag fails.

**Implementation**:
```javascript
const Analytics = {
  queue: [],
  isGtagAvailable: false,
  
  init() {
    this.isGtagAvailable = typeof gtag !== 'undefined';
    this.loadStoredEvents();
    
    // Process queue when gtag becomes available
    if (this.isGtagAvailable) {
      this.processQueue();
    }
  },
  
  track(eventName, params = {}) {
    const event = {
      name: eventName,
      params: {
        ...params,
        timestamp: new Date().toISOString(),
        session_id: this.getSessionId()
      }
    };
    
    if (this.isGtagAvailable) {
      gtag('event', eventName, event.params);
    } else {
      this.queue.push(event);
      this.persistQueue();
    }
  },
  
  persistQueue() {
    try {
      localStorage.setItem('analytics_queue', JSON.stringify(this.queue));
    } catch (e) {
      // Storage full, drop oldest events
      this.queue = this.queue.slice(-50);
    }
  }
};
```

**Integration Points**:
- Replace direct `gtag()` calls in `js/app.js`
- Track: search, filter usage, bookmark actions, modal opens, video plays

**Acceptance Criteria**:
- [ ] Analytics wrapper module created
- [ ] Event queue persistence to localStorage
- [ ] Automatic queue processing when gtag loads
- [ ] All existing gtag calls migrated
- [ ] Custom events for key user journeys

---

### Phase 3: Performance Monitoring (Core Web Vitals)

#### 3.1 Web Vitals Module (`js/performance.js`)

**Purpose**: Track and report Core Web Vitals metrics.

**Metrics to Track**:
- LCP (Largest Contentful Paint)
- FID (First Input Delay) / INP (Interaction to Next Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)
- FCP (First Contentful Paint)
- Custom metrics: data load time, modal open latency

**Implementation**:
```javascript
const PerformanceMonitor = {
  metrics: {},
  
  init() {
    // Use web-vitals library or native PerformanceObserver
    this.observeLCP();
    this.observeCLS();
    this.observeINP();
    this.observeFCP();
    this.observeTTFB();
    
    // Custom metrics
    this.measureDataLoad();
    this.measureModalLatency();
  },
  
  observeLCP() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;
      this.reportMetric('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });
  },
  
  measureDataLoad() {
    const start = performance.now();
    
    // Hook into App.loadInitialData completion
    window.addEventListener('rekonime:data-loaded', () => {
      const duration = performance.now() - start;
      this.reportMetric('data_load', duration);
    });
  },
  
  reportMetric(name, value) {
    // Send to analytics
    Analytics.track('performance_metric', {
      metric_name: name,
      metric_value: Math.round(value),
      value: Math.round(value) // For GA4
    });
  }
};
```

**Integration Points**:
- Initialize in `App.init()` before data loading
- Dispatch custom events at key milestones

**Acceptance Criteria**:
- [ ] Web Vitals module created
- [ ] All Core Web Vitals metrics tracked
- [ ] Custom metrics for app-specific operations
- [ ] Metrics reported to analytics
- [ ] Performance budget warnings (optional)

---

### Phase 4: External API Monitoring

#### 4.1 API Health Monitor (`js/apiMonitor.js`)

**Purpose**: Monitor Jikan API health and response times.

**Gap Addressed**: No visibility into Jikan API failures or latency.

**Implementation**:
```javascript
const ApiMonitor = {
  endpoints: {
    jikan: 'https://api.jikan.moe/v4'
  },
  healthStatus: {},
  
  async checkHealth() {
    const start = performance.now();
    
    try {
      const response = await fetch(`${this.endpoints.jikan}/health`);
      const latency = performance.now() - start;
      
      this.healthStatus.jikan = {
        status: response.ok ? 'healthy' : 'degraded',
        latency,
        lastCheck: new Date().toISOString()
      };
      
      if (latency > 2000) {
        Logger.warn('Jikan API latency high', { latency });
      }
    } catch (error) {
      this.healthStatus.jikan = {
        status: 'down',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
      
      Logger.error('Jikan API unreachable', { error: error.message });
    }
  },
  
  isHealthy(service) {
    return this.healthStatus[service]?.status === 'healthy';
  }
};
```

**Integration Points**:
- Wrap `ReviewsService.fetchReviews()` calls
- Check health before making requests
- Show user-facing indicators for degraded service

**Acceptance Criteria**:
- [ ] API monitor module created
- [ ] Health check endpoint configured
- [ ] Latency tracking implemented
- [ ] User-facing degraded service indicators
- [ ] Health status persisted to localStorage

---

### Phase 5: Data Quality Monitoring

#### 5.1 Runtime Data Validator (`js/dataValidator.js`)

**Purpose**: Validate data integrity at runtime with alerting.

**Gap Addressed**: `tools/validate-data.js` only runs at build time—no runtime validation.

**Implementation**:
```javascript
const DataValidator = {
  schemas: {
    anime: {
      required: ['id', 'title', 'cover'],
      types: {
        id: 'string',
        title: 'string',
        communityScore: 'number|null',
        episodes: 'array'
      }
    }
  },
  
  validateAnime(anime) {
    const errors = [];
    const schema = this.schemas.anime;
    
    // Check required fields
    schema.required.forEach(field => {
      if (!anime[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Check types
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      const value = anime[field];
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (expectedType.includes('null') && value === null) return;
      if (actualType !== expectedType.replace('|null', '')) {
        errors.push(`Invalid type for ${field}: expected ${expectedType}, got ${actualType}`);
      }
    });
    
    if (errors.length > 0) {
      Logger.error('Data validation failed', {
        animeId: anime.id,
        errors
      });
      
      Analytics.track('data_validation_error', {
        anime_id: anime.id,
        error_count: errors.length
      });
    }
    
    return errors.length === 0;
  },
  
  validateCatalog(animeList) {
    const stats = {
      total: animeList.length,
      valid: 0,
      invalid: 0,
      errors: []
    };
    
    animeList.forEach(anime => {
      const isValid = this.validateAnime(anime);
      if (isValid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }
    });
    
    // Alert if invalid ratio exceeds threshold
    if (stats.invalid / stats.total > 0.05) {
      Logger.error('High data invalidity ratio', stats);
    }
    
    return stats;
  }
};
```

**Integration Points**:
- Validate in `App.applyCatalogPayload()`
- Run periodic validation in background

**Acceptance Criteria**:
- [ ] Runtime data validator created
- [ ] Schema definitions for anime objects
- [ ] Validation integrated into data loading
- [ ] Error reporting to analytics
- [ ] Threshold-based alerting

---

### Phase 6: Deployment & Cache Versioning

#### 6.1 Automated Cache Versioning

**Current State**: Hardcoded `const CACHE_VERSION = 'v1'` in sw.js line 6.

**Gap Addressed**: Manual version bumps are error-prone and easily forgotten.

**Implementation**:

Create `tools/generate-version.js`:
```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate version from git commit or timestamp
function generateVersion() {
  try {
    const { execSync } = require('child_process');
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    return `v${Date.now()}-${commit}`;
  } catch {
    return `v${Date.now()}`;
  }
}

// Hash static assets for cache-busting
function hashAssets() {
  const assetsDir = path.join(__dirname, '..', 'js');
  const hash = crypto.createHash('md5');
  
  const files = fs.readdirSync(assetsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(assetsDir, file));
    hash.update(content);
  });
  
  return hash.digest('hex').slice(0, 8);
}

const version = generateVersion();
const assetHash = hashAssets();

// Update sw.js
const swPath = path.join(__dirname, '..', 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
  /const CACHE_VERSION = 'v\d+'/,
  `const CACHE_VERSION = '${version}'`
);
fs.writeFileSync(swPath, swContent);

// Generate version.json for app
const versionPath = path.join(__dirname, '..', 'version.json');
fs.writeFileSync(versionPath, JSON.stringify({
  version,
  assetHash,
  buildTime: new Date().toISOString()
}, null, 2));

console.log(`Generated version: ${version}`);
console.log(`Asset hash: ${assetHash}`);
```

**Update package.json scripts**:
```json
{
  "scripts": {
    "build": "node tools/generate-version.js && node tools/build-catalogs.js",
    "version:bump": "node tools/generate-version.js"
  }
}
```

#### 6.2 Staging Environment Configuration

**Purpose**: Support staging deployments for testing.

**Implementation**:

Create `config/environments.js`:
```javascript
const Environments = {
  development: {
    apiBase: '',
    analyticsId: null,
    logLevel: 'DEBUG',
    features: {
      serviceWorker: false,
      analytics: false
    }
  },
  
  staging: {
    apiBase: 'https://staging.rekonime.com',
    analyticsId: 'GA_STAGING_ID',
    logLevel: 'INFO',
    features: {
      serviceWorker: true,
      analytics: true
    }
  },
  
  production: {
    apiBase: 'https://rekonime.com',
    analyticsId: 'GA_PRODUCTION_ID',
    logLevel: 'WARN',
    features: {
      serviceWorker: true,
      analytics: true
    }
  }
};

function getCurrentEnvironment() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  if (hostname.includes('staging')) {
    return 'staging';
  }
  return 'production';
}
```

**Update vercel.json for staging**:
```json
{
  "rewrites": [
    { "source": "/home", "destination": "/index.html" }
  ],
  "env": {
    "REKONIME_ENV": "production"
  }
}
```

#### 6.3 Data Rollback Strategy

**Purpose**: Enable quick rollback of data updates.

**Implementation**:

Create `tools/deploy-data.js`:
```javascript
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

function backupCurrentData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, timestamp);
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  fs.mkdirSync(backupPath);
  
  ['anime.json', 'anime.full.json', 'anime.preview.json'].forEach(file => {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupPath, file));
    }
  });
  
  console.log(`Backed up data to ${backupPath}`);
  return backupPath;
}

function rollback(toTimestamp) {
  const backupPath = path.join(BACKUP_DIR, toTimestamp);
  
  if (!fs.existsSync(backupPath)) {
    console.error(`Backup not found: ${toTimestamp}`);
    process.exit(1);
  }
  
  ['anime.json', 'anime.full.json', 'anime.preview.json'].forEach(file => {
    const src = path.join(backupPath, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DATA_DIR, file));
    }
  });
  
  console.log(`Rolled back to ${toTimestamp}`);
}

// Main
const command = process.argv[2];

if (command === 'backup') {
  backupCurrentData();
} else if (command === 'rollback') {
  const timestamp = process.argv[3];
  if (!timestamp) {
    console.error('Usage: node deploy-data.js rollback <timestamp>');
    process.exit(1);
  }
  rollback(timestamp);
} else {
  console.log('Usage: node deploy-data.js [backup|rollback <timestamp>]');
}
```

**Acceptance Criteria**:
- [ ] Automated version generation script
- [ ] Cache version auto-updates on build
- [ ] Staging environment configuration
- [ ] Data backup before deployments
- [ ] Rollback script tested and documented

---

### Phase 7: Health Check Endpoint

#### 7.1 Health Check Page

**Purpose**: Provide a health status page for monitoring.

**Implementation**:

Create `health.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Rekonime Health Status</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; }
    .status { padding: 1rem; margin: 0.5rem 0; border-radius: 4px; }
    .healthy { background: #d4edda; color: #155724; }
    .degraded { background: #fff3cd; color: #856404; }
    .down { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <h1>Rekonime Health Status</h1>
  <div id="status-container">
    <div class="status" id="data-status">Checking data...</div>
    <div class="status" id="api-status">Checking API...</div>
    <div class="status" id="sw-status">Checking service worker...</div>
  </div>
  <script>
    async function checkHealth() {
      // Check data files
      try {
        const response = await fetch('data/anime.full.json', { method: 'HEAD' });
        document.getElementById('data-status').className = 'status healthy';
        document.getElementById('data-status').textContent = 'Data files: OK';
      } catch {
        document.getElementById('data-status').className = 'status down';
        document.getElementById('data-status').textContent = 'Data files: Unreachable';
      }
      
      // Check Jikan API
      try {
        const response = await fetch('https://api.jikan.moe/v4/health');
        document.getElementById('api-status').className = response.ok ? 'status healthy' : 'status degraded';
        document.getElementById('api-status').textContent = `Jikan API: ${response.ok ? 'OK' : 'Degraded'}`;
      } catch {
        document.getElementById('api-status').className = 'status down';
        document.getElementById('api-status').textContent = 'Jikan API: Down';
      }
      
      // Check service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        document.getElementById('sw-status').className = registration ? 'status healthy' : 'status degraded';
        document.getElementById('sw-status').textContent = `Service Worker: ${registration ? 'Registered' : 'Not registered'}`;
      }
    }
    
    checkHealth();
  </script>
</body>
</html>
```

**Acceptance Criteria**:
- [ ] Health check page created
- [ ] Data file accessibility checked
- [ ] API health endpoint verified
- [ ] Service worker status displayed
- [ ] Auto-refresh every 30 seconds

---

## Implementation Timeline

| Phase | Task | Priority | Est. Effort |
|-------|------|----------|-------------|
| 1.1 | Logger module with severity levels | High | Medium |
| 1.2 | Error boundary implementation | High | Small |
| 1.3 | Sentry integration (optional) | Medium | Small |
| 2.1 | Analytics wrapper with queuing | High | Medium |
| 3.1 | Core Web Vitals monitoring | High | Medium |
| 4.1 | API health monitor | Medium | Small |
| 5.1 | Runtime data validator | Medium | Medium |
| 6.1 | Automated cache versioning | High | Small |
| 6.2 | Staging environment config | Low | Small |
| 6.3 | Data rollback strategy | Medium | Small |
| 7.1 | Health check page | Low | Small |

---

## Dependencies

### Required
- None (all implementations use native APIs)

### Optional but Recommended
- `web-vitals` library for easier CWV tracking
- Sentry SDK for error tracking

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Error visibility | Console only | 100% of errors logged with context |
| Analytics reliability | ~70% (gtag dependent) | 95%+ with queuing |
| Performance data | None | All Core Web Vitals tracked |
| API downtime awareness | None | Real-time health status |
| Data quality issues | Build-time only | Runtime validation + alerting |
| Deployment time | Manual | <5 minutes with automation |
| Rollback time | Manual restore | <2 minutes |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Increased bundle size | Medium | Lazy-load monitoring modules |
| Performance overhead | Low | Batched logging, sampling |
| Privacy concerns | Medium | Sanitize PII, respect DNT |
| Third-party dependency | Low | All critical features work offline |

---

## Appendix: Code Migration Guide

### Replacing console.error

**Before**:
```javascript
console.error('Failed to initialize app:', error);
```

**After**:
```javascript
Logger.error('Failed to initialize app', {
  error: error.message,
  stack: error.stack,
  context: 'App.init'
});
```

### Replacing gtag calls

**Before**:
```javascript
if (typeof gtag !== 'undefined') {
  gtag('event', 'metric_help_opened', { metric: metricKey });
}
```

**After**:
```javascript
Analytics.track('metric_help_opened', { metric: metricKey });
```

### Adding Performance Marks

**Example**:
```javascript
async loadInitialData() {
  performance.mark('data-load-start');
  
  const result = await this.fetchCatalog(...);
  
  performance.mark('data-load-end');
  performance.measure('data-load', 'data-load-start', 'data-load-end');
  
  PerformanceMonitor.reportMetric('data_load', 
    performance.getEntriesByName('data-load')[0].duration
  );
}
```
