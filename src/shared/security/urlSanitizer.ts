const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const EXPLICIT_RELATIVE_PATH = /^(?:\.{1,2}\/|\/)/;

export interface UrlSanitizerOptions {
  allowRelative?: boolean;
  baseUrl?: string;
  allowedProtocols?: string[];
  allowedHosts?: string[] | null;
  allowSubdomains?: boolean;
}

export interface ImageUrlSanitizerOptions {
  allowRelative?: boolean;
  baseUrl?: string;
  allowedHosts?: string[];
  allowSubdomains?: boolean;
}

const getDefaultBaseUrl = () => (
  (globalThis as { window?: { location?: { href?: string } } }).window?.location?.href || 'https://localhost/'
);

const normalizeAllowedHosts = (allowedHosts: string[] | null = []) => {
  return new Set(
    (Array.isArray(allowedHosts) ? allowedHosts : [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
  );
};

const isAllowedHost = (host: string, allowedHosts: Set<string>) => {
  if (!allowedHosts || allowedHosts.size === 0) return true;
  for (const allowed of allowedHosts) {
    if (host === allowed || host.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
};

const sanitizeUrl = (
  rawUrl: unknown,
  {
    allowRelative = false,
    baseUrl = getDefaultBaseUrl(),
    allowedProtocols = ['https:', 'http:'],
    allowedHosts = null,
    allowSubdomains = true
  }: UrlSanitizerOptions = {}
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
    const hostname = parsed.hostname.toLowerCase();
    const hostAllowed = allowSubdomains
      ? isAllowedHost(hostname, normalizedHosts)
      : (normalizedHosts.size === 0 || normalizedHosts.has(hostname));
    if (!hostAllowed) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const sanitizeImageUrl = (
  rawUrl: unknown,
  {
    allowRelative = false,
    baseUrl = getDefaultBaseUrl(),
    allowedHosts = [],
    allowSubdomains = true
  }: ImageUrlSanitizerOptions = {}
) => {
  return sanitizeUrl(rawUrl, {
    allowRelative,
    baseUrl,
    allowedProtocols: ['https:'],
    allowedHosts,
    allowSubdomains
  });
};

export { sanitizeUrl, sanitizeImageUrl };
