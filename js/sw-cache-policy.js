const JSON_CACHE_ALLOWLIST = new Set([
  '/data/anime.preview.json',
  '/data/anime.full.json',
  '/version.json'
]);

const APP_SHELL_FALLBACKS = new Map([
  ['/', '/index.html'],
  ['/home', '/index.html'],
  ['/index.html', '/index.html'],
  ['/watchlist', '/watchlist.html'],
  ['/watchlist.html', '/watchlist.html']
]);

const normalizeHostname = (hostname) => String(hostname || '').trim().toLowerCase();

const hostMatchesAllowlist = (hostname, allowlist = []) => {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  const allowed = Array.isArray(allowlist) ? allowlist : [];
  for (const entry of allowed) {
    const normalized = normalizeHostname(entry);
    if (!normalized) continue;
    if (host === normalized || host.endsWith(`.${normalized}`)) {
      return true;
    }
  }
  return false;
};

const normalizePathname = (pathname) => {
  const raw = String(pathname || '');
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
};

const getNormalizedDataJsonUrl = (url, serviceWorkerOrigin) => {
  if (!url || !serviceWorkerOrigin) return null;
  const requestUrl = url instanceof URL ? url : new URL(String(url), serviceWorkerOrigin);
  if (requestUrl.origin !== serviceWorkerOrigin) return null;
  const normalizedPath = normalizePathname(requestUrl.pathname);
  if (!JSON_CACHE_ALLOWLIST.has(normalizedPath)) return null;
  return new URL(`${serviceWorkerOrigin}${normalizedPath}`);
};

const buildNormalizedDataRequest = (request, serviceWorkerOrigin) => {
  if (!request || request.method !== 'GET') return null;
  const normalizedUrl = getNormalizedDataJsonUrl(new URL(request.url), serviceWorkerOrigin);
  if (!normalizedUrl) return null;
  return new Request(normalizedUrl.toString(), request);
};

const getAppShellFallbackPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);
  return APP_SHELL_FALLBACKS.get(normalizedPath) || null;
};

export {
  APP_SHELL_FALLBACKS,
  JSON_CACHE_ALLOWLIST,
  normalizePathname,
  hostMatchesAllowlist,
  getNormalizedDataJsonUrl,
  buildNormalizedDataRequest,
  getAppShellFallbackPath
};
