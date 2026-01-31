/**
 * Lightweight dependency container for shared services.
 */
const DependencyContainer = {
  _registry: new Map(),

  register(key, value) {
    if (!key) return value;
    this._registry.set(key, value);
    return value;
  },

  resolve(key, fallback = null) {
    if (!key) return fallback;
    return this._registry.has(key) ? this._registry.get(key) : fallback;
  },

  has(key) {
    return this._registry.has(key);
  },

  remove(key) {
    this._registry.delete(key);
  },

  clear() {
    this._registry.clear();
  },

  entries() {
    return Array.from(this._registry.entries());
  }
};

export { DependencyContainer };
export default DependencyContainer;
