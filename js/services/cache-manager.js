import { DependencyContainer } from '../core/dependency-container.js';

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

  setRaw(key, value) {
    if (!key) return false;
    const storage = this.getStorage();
    if (!storage) return false;
    try {
      storage.setItem(key, String(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  getRaw(key) {
    if (!key) return '';
    const storage = this.getStorage();
    if (!storage) return '';
    try {
      return storage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  },

  removeItem(key) {
    if (!key) return;
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (error) {
      // Ignore removal failures
    }
  },

  setJSON(key, value, { ttlMs } = {}) {
    if (!key) return false;
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

  getJSON(key, { fallback = null, allowRaw = true, allowExpired = false } = {}) {
    if (!key) return fallback;
    const raw = this.getRaw(key);
    if (!raw) {
      const memoryValue = this.getMemory(key, { allowExpired });
      return memoryValue === undefined ? fallback : memoryValue;
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
        return parsed.value;
      }
      return allowRaw ? parsed : fallback;
    } catch (error) {
      return allowRaw ? raw : fallback;
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

DependencyContainer.register('cache', CacheManager);

export { CacheManager };
export default CacheManager;
