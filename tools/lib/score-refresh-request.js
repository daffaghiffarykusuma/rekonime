const MAX_RETRIES = 4;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
export const DEFAULT_MAL_DELAY_MS = 10000;
export const DEFAULT_JIKAN_DELAY_MS = 3000;

export class ScoreRefreshStoppedError extends Error {}

const retryAfterMs = (value, now) => {
  if (!value?.trim()) return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1000;
    return Number.isFinite(milliseconds) ? milliseconds : 0;
  }
  const date = /^[A-Za-z]{3},\s/.test(trimmed) ? Date.parse(trimmed) : NaN;
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
};

export const createScoreRefreshRequest = ({
  malDelayMs = DEFAULT_MAL_DELAY_MS,
  jikanDelayMs = DEFAULT_JIKAN_DELAY_MS,
  fetchFn = globalThis.fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onCooldown = () => {},
  onProviderUnavailable = () => {}
} = {}) => {
  const hosts = new Map([
    ['myanimelist.net', { interval: malDelayMs, nextRunAt: 0, throttles: 0, queue: Promise.resolve() }],
    ['api.jikan.moe', { interval: jikanDelayMs, nextRunAt: 0, throttles: 0, queue: Promise.resolve() }]
  ]);
  let stopped;
  const stop = (message) => {
    stopped ??= new ScoreRefreshStoppedError(message);
    return stopped;
  };
  const cooldown = (host, hostname, delay, reason) => {
    host.nextRunAt = Math.max(host.nextRunAt, now() + delay);
    onCooldown({ hostname, delayMs: delay, reason });
  };
  const recordTransientFailure = (host, hostname, reason) => {
    host.transientFailures = (host.transientFailures || 0) + 1;
    if (hostname === 'api.jikan.moe' && host.transientFailures >= MAX_RETRIES + 1) {
      host.unavailable = new Error(`${hostname}: unavailable for this run after ${host.transientFailures} consecutive connection/server failures (${reason})`);
      onProviderUnavailable({ hostname, reason });
      throw host.unavailable;
    }
  };

  const schedule = (url, options, attempt) => {
    const hostname = new URL(url).hostname;
    const host = hosts.get(hostname);
    if (!host) throw new Error(`Unsupported score refresh host: ${hostname}`);
    const run = async () => {
      if (stopped) throw stopped;
      if (host.unavailable) throw host.unavailable;
      // Chunk long waits so Retry-After cannot overflow the platform's timer limit.
      let waitMs = Math.max(0, host.nextRunAt - now());
      while (waitMs > 0) {
        const chunk = Math.min(waitMs, 60000);
        await sleep(chunk);
        if (stopped) throw stopped;
        waitMs -= chunk;
      }
      host.nextRunAt = now() + Math.max(0, Number(host.interval) || 0);
      let response;
      try {
        const timeout = AbortSignal.timeout(30000);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        response = await fetchFn(url, { ...options, signal });
      } catch (error) {
        if (options.signal?.aborted) throw error;
        const code = error?.cause?.code || error?.code || error?.name;
        const reason = typeof code === 'string' && /^[a-zA-Z0-9_]+$/.test(code)
          ? `network failure (${code})` : 'network failure';
        recordTransientFailure(host, hostname, reason);
        if (attempt === MAX_RETRIES) throw error;
        cooldown(host, hostname, 5000 * 2 ** attempt, reason);
        return null;
      }

      // Inspect protection responses before releasing queued work, including HTML
      // challenge pages served with HTTP 200 instead of a useful episode page.
      let challenged = response.headers.get('cf-mitigated') === 'challenge';
      if (hostname === 'myanimelist.net' && response.ok) {
        const html = await response.clone().text();
        challenged ||= /<title[^>]*>\s*(?:Just a moment|Access Denied|Checking your browser|Security Check|Verify (?:you are|that you are) human)/i.test(html)
          || /(?:id=["']challenge-form["']|\/cdn-cgi\/challenge-platform\/)/i.test(html);
      }
      if ([401, 403].includes(response.status) || challenged) {
        await response.body?.cancel().catch(() => {});
        throw stop(`${hostname}: ${challenged ? 'security challenge' : `HTTP ${response.status}`}; refresh stopped. Try again later after access is restored.`);
      }
      if (response.ok) {
        host.throttles = 0;
        host.transientFailures = 0;
        return response;
      }
      await response.body?.cancel().catch(() => {});
      if (response.status >= 500 && RETRYABLE_STATUSES.has(response.status)) {
        recordTransientFailure(host, hostname, `HTTP ${response.status}`);
      } else {
        host.transientFailures = 0;
      }
      if (response.status === 429) {
        host.throttles += 1;
        if (host.throttles >= 3) {
          throw stop(`${hostname}: repeated HTTP 429; refresh stopped after three rate-limit responses without a successful request. Try again later.`);
        }
        // Keep the slower pace for the remainder of this run after throttling.
        host.interval = Math.max(host.interval, Math.min(60000, Math.max(host.interval, 1000) * 2));
      }
      if (!RETRYABLE_STATUSES.has(response.status)) throw new Error(`HTTP ${response.status}`);
      const backoff = response.status === 429 ? 60000 * 2 ** (host.throttles - 1) : 5000 * 2 ** attempt;
      cooldown(host, hostname, Math.max(backoff, retryAfterMs(response.headers.get('retry-after'), now())), `HTTP ${response.status}`);
      if (attempt === MAX_RETRIES) throw new Error(`HTTP ${response.status}`);
      return null;
    };
    const scheduled = host.queue.then(run, run);
    host.queue = scheduled.catch(() => undefined);
    return scheduled;
  };

  return async (url, options = {}) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await schedule(url, options, attempt);
      if (response) return response;
    }
    throw new Error(`Failed to fetch ${url}`);
  };
};
