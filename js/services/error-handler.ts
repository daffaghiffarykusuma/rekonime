// @ts-nocheck
import { Logger } from './logger.ts';

/**
 * Centralized error handling with optional listeners.
 */
const ErrorHandler = {
  _listeners: new Set(),

  on(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  report(error, context = {}) {
    const payload = {
      error,
      context,
      timestamp: new Date().toISOString()
    };

    const logger = Logger;
    if (logger?.error) {
      logger.error('Error captured', { error, ...context });
    } else if (typeof console !== 'undefined' && console.error) {
      console.error('[Rekonime]', error, context);
    }

    this._listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (listenerError) {
        if (logger?.warn) {
          logger.warn('Error handler listener failed', { error: listenerError });
        } else if (typeof console !== 'undefined' && console.warn) {
          console.warn('[Rekonime] Error handler failed', listenerError);
        }
      }
    });

    return payload;
  },

  capture(fn, context = {}) {
    if (typeof fn !== 'function') return () => {};
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.report(error, context);
        return undefined;
      }
    };
  },

  captureAsync(fn, context = {}) {
    if (typeof fn !== 'function') return async () => {};
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.report(error, context);
        throw error;
      }
    };
  }
};

export { ErrorHandler };
export default ErrorHandler;
