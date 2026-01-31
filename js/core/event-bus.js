import { DependencyContainer } from './dependency-container.js';
import { ErrorHandler } from '../services/error-handler.js';

/**
 * Simple event bus for cross-module communication.
 */
const EventBus = {
  _listeners: new Map(),

  on(eventName, handler) {
    if (!eventName || typeof handler !== 'function') {
      return () => {};
    }
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    const handlers = this._listeners.get(eventName);
    handlers.add(handler);
    return () => this.off(eventName, handler);
  },

  off(eventName, handler) {
    const handlers = this._listeners.get(eventName);
    if (!handlers || !handlers.has(handler)) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this._listeners.delete(eventName);
    }
  },

  emit(eventName, payload) {
    const handlers = this._listeners.get(eventName);
    if (!handlers || handlers.size === 0) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        ErrorHandler.report(error, { source: 'EventBus', eventName });
      }
    });
  },

  clear(eventName) {
    if (eventName) {
      this._listeners.delete(eventName);
      return;
    }
    this._listeners.clear();
  }
};

DependencyContainer.register('eventBus', EventBus);

export { EventBus };
export default EventBus;
