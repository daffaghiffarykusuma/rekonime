const IMAGE_PROXY_HOST = 'images.weserv.nl';
const DEFAULT_PROBE_URL = `https://${IMAGE_PROXY_HOST}/?url=cdn.myanimelist.net/images/anime/1/1l.jpg&w=2&h=2&fit=cover&output=webp`;

const normalizeProxyStatus = (value) => {
  const ok = value?.ok === true ? true : (value?.ok === false ? false : null);
  const checkedAt = Number(value?.checkedAt) || 0;
  return { ok, checkedAt };
};

const readImageProxyStatus = (storageKey) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: null, checkedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ok: null, checkedAt: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ok: null, checkedAt: 0 };
    return normalizeProxyStatus(parsed);
  } catch {
    return { ok: null, checkedAt: 0 };
  }
};

const getFreshImageProxyStatus = (status, ttlMs) => {
  const normalized = normalizeProxyStatus(status);
  if (!normalized.checkedAt) return null;
  if (Date.now() - normalized.checkedAt > Number(ttlMs || 0)) return null;
  return normalized.ok === true ? true : (normalized.ok === false ? false : null);
};

const writeImageProxyStatus = (storageKey, ok) => {
  const next = {
    ok: ok === true,
    checkedAt: Date.now()
  };
  if (typeof window === 'undefined' || !window.localStorage) {
    return next;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
};

const isProxyImageUrl = (url) => {
  if (!url) return false;
  return String(url).includes(IMAGE_PROXY_HOST);
};

const buildImageProxyUrl = (coverUrl, {
  sanitizeImageUrl,
  width,
  height,
  fit = 'cover',
  output = 'webp'
} = {}) => {
  if (typeof sanitizeImageUrl !== 'function') return '';
  const sanitized = sanitizeImageUrl(coverUrl);
  if (!sanitized) return '';
  try {
    const host = new URL(sanitized).hostname.toLowerCase();
    if (host === IMAGE_PROXY_HOST) return sanitized;
  } catch {
    return '';
  }

  const normalized = sanitized.replace(/^https?:\/\//i, '').replace(/^\/\//, '');
  const url = new URL(`https://${IMAGE_PROXY_HOST}/`);
  url.searchParams.set('url', normalized);
  if (Number.isFinite(width)) {
    url.searchParams.set('w', String(Math.round(width)));
  }
  if (Number.isFinite(height)) {
    url.searchParams.set('h', String(Math.round(height)));
  }
  if (fit) {
    url.searchParams.set('fit', String(fit));
  }
  if (output) {
    url.searchParams.set('output', String(output));
  }
  return url.toString();
};

const probeImageProxyAvailability = ({ timeoutMs = 2500, probeUrl = DEFAULT_PROBE_URL } = {}) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve(false);
      return;
    }

    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      img.src = '';
      resolve(false);
    }, timeoutMs);

    const finalize = (ok) => {
      window.clearTimeout(timeoutId);
      resolve(ok);
    };

    img.onload = () => finalize(true);
    img.onerror = () => finalize(false);
    img.src = `${probeUrl}&cb=${Date.now()}`;
  });
};

export {
  IMAGE_PROXY_HOST,
  readImageProxyStatus,
  getFreshImageProxyStatus,
  writeImageProxyStatus,
  isProxyImageUrl,
  buildImageProxyUrl,
  probeImageProxyAvailability
};
