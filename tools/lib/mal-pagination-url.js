const TRUSTED_MAL_HOSTS = new Set(['myanimelist.net', 'www.myanimelist.net']);
const MAL_EPISODE_PATH_PATTERN = /^\/anime\/\d+\/[^/]+\/episode\/?$/;

export function parseTrustedMalEpisodePageUrl(rawUrl, baseUrl) {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.port) return null;
    if (!TRUSTED_MAL_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (!MAL_EPISODE_PATH_PATTERN.test(parsed.pathname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatTrustedMalEpisodePageUrl(rawUrl, baseUrl) {
  return parseTrustedMalEpisodePageUrl(rawUrl, baseUrl)?.toString() || null;
}
