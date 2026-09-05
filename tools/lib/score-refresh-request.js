const MAX_RETRIES = 4;

export const createScoreRefreshRequest = ({
  malDelayMs = 1200,
  jikanDelayMs = 400,
  fetchFn = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) => {
  const hosts = new Map([
    ['myanimelist.net', { interval: malDelayMs, nextRunAt: 0, queue: Promise.resolve() }],
    ['api.jikan.moe', { interval: jikanDelayMs, nextRunAt: 0, queue: Promise.resolve() }]
  ]);

  const schedule = (url, options) => {
    const host = hosts.get(new URL(url).hostname);
    if (!host) throw new Error(`Unsupported score refresh host: ${new URL(url).hostname}`);
    const run = async () => {
      const waitMs = Math.max(0, host.nextRunAt - now());
      if (waitMs > 0) await sleep(waitMs);
      host.nextRunAt = now() + Math.max(0, Number(host.interval) || 0);
      return fetchFn(url, options);
    };
    const scheduled = host.queue.then(run, run);
    host.queue = scheduled.catch(() => undefined);
    return scheduled;
  };

  return async (url, options = {}) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await schedule(url, options);
        if (response.ok) return response;

        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === MAX_RETRIES) {
          throw new Error(`HTTP ${response.status}`);
        }

        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter ? Number(retryAfter) * 1000 : 1000 * (attempt + 1);
        await sleep(backoffMs);
      } catch (error) {
        if (attempt === MAX_RETRIES) throw error;
        await sleep(1000 * (attempt + 1));
      }
    }

    throw new Error(`Failed to fetch ${url}`);
  };
};
