import { sanitizeUrl } from '../urlSanitizer.ts';

const TRAILER_URL_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
const TRAILER_EMBED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];

export interface TrailerPolicyInput {
  id?: string | number | null;
  url?: string | null;
  embedUrl?: string | null;
  embed_url?: string | null;
}

const normalizeHost = (host: unknown) => String(host || '').trim().toLowerCase();

const hostInAllowlist = (hostname: string, allowlist: string[]) => {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return allowlist.some((entry) => normalizeHost(entry) === host);
};

const sanitizeTrailerUrl = (rawUrl: unknown) => {
  return sanitizeUrl(rawUrl, {
    allowRelative: false,
    allowedProtocols: ['https:'],
    allowedHosts: TRAILER_URL_HOSTS,
    allowSubdomains: false
  });
};

const sanitizeTrailerEmbedUrl = (rawUrl: unknown) => {
  const safeUrl = sanitizeUrl(rawUrl, {
    allowRelative: false,
    allowedProtocols: ['https:'],
    allowedHosts: TRAILER_EMBED_HOSTS,
    allowSubdomains: false
  });
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    parsed.searchParams.delete('autoplay');
    return parsed.toString();
  } catch {
    return '';
  }
};

const buildTrailerUrls = (trailer: TrailerPolicyInput | null | undefined) => {
  if (!trailer || typeof trailer !== 'object') {
    return { url: '', embedUrl: '' };
  }

  const id = trailer.id;
  let url = trailer.url || '';
  let embedUrl = trailer.embedUrl || trailer.embed_url || '';

  if (!url && id) {
    url = `https://www.youtube.com/watch?v=${id}`;
  }

  if (!embedUrl && id) {
    embedUrl = `https://www.youtube.com/embed/${id}`;
  }

  return {
    url: sanitizeTrailerUrl(url),
    embedUrl: sanitizeTrailerEmbedUrl(embedUrl)
  };
};

const resolveTrustedTrailerMessageOrigin = (rawUrl: unknown, baseUrl?: string) => {
  if (!rawUrl || rawUrl === 'about:blank') return '';
  try {
    const parsed = new URL(String(rawUrl), baseUrl);
    if (parsed.protocol !== 'https:') return '';
    if (!hostInAllowlist(parsed.hostname, TRAILER_EMBED_HOSTS)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

export {
  TRAILER_URL_HOSTS,
  TRAILER_EMBED_HOSTS,
  sanitizeTrailerUrl,
  sanitizeTrailerEmbedUrl,
  buildTrailerUrls,
  resolveTrustedTrailerMessageOrigin
};
