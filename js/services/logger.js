import { DependencyContainer } from '../core/dependency-container.js';
import { CacheManager } from './cache-manager.js';

/**
 * Structured logger with buffering and optional persistence.
 */
const Logger = {
  levels: {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    FATAL: 50
  },
  levelNames: {
    10: 'debug',
    20: 'info',
    30: 'warn',
    40: 'error',
    50: 'fatal'
  },
  enabled: true,
  currentLevel: 20,
  buffer: [],
  bufferLimit: 120,
  bufferFlushEvery: 10,
  storageKey: 'rekonime.logs',
  persistLogs: false,
  persistencePreferenceKey: 'rekonime.logPersistence',
  initialized: false,
  globalHandlersInstalled: false,

  init({ level = 'info', persist = null, bufferLimit, captureGlobalErrors = true } = {}) {
    if (this.initialized) return;
    this.initialized = true;
    this.persistLogs = this.resolvePersistencePreference(persist);
    if (Number.isFinite(bufferLimit) && bufferLimit > 0) {
      this.bufferLimit = bufferLimit;
    }
    this.setLevel(level);
    if (captureGlobalErrors) {
      this.installGlobalHandlers();
    }
    this.restoreBuffer();
  },

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  },

  resolvePersistencePreference(persistOption) {
    if (typeof persistOption === 'boolean') {
      return persistOption;
    }
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      const raw = window.localStorage?.getItem(this.persistencePreferenceKey) || '';
      return raw === 'enabled';
    } catch {
      return false;
    }
  },

  setLevel(level) {
    if (typeof level === 'string') {
      const upper = level.trim().toUpperCase();
      if (this.levels[upper]) {
        this.currentLevel = this.levels[upper];
        return;
      }
    }
    if (Number.isFinite(level)) {
      this.currentLevel = level;
    }
  },

  debug(message, context = {}) {
    return this.log('DEBUG', message, context);
  },

  info(message, context = {}) {
    return this.log('INFO', message, context);
  },

  warn(message, context = {}) {
    return this.log('WARN', message, context);
  },

  error(message, context = {}) {
    return this.log('ERROR', message, context);
  },

  fatal(message, context = {}) {
    return this.log('FATAL', message, context);
  },

  log(level, message, context = {}) {
    if (!this.enabled) return null;
    const levelValue = this.normalizeLevel(level);
    if (!Number.isFinite(levelValue)) return null;
    if (levelValue < this.currentLevel) return null;

    const entry = {
      timestamp: new Date().toISOString(),
      level: this.levelNames[levelValue] || String(level).toLowerCase(),
      message: String(message ?? ''),
      context: {
        url: this.getUrl(),
        userAgent: this.getUserAgent(),
        sessionId: this.getSessionId(),
        ...context
      }
    };

    this.addToBuffer(entry);
    this.writeToConsole(entry);

    if (this.persistLogs) {
      const shouldFlush = entry.level === 'error' || entry.level === 'fatal' || this.buffer.length % this.bufferFlushEvery === 0;
      if (shouldFlush) {
        this.flush();
      }
    }

    return entry;
  },

  normalizeLevel(level) {
    if (typeof level === 'string') {
      const upper = level.trim().toUpperCase();
      return this.levels[upper];
    }
    if (Number.isFinite(level)) {
      return level;
    }
    return null;
  },

  addToBuffer(entry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.bufferLimit) {
      this.buffer.splice(0, this.buffer.length - this.bufferLimit);
    }
  },

  getBuffer() {
    return [...this.buffer];
  },

  clearBuffer() {
    this.buffer = [];
    if (this.persistLogs) {
      CacheManager.removeItem(this.storageKey);
    }
  },

  restoreBuffer() {
    const stored = CacheManager.getJSON(this.storageKey, { fallback: [], validate: true });
    if (Array.isArray(stored) && stored.length) {
      this.buffer = stored.slice(-this.bufferLimit);
    }
  },

  flush() {
    if (!this.persistLogs) return false;
    return CacheManager.setJSON(this.storageKey, this.buffer.slice(-this.bufferLimit), { validate: true });
  },

  writeToConsole(entry) {
    if (typeof console === 'undefined') return;
    const method = console[entry.level] || console.log;
    if (typeof method !== 'function') return;
    method.call(console, `[Rekonime] ${entry.message}`, entry.context);
  },

  installGlobalHandlers() {
    if (this.globalHandlersInstalled || typeof window === 'undefined') return;
    this.globalHandlersInstalled = true;

    window.addEventListener('error', (event) => {
      const error = event?.error;
      this.error('Unhandled error', {
        message: event?.message,
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
        stack: error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      this.error('Unhandled promise rejection', {
        reason: reason?.message || String(reason ?? ''),
        stack: reason?.stack
      });
    });
  },

  getSessionId() {
    if (typeof window === 'undefined' || !window.sessionStorage) return 'server';
    const key = 'rekonime.sessionId';
    let value = '';
    try {
      value = window.sessionStorage.getItem(key) || '';
    } catch (error) {
      value = '';
    }
    if (!value) {
      value = this.generateId();
      try {
        window.sessionStorage.setItem(key, value);
      } catch (error) {
        // Ignore storage errors
      }
    }
    return value;
  },

  generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sess-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  },

  getUrl() {
    if (typeof window === 'undefined') return '';
    return window.location?.href || '';
  },

  getUserAgent() {
    if (typeof navigator === 'undefined') return '';
    return navigator.userAgent || '';
  }
};

DependencyContainer.register('logger', Logger);

export { Logger };
export default Logger;
