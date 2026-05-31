// @ts-nocheck
import { ErrorHandler } from './error-handler.ts';

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
  services: {
    jikan: {
      currentVersion: 'v4',
      baseUrls: {
        v4: 'https://api.jikan.moe/v4',
        v3: 'https://api.jikan.moe/v3'
      }
    }
  },
  serviceFallbacks: new Map(),
  serviceDeprecations: new Map(),

  registerService(serviceName, config) {
    if (!serviceName || !config) return;
    this.services[serviceName] = {
      currentVersion: config.currentVersion,
      baseUrls: { ...(config.baseUrls || {}) }
    };
  },

  getServiceConfig(serviceName) {
    return this.services[serviceName] || null;
  },

  getServiceVersion(serviceName) {
    const config = this.getServiceConfig(serviceName);
    if (!config) return null;
    const fallback = this.serviceFallbacks.get(serviceName);
    if (fallback && config.baseUrls?.[fallback]) {
      return fallback;
    }
    if (config.currentVersion && config.baseUrls?.[config.currentVersion]) {
      return config.currentVersion;
    }
    const versions = Object.keys(config.baseUrls || {});
    return versions.length ? versions[0] : null;
  },

  getServiceVersionsToTry(serviceName, primaryVersion) {
    const config = this.getServiceConfig(serviceName);
    if (!config?.baseUrls) return [];
    const versions = Object.keys(config.baseUrls);
    if (!primaryVersion || !versions.includes(primaryVersion)) {
      return versions;
    }
    return [primaryVersion, ...versions.filter(version => version !== primaryVersion)];
  },

  getServiceUrl(serviceName, endpoint, params = {}, versionOverride) {
    const config = this.getServiceConfig(serviceName);
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }
    const version = versionOverride || this.getServiceVersion(serviceName);
    const baseUrl = version ? config.baseUrls?.[version] : null;
    if (!baseUrl) {
      throw new Error(`No base URL for ${serviceName} ${version || ''}`.trim());
    }
    const normalizedEndpoint = String(endpoint || '').replace(/^\//, '');
    const url = new URL(`${baseUrl}/${normalizedEndpoint}`);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  },

  shouldFallbackVersion(error) {
    const status = Number(error?.status || error?.response?.status);
    if (status === 404 || status === 410) return true;
    const message = String(error?.message || '');
    return /\b(404|410)\b/.test(message);
  },

  captureDeprecationHeaders(serviceName, response) {
    if (!response?.headers) return;
    const sunset = response.headers.get('Sunset');
    const deprecation = response.headers.get('Deprecation');
    const link = response.headers.get('Link');
    if (sunset || deprecation) {
      this.serviceDeprecations.set(serviceName, {
        sunset,
        deprecation,
        link,
        detectedAt: Date.now()
      });
    }
  },

  getDeprecationInfo(serviceName) {
    return this.serviceDeprecations.get(serviceName) || null;
  },

  resetServiceFallback(serviceName) {
    this.serviceFallbacks.delete(serviceName);
  },

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
        throw error;
      }

      return processedResponse;
    } catch (error) {
      await this.handleError(error, context);
      throw error;
    }
  },

  async handleError(error, context) {
    if (error && error.__apiClientHandled) {
      return;
    }
    if (error && typeof error === 'object') {
      try {
        Object.defineProperty(error, '__apiClientHandled', {
          value: true,
          configurable: true
        });
      } catch {
        error.__apiClientHandled = true;
      }
    }
    ErrorHandler.report(error, { source: 'ApiClient', ...context });
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error, context);
    }
  },

  async requestService(serviceName, endpoint, options = {}) {
    const primaryVersion = this.getServiceVersion(serviceName);
    const versionsToTry = this.getServiceVersionsToTry(serviceName, primaryVersion);
    if (!versionsToTry.length) {
      throw new Error(`No service versions configured for ${serviceName}`);
    }

    const { params, ...requestOptions } = options;
    let lastError = null;

    for (let index = 0; index < versionsToTry.length; index += 1) {
      const version = versionsToTry[index];
      try {
        const url = this.getServiceUrl(serviceName, endpoint, params, version);
        const response = await this.request(url, requestOptions);
        this.captureDeprecationHeaders(serviceName, response);
        if (version !== primaryVersion) {
          this.serviceFallbacks.set(serviceName, version);
        }
        return response;
      } catch (error) {
        lastError = error;
        if (!this.shouldFallbackVersion(error) || index === versionsToTry.length - 1) {
          throw error;
        }
      }
    }

    throw lastError;
  },

  async getServiceJson(serviceName, endpoint, options = {}) {
    const response = await this.requestService(serviceName, endpoint, { ...options, method: 'GET' });
    return response.json();
  },

  async getServiceText(serviceName, endpoint, options = {}) {
    const response = await this.requestService(serviceName, endpoint, { ...options, method: 'GET' });
    return response.text();
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

export { ApiClient };
export default ApiClient;
