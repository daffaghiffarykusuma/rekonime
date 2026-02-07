const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const EXPLICIT_RELATIVE_PATH = /^(?:\.{1,2}\/|\/)/;

const normalizeAllowedHosts = (allowedHosts = []) => {
  return new Set(
    (Array.isArray(allowedHosts) ? allowedHosts : [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
  );
};

const isAllowedHost = (host, allowedHosts) => {
  if (!allowedHosts || allowedHosts.size === 0) return true;
  for (const allowed of allowedHosts) {
    if (host === allowed || host.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
};

const sanitizeUrl = (
  rawUrl,
  {
    allowRelative = false,
    baseUrl = typeof window !== 'undefined' ? window.location.href : 'https://localhost/',
    allowedProtocols = ['https:', 'http:'],
    allowedHosts = null
  } = {}
) => {
  if (!rawUrl) return '';
  const value = String(rawUrl).trim();
  if (!value) return '';
  if (value.startsWith('//')) return '';

  if (!HAS_SCHEME.test(value)) {
    if (!allowRelative) return '';
    if (!EXPLICIT_RELATIVE_PATH.test(value)) return '';
    return value;
  }

  try {
    const parsed = new URL(value, baseUrl);
    const protocols = new Set(allowedProtocols);
    if (!protocols.has(parsed.protocol)) return '';
    const normalizedHosts = normalizeAllowedHosts(allowedHosts || []);
    if (!isAllowedHost(parsed.hostname.toLowerCase(), normalizedHosts)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const sanitizeImageUrl = (
  rawUrl,
  {
    allowRelative = false,
    baseUrl = typeof window !== 'undefined' ? window.location.href : 'https://localhost/',
    allowedHosts = []
  } = {}
) => {
  return sanitizeUrl(rawUrl, {
    allowRelative,
    baseUrl,
    allowedProtocols: ['https:'],
    allowedHosts
  });
};

export { sanitizeUrl, sanitizeImageUrl };
