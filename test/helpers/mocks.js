export const createMockStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    _store: store
  };
};

export const createMockFetch = (routes = {}) => {
  return async (url, options = {}) => {
    const key = String(url);
    const handler = routes[key] || routes['*'];
    if (!handler) {
      throw new Error(`Unexpected fetch: ${key}`);
    }
    const response = typeof handler === 'function' ? await handler(url, options) : handler;
    return response;
  };
};

export const createResponse = (body, init = {}) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
};
