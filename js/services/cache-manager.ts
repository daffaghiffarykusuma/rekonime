// @ts-nocheck
import { SchemaValidator } from './schema-validator.js';

/**
 * Cache manager with safe localStorage access and TTL support.
 */
const CacheManager = {
  metaKey: '__rekonimeCache',
  memory: new Map(),

  now() {
    return Date.now();
  },

  getStorage() {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  },

  setRaw(key, value, { ttlMs, validate = false, schemaKey } = {}) {
    if (!key) return false;
    const stringValue = String(value);
    if (validate && !SchemaValidator.validate(schemaKey || key, stringValue)) {
      return false;
    }
    const storage = this.getStorage();
    if (!storage) {
      this.setMemory(key, stringValue, { ttlMs });
      return false;
    }
    try {
      storage.setItem(key, stringValue);
      return true;
    } catch (error) {
      this.setMemory(key, stringValue, { ttlMs });
      return false;
    }
  },

  getRaw(key, { fallback = '', allowMemory = true, allowExpired = false, validate = false, schemaKey } = {}) {
    if (!key) return fallback;
    let stored = null;
    const storage = this.getStorage();
    try {
      stored = storage?.getItem(key) ?? null;
    } catch (error) {
      stored = null;
    }

    if (stored === null && allowMemory) {
      const memoryValue = this.getMemory(key, { allowExpired });
      if (typeof memoryValue === 'string') {
        stored = memoryValue;
      }
    }

    if (stored === null) return fallback;
    if (validate && !SchemaValidator.validate(schemaKey || key, stored)) {
      this.removeItem(key);
      return fallback;
    }
    return stored;
  },

  removeItem(key) {
    if (!key) return;
    const storage = this.getStorage();
    try {
      storage?.removeItem(key);
    } catch (error) {
      // Ignore removal failures
    }
    this.memory.delete(key);
  },

  setJSON(key, value, { ttlMs, validate = false, schemaKey } = {}) {
    if (!key) return false;
    if (validate && !SchemaValidator.validate(schemaKey || key, value)) {
      return false;
    }
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
    const payload = ttl
      ? { [this.metaKey]: { expiresAt: this.now() + ttl }, value }
      : value;
    let serialized = '';
    try {
      serialized = JSON.stringify(payload);
    } catch (error) {
      return false;
    }

    if (this.setRaw(key, serialized)) {
      return true;
    }

    this.setMemory(key, value, { ttlMs: ttl });
    return false;
  },

  getJSON(key, { fallback = null, allowRaw = true, allowExpired = false, validate = false, schemaKey } = {}) {
    if (!key) return fallback;
    const raw = this.getRaw(key, { allowMemory: false });
    if (!raw) {
      const memoryValue = this.getMemory(key, { allowExpired });
      const resolved = memoryValue === undefined ? fallback : memoryValue;
      if (validate && resolved !== fallback && !SchemaValidator.validate(schemaKey || key, resolved)) {
        this.removeItem(key);
        return fallback;
      }
      return resolved;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, this.metaKey)) {
        const meta = parsed[this.metaKey];
        const expiresAt = Number(meta?.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= this.now()) {
          if (!allowExpired) {
            this.removeItem(key);
          }
          return fallback;
        }
        const value = parsed.value;
        if (validate && !SchemaValidator.validate(schemaKey || key, value)) {
          this.removeItem(key);
          return fallback;
        }
        return value;
      }
      const value = allowRaw ? parsed : fallback;
      if (validate && value !== fallback && !SchemaValidator.validate(schemaKey || key, value)) {
        this.removeItem(key);
        return fallback;
      }
      return value;
    } catch (error) {
      const value = allowRaw ? raw : fallback;
      if (validate && value !== fallback && !SchemaValidator.validate(schemaKey || key, value)) {
        this.removeItem(key);
        return fallback;
      }
      return value;
    }
  },

  setMemory(key, value, { ttlMs } = {}) {
    if (!key) return false;
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
    const expiresAt = ttl ? this.now() + ttl : 0;
    this.memory.set(key, { value, expiresAt });
    return true;
  },

  getMemory(key, { allowExpired = false } = {}) {
    if (!key || !this.memory.has(key)) return undefined;
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= this.now()) {
      if (!allowExpired) {
        this.memory.delete(key);
        return undefined;
      }
    }
    return entry.value;
  },

  clearMemory() {
    this.memory.clear();
  }
};

export { CacheManager };
export default CacheManager;
