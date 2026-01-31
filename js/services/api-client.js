import { DependencyContainer } from '../core/dependency-container.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Lightweight API client with interceptors.
 */
const ApiClient = {
  defaultHeaders: {
    'Accept': 'application/json'
  },
  requestInterceptors: [],
  responseInterceptors: [],
  errorInterceptors: [],

  addRequestInterceptor(interceptor) {
    if (typeof interceptor !== 'function') return () => {};
    this.requestInterceptors.push(interceptor);
    return () => this.removeInterceptor(this.requestInterceptors, interceptor);
  },

  addResponseInterceptor(interceptor) {
    if (typeof interceptor !== 'function') return () => {};
    this.responseInterceptors.push(interceptor);
    return () => this.removeInterceptor(this.responseInterceptors, interceptor);
  },

  addErrorInterceptor(interceptor) {
    if (typeof interceptor !== 'function') return () => {};
    this.errorInterceptors.push(interceptor);
    return () => this.removeInterceptor(this.errorInterceptors, interceptor);
  },

  removeInterceptor(list, interceptor) {
    const index = list.indexOf(interceptor);
    if (index >= 0) {
      list.splice(index, 1);
    }
  },

  normalizeHeaders(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    if (typeof headers === 'object') {
      return { ...headers };
    }
    return {};
  },

  buildRequest(url, options = {}) {
    const normalizedHeaders = this.normalizeHeaders(options.headers);
    const mergedHeaders = { ...this.defaultHeaders, ...normalizedHeaders };
    const requestOptions = { ...options, headers: mergedHeaders };
    return { url, options: requestOptions };
  },

  async request(url, options = {}) {
    if (!url) {
      throw new Error('ApiClient.request requires a URL');
    }

    let request = this.buildRequest(url, options);

    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(request);
      if (result && result.url) {
        request = { url: result.url, options: result.options || request.options };
      } else if (result && result.options) {
        request = { url: request.url, options: result.options };
      }
    }

    const context = { url: request.url, options: request.options };

    try {
      const response = await fetch(request.url, request.options);
      let processedResponse = response;

      for (const interceptor of this.responseInterceptors) {
        const result = await interceptor(processedResponse, context);
        if (result instanceof Response) {
          processedResponse = result;
        }
      }

      if (!processedResponse.ok) {
        const error = new Error(`HTTP ${processedResponse.status}`);
        error.status = processedResponse.status;
        error.response = processedResponse;
        await this.handleError(error, context);
        throw error;
      }

      return processedResponse;
    } catch (error) {
      await this.handleError(error, context);
      throw error;
    }
  },

  async handleError(error, context) {
    ErrorHandler.report(error, { source: 'ApiClient', ...context });
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error, context);
    }
  },

  async getJson(url, options = {}) {
    const response = await this.request(url, { ...options, method: 'GET' });
    return response.json();
  },

  async getText(url, options = {}) {
    const response = await this.request(url, { ...options, method: 'GET' });
    return response.text();
  }
};

DependencyContainer.register('api', ApiClient);

export { ApiClient };
export default ApiClient;
